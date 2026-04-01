import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Vérifier si un admin existe déjà (modèle Admin)
  const adminExists = await prisma.admin.findFirst({
    where: { email: 'admin@fsa.bj' },
  });

  if (!adminExists) {
    const hashedPassword = await hash('Admin123!', 12);

    await prisma.admin.create({
      data: {
        email: 'admin@fsa.bj',
        password: hashedPassword,
        role: 'ADMIN',
        name: 'Administrateur FSA',
        emailVerified: new Date()
      },
    });

    console.log('✅ Compte administrateur créé avec succès');
    console.log('📧 Email: admin@fsa.bj');
    console.log('🔑 Mot de passe: Admin123!');
    console.log('\n⚠️  Veuillez changer ce mot de passe après votre première connexion !');
  } else {
    console.log('ℹ️ Un compte administrateur existe déjà');
  }
  
  // Créer un utilisateur de test (candidat)
  const userExists = await prisma.user.findFirst({
    where: { email: 'candidat@example.com' },
  });
  
  if (!userExists) {
    const hashedPassword = await hash('Candidat123!', 12);
    
    await prisma.user.create({
      data: {
        email: 'candidat@example.com',
        password: hashedPassword,
        role: 'USER',
        name: 'Jean Koffi',
        birthDate: new Date('1995-05-15'),
        birthPlace: 'Cotonou, Bénin',
        phone: '+229 95 12 34 56',
        emailVerified: new Date()
      },
    });
    
    console.log('✅ Compte candidat de test créé avec succès');
    console.log('📧 Email: candidat@example.com');
    console.log('🔑 Mot de passe: Candidat123!');
  } else {
    console.log('ℹ️ Un compte candidat de test existe déjà');
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
