// Config for `prisma deploy` (the unified Prisma Platform CLI) only — pass
// explicitly via `--config prisma.deploy.config.ts`. Kept separate from
// prisma.config.ts: that file is read by this project's pinned ORM CLI
// (prisma@7.9.1's `defineConfig` from "prisma/config"), which fails to
// parse a config carrying the newer CLI's definePrismaConfig version
// marker (see CLI.CONFIG_MISSING_MARKER) — the two config dialects don't
// currently coexist in one file for these two CLI generations.
import { definePrismaConfig } from "@prisma/cli-engine";

export default definePrismaConfig({});
