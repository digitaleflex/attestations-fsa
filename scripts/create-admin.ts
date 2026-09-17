import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

const admins = [
  { email: 'eflexcloud@gmail.com', password: 'AdminFSA1452.', name: 'Super Admin' },
  { email: 'admin@fermestandre.com', password: 'AdminFSA1452.', name: 'FSA Admin' },
  { email: 'admin@fsa.bj', password: 'AdminFSA1452.', name: 'FSAbj Admin' },
];

async function main() {
  for (const admin of admins) {
    console.log(`\n── ${admin.email} ──`);

    try {
      // 1. Supprimer l'ancien compte
      const existingUser = await prisma.user.findUnique({
        where: { email: admin.email },
      });

      if (existingUser) {
        console.log(`  🗑️  Suppression de l'ancien compte (id: ${existingUser.id})...`);
        await prisma.auditLog.deleteMany({ where: { userId: existingUser.id } });
        await prisma.account.deleteMany({ where: { userId: existingUser.id } });
        await prisma.session.deleteMany({ where: { userId: existingUser.id } });
        await prisma.user.delete({ where: { id: existingUser.id } });
      }

      // 2. Hash avec l'algorithme interne de Better Auth
      const hashedPassword = await hashPassword(admin.password);
      console.log(`  🔐 Hash Better Auth généré: ${hashedPassword.slice(0, 20)}...`);

      // 3. Créer le user
      const user = await prisma.user.create({
        data: {
          email: admin.email,
          name: admin.name,
          password: hashedPassword,
          role: 'admin',
          emailVerified: new Date(),
        },
      });
      console.log(`  👤 User créé (id: ${user.id})`);

      // 4. Créer l'Account credential
      await prisma.account.create({
        data: {
          userId: user.id,
          providerId: 'credential',
          // Better Auth 1.7 : accountId d'un compte credential = user.id (jamais l'email).
          accountId: user.id,
          password: hashedPassword,
        },
      });
      console.log(`  🔑 Account credential créé`);
      console.log(`  ✅ ${admin.name} créé avec succès`);
    } catch (error) {
      console.error(`  ❌ Erreur pour ${admin.email} :`, error);
    }
  }

  console.log('\n✅ Terminé.');
  await prisma.$disconnect();
  process.exit(0);
}

main();
