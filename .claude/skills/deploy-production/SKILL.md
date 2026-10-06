---
name: deploy-production
description: Deploy this app (crossfitbox) to Prisma Compute production or preview. Use whenever the user asks to deploy, "ship this", "push to prod", "release", "deploy on production", "deploy on preview", or asks for the production/preview URL. This is a project-specific playbook — it exists because the generic `prisma-compute` skill's documented defaults (e.g. "omit --stage for production") do NOT hold in this repo; read this before running any `prisma deploy` command here, even if you think you already know the command.
---

# Deploying crossfitbox to Prisma Compute

This is the app-code half of a deploy. If the change being shipped also touched
`prisma/schema.prisma` (a new table, column, etc.), the database needs to be migrated on that
environment *first* — see the sibling `migrate-database` skill — or the app will 500 on every
request touching the new table/column the moment this deploy goes live.

This app deploys via `@prisma/cli`'s Composer-based `deploy` command (`module.ts` /
`service.ts`), not the classic `app deploy` flow. Two branches (stages) exist on the
platform side already — don't create new ones:

| Branch name | Role | Live URL |
| --- | --- | --- |
| `prod-fra` | production (Frankfurt, `fra`) — production DB via a branch-level `APP_DATABASE_URL` override | https://n8rxh8cjn8a87hvwbn2fynhm.fra.prisma.build |
| `main` | **empty — don't deploy to it.** Old Newark production service deleted 2026-10-02 | — |
| `preview-paris` | preview (Paris, `cdg`) | https://d30lwyopqtk9otec7fp932ms.cdg.prisma.build |
| `preview` | **retired** — old Newark preview, don't deploy to it | https://ywiudpf9p27dxnh0mwygilyx.ewr.prisma.build |

(Confirm current URLs with `service show` below — they can change across deploys.)

**The box's real users work on preview**, i.e. `preview-paris` is the live app. Production
(`prod-fra`, DB = Crossfit-app "Primary database") is barely used.

**Never deploy with `--stage main`.** Its Newark service was deleted on 2026-10-02 after
production moved to `prod-fra`; a `--stage main` deploy would recreate a service there, in
Newark by default, next to the same production DB.

**Don't run services in Newark (`ewr`).** On 2026-09-28 both Newark services kept losing their
DB connections (`Connection terminated due to connection timeout`) — even after preview's DB was
moved into us-east-1 next to it. Preview was recreated in Paris (`cdg`, stage `preview-paris`)
with DB `crossfitbox-preview-paris` (eu-west-3, project `crossfitbox-preview-v2`); `dbMs` ~2ms.

A service's region is immutable: redeploying with another `PRISMA_REGION` fails ("Prisma App
region is immutable…"). Moving means a new stage (or `--name <other>`) in the target region,
then cutting users over. That does **not** work on `main`: the API refuses to create Composer's
`COMPOSER_*` vars on the production branch (`validation-error`). Custom domains only attach to
the production branch, so a stable domain needs that fixed by Prisma first.

A branch-level env override beats the `preview` role scope (the old `preview` branch had one
for `APP_DATABASE_URL`). `preview-paris` has none — it uses the role scope.

## The command

```sh
cd "/Users/clement/Documents/Claude Vs code/Crossfit box"
set -a; source <(grep -E '^(PRISMA_SERVICE_TOKEN|PRISMA_WORKSPACE_ID)=' .env); set +a

# Production (Frankfurt) — a preview-role branch, so it needs its own APP_DATABASE_URL override
# (already set, credential `prod-fra-app` on Crossfit-app "Primary database"):
PRISMA_REGION=eu-central-1 bunx @prisma/cli@latest deploy module.ts --config ./prisma.compute.config.ts --stage prod-fra --yes

# Preview (Paris — PRISMA_REGION only matters when the service is first created, keep it anyway):
PRISMA_REGION=eu-west-3 bunx @prisma/cli@latest deploy module.ts --config ./prisma.compute.config.ts --stage preview-paris --yes
```

**CLI version (2026-10-06):** `@prisma/cli@latest` (= `8.0.0-rc.20`) no longer reads
`prisma-composer.config.ts` / `composer.configPath` and fails with `CLI.CONFIG_SECTION_INVALID`.
Until the config is migrated into a `composer` section, use `bunx @prisma/cli@8.0.0-rc.19` in
place of `@latest` in every command here (deploy and `service show`).

