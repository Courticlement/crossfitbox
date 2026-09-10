---
name: deploy-production
description: Deploy this app (crossfitbox) to Prisma Compute production or preview. Use whenever the user asks to deploy, "ship this", "push to prod", "release", "deploy on production", "deploy on preview", or asks for the production/preview URL. This is a project-specific playbook — it exists because the generic `prisma-compute` skill's documented defaults (e.g. "omit --stage for production") do NOT hold in this repo; read this before running any `prisma deploy` command here, even if you think you already know the command.
---

# Deploying crossfitbox to Prisma Compute

This app deploys via `@prisma/cli`'s Composer-based `deploy` command (`module.ts` /
`service.ts`), not the classic `app deploy` flow. Two branches (stages) exist on the
platform side already — don't create new ones:

| Branch name | Role | Live URL |
| --- | --- | --- |
| `main` | production | https://sozs41b0z2fndybwg8z54u3s.ewr.prisma.build |
| `preview` | preview | https://ywiudpf9p27dxnh0mwygilyx.ewr.prisma.build |

(Confirm current URLs with `service show` below — they can change across deploys.)

## The command

```sh
cd "/Users/clement/Documents/Claude Vs code/Crossfit box"
set -a; source <(grep -E '^(PRISMA_SERVICE_TOKEN|PRISMA_WORKSPACE_ID)=' .env); set +a

# Production:
bunx @prisma/cli@latest deploy module.ts --config ./prisma.compute.config.ts --stage main --yes

# Preview:
bunx @prisma/cli@latest deploy module.ts --config ./prisma.compute.config.ts --stage preview --yes
```

Two flags are load-bearing and easy to get wrong:

- **`--config ./prisma.compute.config.ts` is required.** This repo's plain `prisma.config.ts`
  is the Prisma ORM v7 config (predates the `$prismaConfig` marker this CLI needs) — passing
  no `--config` fails immediately with `CLI.CONFIG_MISSING_MARKER`. The Compute config lives
  in the sibling `prisma.compute.config.ts` file instead; that's the one to pass.
- **`--stage main` is required for production — do not omit `--stage`.** The CLI's own
  `--help` text says "omit for production," but that is not what happens in this repo: an
  omitted `--stage` was observed landing changes on the `preview` branch's resource instead
  of `main`. Always pass `--stage main` explicitly for a production deploy. Don't trust the
  help text over this file.

Run a local build first to catch errors before spending a deploy cycle:

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

2. **The `main` branch has intermittently failed to replace two supporting env-var
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
bunx @prisma/cli@latest service show crossfitbox --branch main --json    # or --branch preview

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
