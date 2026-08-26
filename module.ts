import { module } from "@prisma/composer";
import app from "./service.ts";

export default module("crossfitbox", ({ provision }) => {
  provision(app, { deps: {} });
});
