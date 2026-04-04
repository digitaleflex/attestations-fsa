import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { scryptSync, randomBytes } from 'node:crypto';

// Fonction de hachage compatible Better Auth (Scrypt standard)
function hashPassword(pass: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(pass, salt, 64, {
    N: 16384,
    r: 8,
    p: 1
  }).toString('hex');
  // Format attendu par certains adaptateurs ou simplement pour stockage propre
  // Better Auth stocke souvent le salt séparément, mais ici on va assurer 
  // que le format est compatible avec la validation.
  return `${salt}.${derivedKey}`;
}

async function main() {
  const admins = [
    { email: 'eflexcloud@gmail.com', password: 'AdminFSA1452.', name: 'Super Admin' },
    { email: 'admin@fermestandre.com', password: 'AdminFSA1452.', name: 'FSA Admin' },
    { email: 'admin@fsa.bj', password: 'AdminFSA1452.', name: 'FSAbj Admin' }
  ];

  for (const admin of admins) {
    console.log(`🚀 Injection Scrypt native pour : ${admin.email}...`);

    try {
      const hashedPassword = hashPassword(admin.password);
      
      const user = await prisma.user.upsert({
        where: { email: admin.email },
        update: {
          password: hashedPassword,
          role: 'ADMIN'
        },
        create: {
          email: admin.email,
          password: hashedPassword,
          role: 'ADMIN',
          name: admin.name,
          emailVerified: new Date()
        }
      });

      await prisma.account.upsert({
        where: { 
          providerId_accountId: {
            providerId: 'credential',
            accountId: admin.email
          }
        },
        update: {
          password: hashedPassword,
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          providerId: 'credential',
          accountId: admin.email,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`✅ ${admin.email} synchronisé (Natif Scrypt).`);
    } catch (error) {
      console.error(`❌ Erreur pour ${admin.email} :`, error);
    }
  }
  process.exit(0);
}

main();
