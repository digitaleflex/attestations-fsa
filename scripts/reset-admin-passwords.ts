import { PrismaClient } from "@prisma/client";
// Use Better Auth's own password hasher (scrypt, format: hexSalt:hexHash)
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const NEW_PASSWORD = process.env.NEW_ADMIN_PASSWORD;
if (!NEW_PASSWORD) {
  console.error("Set NEW_ADMIN_PASSWORD env var before running");
  process.exit(1);
}

async function main() {
  const hash = await hashPassword(NEW_PASSWORD!);

  const users = await prisma.user.updateMany({
    where: { role: "admin" },
    data: { password: hash },
  });

  const accounts = await prisma.account.updateMany({
    where: { providerId: "credential", user: { role: "admin" } },
    data: { password: hash },
  });

  console.log(`Users updated: ${users.count}`);
  console.log(`Accounts updated: ${accounts.count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
