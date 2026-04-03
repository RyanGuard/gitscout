import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({
    connectionString,
    // Headroom for concurrent map GETs + enrich-company (each holds a conn for a long time).
    // Too small causes "Failed to load map" when many loadMap()s overlap after generate.
    max: 10,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache in ALL environments (including production on Vercel)
// Prevents creating new connection pools on every function invocation
globalForPrisma.prisma = prisma;
