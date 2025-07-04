import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Vérifier si un admin existe déjà
  const adminExists = await prisma.admin.findFirst({
    where: { email: 'admin@example.com' },
  });

  if (!adminExists) {
    const hashedPassword = await hash('admin123', 12);
    
    await prisma.admin.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'ADMIN',
        name: 'Administrateur',
        emailVerified: new Date()
      },
    });

    console.log('✅ Compte administrateur créé avec succès');
    console.log('Email: admin@example.com');
    console.log('Mot de passe: admin123');
    console.log('\n⚠️ Veuillez changer ce mot de passe après votre première connexion !');
  } else {
    console.log('ℹ️ Un compte administrateur existe déjà');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
