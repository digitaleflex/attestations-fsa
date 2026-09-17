import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo.candidat@fsa.bj';
  const password = 'DemoCandidat2026!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('✅ Le candidat de démo existe déjà :');
    console.log(`   Email   : ${email}`);
    console.log(`   Mot de passe : ${password}`);
    console.log(`   Nom     : ${existing.name}`);
    console.log(`   Rôle    : ${existing.role}`);
    return;
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Candidat Démo FSA',
      password: hashedPassword,
      role: 'user',
      emailVerified: new Date(),
      birthDate: new Date('1998-03-15'),
      birthPlace: 'Cotonou',
      phone: '+229 01 02 03 04',
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      providerId: 'credential',
      // Better Auth 1.7 : accountId d'un compte credential = user.id (jamais l'email).
      accountId: user.id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('✅ Candidat de démo créé avec succès !');
  console.log('');
  console.log('   Identifiants de connexion :');
  console.log('   ─────────────────────────');
  console.log(`   Email        : ${email}`);
  console.log(`   Mot de passe : ${password}`);
  console.log(`   Nom          : ${user.name}`);
  console.log(`   Rôle         : ${user.role}`);
  console.log('');
  console.log('   URL de connexion : /auth');
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
