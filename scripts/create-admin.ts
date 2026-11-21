import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

/**
 * Crée ou met à jour un compte administrateur — SANS identifiant par défaut.
 *
 * #385 : l'ancienne version contenait trois e-mails et le mot de passe
 * `AdminFSA1452.` en dur, et supprimait l'utilisateur existant (avec ses
 * sessions et son journal d'audit) avant de le recréer. Ce script est
 * désormais :
 *   - non destructif (upsert, aucune suppression d'audit/session) ;
 *   - alimenté uniquement par l'environnement ;
 *   - silencieux sur le mot de passe.
 *
 * Usage :
 *   ADMIN_EMAIL=admin@exemple.com ADMIN_PASSWORD='…' \
 *     pnpm ts-node --project tsconfig.seed.json scripts/create-admin.ts
 */

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || 'Administrateur FSA';

if (!email || !password) {
  console.error(
    'ADMIN_EMAIL et ADMIN_PASSWORD sont requis. Aucun identifiant par défaut n’est fourni.',
  );
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('ADMIN_EMAIL n’est pas une adresse e-mail valide.');
  process.exit(1);
}

if (password.length < 12) {
  console.error('ADMIN_PASSWORD doit contenir au moins 12 caractères.');
  process.exit(1);
}

async function main() {
  const hashedPassword = await hashPassword(password!);
  const existing = await prisma.user.findUnique({ where: { email: email! } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        password: hashedPassword,
        role: 'admin',
        emailVerified: existing.emailVerified ?? new Date(),
      },
    });

    const credential = await prisma.account.findFirst({
      where: { userId: existing.id, providerId: 'credential' },
      select: { id: true },
    });

    if (credential) {
      await prisma.account.update({
        where: { id: credential.id },
        data: { password: hashedPassword, accountId: existing.id },
      });
    } else {
      await prisma.account.create({
        data: {
          userId: existing.id,
          providerId: 'credential',
          // Better Auth 1.7 : accountId d'un compte credential = user.id.
          accountId: existing.id,
          password: hashedPassword,
        },
      });
    }

    console.log(`Compte administrateur existant mis à jour : ${email}`);
  } else {
    const user = await prisma.user.create({
      data: {
        email: email!,
        name,
        password: hashedPassword,
        role: 'admin',
        emailVerified: new Date(),
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: hashedPassword,
      },
    });

    console.log(`Compte administrateur créé : ${email}`);
  }

  console.log(
    'Mot de passe non journalisé. Changez-le après la première connexion.',
  );
}

main()
  .catch((error) => {
    console.error('Échec de la création/mise à jour du compte admin :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
