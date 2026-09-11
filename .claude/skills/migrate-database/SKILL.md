---
name: migrate-database
description: Apply a Postgres schema change (new table, new column, index rename, etc.) to crossfitbox's preview or production database. Use whenever the user asks to "migrate the database", "apply the migration to preview/production", "update the database on preview/prod", or when a feature's Prisma schema change needs to reach a deployed environment (not just local). This is a project-specific playbook — preview/production's DATABASE_URL is a write-only secret nobody, including the CLI, can read back directly; this file documents the actual working path around that. Read this before touching `prisma project env`, `prisma postgres`, or asking the user to paste a connection string — that's the slow way and usually a dead end.
---

# Migrating crossfitbox's preview/production databases

Tenant tables (`Coach`, `ClassInstance`, `ClassReview`, ...) live in each organization's own
`org_<organizationId>` Postgres schema, not `public` — see `src/lib/prisma.ts` and
`src/lib/tenant-schema.ts`. `prisma/migrations/*/migration.sql` files in this repo are
**documentation only**: they were never applied via `prisma migrate deploy`. Every schema
change is applied by hand, per org schema, against the real database — this file is how.

## The one fact that saves the most time: preview/production ARE real Prisma Postgres databases

`prisma postgres list` (no `--project` flag) returns empty for the `crossfitbox` app project —
this looks like preview/production aren't Prisma-managed databases at all, and is a trap: it's
scoped to the wrong project. The databases actually backing preview and production's
`DATABASE_URL` live under **different Prisma projects** in the same workspace:

```sh
set -a; source <(grep -E '^(PRISMA_SERVICE_TOKEN|PRISMA_WORKSPACE_ID)=' .env); set +a
bunx @prisma/cli@latest project list --json
```

