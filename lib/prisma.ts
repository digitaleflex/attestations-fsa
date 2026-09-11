import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { toEmailVerifiedDate } from "@/lib/email-verified";

declare global {
  var prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL || "";
const isAccelerateUrl =
  connectionString.startsWith("prisma") ||
  connectionString.startsWith("prisma+postgres");

const clientOptions: any = {
  log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
};

if (!isAccelerateUrl && connectionString) {
  // config (et non un pg.Pool) : évite le double module `pg` sous bundling
  // (pnpm) où l'adapter ne reconnaît pas l'instance Pool et retombe sur localhost.
  clientOptions.adapter = new PrismaPg({ connectionString });
}

const prismaClient =
  global.prisma ??
  new PrismaClient(clientOptions).$extends({
    query: {
      user: {
        async create({ args, query }) {
          if (args.data && "emailVerified" in (args.data as any)) {
            (args.data as any).emailVerified = toEmailVerifiedDate(
              (args.data as any).emailVerified,
            );
          }
          return query(args);
        },
        async update({ args, query }) {
          if (args.data && "emailVerified" in (args.data as any)) {
            (args.data as any).emailVerified = toEmailVerifiedDate(
              (args.data as any).emailVerified,
            );
          }
          return query(args);
        },
        async upsert({ args, query }) {
          if (args.create && "emailVerified" in (args.create as any)) {
            (args.create as any).emailVerified = toEmailVerifiedDate(
              (args.create as any).emailVerified,
            );
          }
          if (args.update && "emailVerified" in (args.update as any)) {
            (args.update as any).emailVerified = toEmailVerifiedDate(
              (args.update as any).emailVerified,
            );
          }
          return query(args);
        },
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prismaClient as any;
}

export const prisma = prismaClient;
export const rawPrisma = prismaClient; // alias for compatibility
export default prisma;
