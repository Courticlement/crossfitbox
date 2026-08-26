import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // APP_DATABASE_URL is the same connection string as DATABASE_URL, kept as
  // a second project env var specifically for Prisma Compute: DATABASE_URL
  // is a system-managed key there and only auto-wires into a service that
  // formally declares it as a Composer dependency (which this app doesn't —
  // it connects to Postgres directly, the same way it always has), so a
  // plain custom-named duplicate is what actually reaches the process.
  const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;
  const adapter = new PrismaPg(url);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
