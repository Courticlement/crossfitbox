// Separate from prisma.config.ts on purpose: that file is read by the
// project's actual Prisma ORM CLI (v7, pinned in package.json) for
// migrate/generate/db push, and predates the "$prismaConfig" version marker
// this newer Compute tooling (v8 CLI, @prisma/composer) requires. Passed
// explicitly via --config so the two never collide.
import { definePrismaConfig } from "@prisma/cli-engine";

export default definePrismaConfig({
  composer: {
    configPath: "./prisma-composer.config.ts",
  },
});