Two flags are load-bearing and easy to get wrong:

- **`--config ./prisma.compute.config.ts` is required.** This repo's plain `prisma.config.ts`
  is the Prisma ORM v7 config (predates the `$prismaConfig` marker this CLI needs) — passing
  no `--config` fails immediately with `CLI.CONFIG_MISSING_MARKER`. The Compute config lives
  in the sibling `prisma.compute.config.ts` file instead; that's the one to pass.
- **Always pass `--stage` explicitly (`prod-fra` or `preview-paris`).** The CLI's own
  `--help` text says "omit for production," but that is not what happens in this repo: an
  omitted `--stage` was observed landing changes on the `preview` branch's resource instead
  of `main`. Don't trust the help text over this file.

**Always run `npm run build` immediately before deploying.** The deploy does *not* build:
it packages whatever is already in `.next/`. Without a fresh build it ships the old code, and
a new service version is only created when that bundle changes — so an env var change
(e.g. a new `APP_DATABASE_URL`) never reaches the app either. Seen on 2026-09-28: three
"successful" deploys left preview on the old version and the old DB.

```sh
npm run build
```

## Env vars

Deploying needs `PRISMA_SERVICE_TOKEN` and `PRISMA_WORKSPACE_ID`, both already in `.env`.
Load them with the `source <(grep ...)` snippet above rather than `dotenv` — the `dotenv`
package installed here (v17) prints an unrelated ad-like "tip" line on every load
(`⌁ auth for agents [...]`); it's harmless but noisy, and easy to mistake for something
having gone wrong.

## Known failure modes (all seen in practice, not hypothetical)

1. **A "Duplicate node logicalId: 'crossfitbox'" HTTP 422 warning appears on every single
   deploy**, to either branch. It is non-fatal noise from Prisma Cloud's topology-recording
   step — the deploy still proceeds and succeeds. Do not treat this line alone as a failure.

2. **(Historical — `main` is no longer deployed to.) The `main` branch has intermittently failed to replace two supporting env-var
   resources** (`COMPOSER_CROSSFITBOX_ORIGIN-var`, `COMPOSER_CROSSFITBOX_PORT-var`) with a
   generic `PrismaApiError: ... (validation-error)` and no further detail, while the actual
   app resource (`crossfitbox-deploy`) still updates and goes live successfully in the same
   run. This reproduced on a retry, so it isn't just a transient blip — but the app was
   confirmed live and correct both times it happened. **Never trust the command's `ok`/exit
   status alone** — always verify with the steps below before reporting success OR failure
   to the user.

3. **Missing peer dependency**: if the deploy fails with `Alchemy could not load the required
   peer dependency "@effect/platform-bun"`, install it pinned to the same `effect` version
   already pinned in this repo's `package.json` `overrides` block:
   ```sh
   npm install --save-dev @effect/platform-bun@4.0.0-rc.111
   ```
   (Check `package.json`'s `overrides.alchemy.effect` for the current pinned version if this
   drifts — don't just reuse the version number above blindly.)

## Verifying a deploy actually worked

Don't rely on the deploy command's own exit code given failure mode #2 above. After deploying,
confirm both of these:

```sh
set -a; source <(grep -E '^(PRISMA_SERVICE_TOKEN|PRISMA_WORKSPACE_ID)=' .env); set +a

# liveVersion.createdAt should be within the last few minutes, status "running", live: true
bunx @prisma/cli@latest service show crossfitbox --branch prod-fra --json    # or --branch preview-paris

# should be 200
curl -s -o /dev/null -w "%{http_code}\n" "<liveUrl-from-above>/admin-login"
```

Report the actual `liveUrl` from `service show` back to the user — it's the platform-assigned
URL and can differ from what's hardcoded above if the service was ever replaced.

## If something here goes stale

This file documents behavior observed on `@prisma/cli`'s Composer `deploy` command as of
2026-09-10. If the CLI's actual behavior stops matching this (e.g. omitting `--stage` starts
correctly defaulting to production, or the env-var replace failure disappears), update this
file rather than silently working around the discrepancy again — the whole point of this skill
is not to have to rediscover these gotchas from scratch next time.