As of 2026-09-11 this workspace has four projects: `crossfitbox` (the app itself — no
database), `crossfit-box-local-dev` (local dev's own DB, already in `.env`), and two others
that actually hold preview/production's data:

| Env | Prisma project | Database name | Database id |
| --- | --- | --- | --- |
| preview | `crossfitbox-preview-v2` | `crossfitbox-preview-v2` | `db_zoi6criu2zt9bk5uh4rtihqg` |
| production | `Crossfit-app` | `Primary database` | `db_cmsqdk2dd0l71zrf6wqi26m8u` |

These ids can change if a database is ever recreated — **don't trust this table blindly**, re-derive
it if anything below fails to verify:

```sh
bunx @prisma/cli@latest postgres list --project "crossfitbox-preview-v2" --json
bunx @prisma/cli@latest postgres list --project "Crossfit-app" --json
```

`Crossfit-app` also holds a database literally named `crossfitbox-preview` (an older, now-stale
preview snapshot) — don't confuse it with `crossfitbox-preview-v2`, which is the one actually
wired to preview's `DATABASE_URL`. If both candidates in a project look plausible, cross-check
each database's `createdAt` against the target `DATABASE_URL` env var's own `updatedAt`
(`prisma project env list --role preview --json` / `--role production`) — the real one was
almost always created or rotated within minutes of that timestamp.

## Never trust a name/timestamp match alone — verify by content

Before running anything against a candidate database, mint a connection (see below) and check
what's actually in it:

```sh
node <helper>.mjs "<connectionString>" 'SELECT id, name FROM "Organization";'
```

Compare the org names against what the live app actually shows — curl its `/login` page (the
"box picker" lists every org by name) rather than guessing from project/database naming alone:

```sh
curl -s "<liveUrl>/login" | grep -oE 'Crossfit[^<"]*' | sort -u
```

This caught a real mistake in practice: production's obvious-looking `Primary database`
candidate was initially dismissed because it held orgs named "Crossfit Louvre 1/2/3" instead of
the "Crossfit Box"-style test org seen on local/preview — but that's expected, not a red flag:
production serves real customer boxes with real names, not the synthetic test org local/preview
use. The `/login` page check confirmed it was right all along.

## Minting a working connection (this is the part that actually unblocks you)

Do **not** try to read `DATABASE_URL`'s existing value — the dashboard's env var editor is
write-only (clicking into the row opens a blank "Replace value" form, never a reveal). Nobody,
including the CLI with full deploy permissions, can read it back. Don't spend time on
DevTools tricks either — the real value is never sent to the browser in the first place, so
there's nothing in the DOM to extract.

Instead, mint a **separate, scoped, one-time connection** directly to the database resource —
this never touches the app's actual `DATABASE_URL`, so there's no risk of breaking the running
deploy:

```sh
bunx @prisma/cli@latest postgres connection create <database-id> --project "<project>" --name migration-check --json
# → result.connectionString, a fresh postgres://...@pooled.db.prisma.io:5432/postgres?sslmode=require URL
```

**Always delete it once done** — it's a standing credential otherwise:

```sh
bunx @prisma/cli@latest postgres connection delete <connection-id> --confirm <connection-id>
```

## Running the actual migration

1. Find the org id(s) (query against the default/public schema, no `SET search_path` needed):
   ```sql
   SELECT id, name FROM "Organization";
   ```
2. **Check for backfill risk first** if the migration adds a `NOT NULL` column derived from
   existing data (e.g. `ClassReview.subjectCoachId` backfilled from `ClassInstance.coachId`) —
   a row whose source value is null will make the later `SET NOT NULL` fail:
   ```sql
   SET search_path TO "org_<id>";
   SELECT count(*) FROM "<Table>" t JOIN ... WHERE <source column> IS NULL;
   ```
   If this comes back non-zero, stop and decide how to handle those specific rows — don't let
   the migration silently drop or misattribute them.
3. **Don't assume the target schema exactly matches this repo's `tenant-schema.ts`.** Actual
   constraint/index names can drift from what's canonically declared, especially on production,
   which may have been provisioned via an older path. Check before writing a `DROP
   INDEX`/`DROP CONSTRAINT` by exact name:
   ```sql
   SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'org_<id>' AND tablename = '<Table>';
   ```
   This bit in practice: production's `ClassReview` unique index on `classInstanceId` was named
   `ClassReview_classInstanceId_idx`, while local/preview (and `tenant-schema.ts`) call it
   `ClassReview_classInstanceId_key`. A `DROP INDEX` by the wrong name fails loudly (good — it
   rolls back cleanly) rather than silently doing nothing, but check first to avoid the wasted
   round trip. Write a per-environment adjusted copy of the migration SQL if needed rather than
   forcing every environment through an identical script.
4. Apply per org, wrapped in a transaction so a failure rolls back with zero partial damage —
   write a tiny reusable script (there's no project-local one checked in; recreate it in the
   scratchpad each time) rather than piping raw SQL through `psql -c`, since `SET search_path`
   has to run in the same session as the DDL:
   ```js
   // apply-migration.mjs
   import { Client } from "pg";
   import { readFileSync } from "fs";
   const [url, schema, file] = process.argv.slice(2);
   const sql = readFileSync(file, "utf8");
   const client = new Client({ connectionString: url });
   await client.connect();
   try {
     await client.query("BEGIN");
     await client.query(`SET search_path TO "${schema}"`);
     await client.query(sql);
     await client.query("COMMIT");
     console.log("Applied to schema", schema);
   } catch (e) {
     await client.query("ROLLBACK");
     console.error("Failed, rolled back:", e.message);
     process.exitCode = 1;
   } finally {
     await client.end();
   }
   ```
   Run it from the project directory (so `pg` resolves from `node_modules`) once per org:
   ```sh
   for org in "org_<id1>" "org_<id2>"; do
     node apply-migration.mjs "<connectionString>" "$org" "<path-to-migration.sql>"
   done
   ```
5. Verify the result (row counts, a spot-check `SELECT` on the backfilled column) before
   declaring success.
6. Delete the temporary connection (see above), remove any temp `.mjs`/`.sql` helper files you
   created in the project root.
7. Update `prisma/schema.prisma` (and `src/lib/tenant-schema.ts`'s `tenantTableDdl`/
   `tenantTableForeignKeys`, which provision *new* orgs going forward) to match, if you haven't
   already — this file documents applying a change, not authoring one.

## Production needs explicit confirmation, every time

Auto-mode's classifier will very likely block both the connection-create step and the
DDL-apply step when the target is production — this is correct behavior, not a bug to route
around. Stop and ask the user to explicitly confirm before touching production's real data,
even if the exact same migration already succeeded cleanly on preview. Preview databases hold
test data; production databases in this app hold real customer boxes.

## After the database is migrated

The database change alone doesn't ship the feature — deploy the app code too (see the
`deploy-production` skill for that half, including its own known failure modes and how to
verify a deploy actually went live). Order matters: migrate the database *before* deploying
code that queries the new table/column, never after — the running app would 500 on every
request touching it in the gap.

## If something here goes stale

This file documents the actual project/database ids and index-naming quirks observed as of
2026-09-11. If a database gets recreated, a project gets renamed, or `postgres list`/`project
env list` start behaving differently, update this file rather than silently rediscovering it
next time — that's the whole point of writing it down.
