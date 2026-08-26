import { module } from "@prisma/composer";
import nextjs from "@prisma/composer/nextjs";
import { compute } from "@prisma/composer-prisma-cloud";

// This app manages its own Postgres connection directly (see src/lib/prisma.ts
// and DATABASE_URL as a plain project env var) rather than through Composer's
// managed-dependency graph, so there's nothing to declare in `deps` — the env
// vars set via `project env` are what actually wire the database at runtime.
export default module("crossfitbox", ({ provision }) => {
  provision(compute({
    name: "crossfitbox",
    deps: {},
    build: nextjs({ module: import.meta.url, appDir: "." }),
  }));
});
