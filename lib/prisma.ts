import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClient =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  }).$extends({
    query: {
      user: {
        async create({ args, query }) {
          if (args.data && typeof (args.data as any).emailVerified === 'boolean') {
            (args.data as any).emailVerified = (args.data as any).emailVerified ? new Date() : null;
          }
          return query(args);
        },
        async update({ args, query }) {
          if (args.data && typeof (args.data as any).emailVerified === 'boolean') {
            (args.data as any).emailVerified = (args.data as any).emailVerified ? new Date() : null;
          }
          return query(args);
        },
        async upsert({ args, query }) {
          if (args.create && typeof (args.create as any).emailVerified === 'boolean') {
            (args.create as any).emailVerified = (args.create as any).emailVerified ? new Date() : null;
          }
          if (args.update && typeof (args.update as any).emailVerified === 'boolean') {
            (args.update as any).emailVerified = (args.update as any).emailVerified ? new Date() : null;
          }
          return query(args);
        },
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaClient as any;
}

export const prisma = prismaClient;
export const rawPrisma = prismaClient; // alias for compatibility
export default prisma;
