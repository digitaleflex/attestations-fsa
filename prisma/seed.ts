import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Vérifier si un admin existe déjà (modèle User unifié)
  const adminExists = await prisma.user.findFirst({
    where: { 
      email: 'admin@fsa.bj',
      role: 'ADMIN'
    },
  });

  const adminPassword = 'AdminFSA1452.';
  const hashedAdminPassword = await hash(adminPassword, 12);

  if (!adminExists) {
    const newUser = await prisma.user.create({
      data: {
        email: 'admin@fsa.bj',
        password: hashedAdminPassword,
        role: 'ADMIN',
        name: 'Administrateur FSA',
        emailVerified: new Date()
      },
    });

    // Créer le compte 'credential' pour Better Auth dans le seed
    await prisma.account.create({
      data: {
        userId: newUser.id,
        providerId: 'credential',
        accountId: 'admin@fsa.bj',
        password: hashedAdminPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Compte administrateur unifié créé avec succès (Better Auth Ready)');
    console.log('📧 Email: admin@fsa.bj');
    console.log('🔑 Mot de passe:', adminPassword);
    console.log('\n⚠️  Veuillez changer ce mot de passe après votre première connexion !');
  } else {
    console.log('ℹ️ Un compte administrateur unifié existe déjà');
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
