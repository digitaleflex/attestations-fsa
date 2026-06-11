import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

async function main() {
  // Vérifier si un admin existe déjà
  const adminExists = await prisma.user.findUnique({
    where: { 
      email: 'admin@fsa.bj'
    },
  });

  const adminPassword = 'AdminFSA1452.';
  const hashedAdminPassword = await hashPassword(adminPassword);

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
  const userExists = await prisma.user.findUnique({
    where: { email: 'candidat@example.com' },
  });
  
  if (!userExists) {
    const hashedPassword = await hashPassword('Candidat123!');
    
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

  // Seeder les formations
  const formations = [
    {
      name: "Formation de base",
      category: "Pisciculture",
      description: "Introduction à la pisciculture, biologie des poissons, gestion des étangs, alimentation et reproduction.",
      skills: ["Introduction à la pisciculture", "Biologie des poissons", "Gestion des étangs", "Alimentation", "Reproduction"]
    },
    {
      name: "Production d’alevins",
      category: "Formation technique spécialisée",
      description: "Technique de reproduction, sexage manuel (notamment pour tilapia).",
      skills: ["Technique de reproduction", "Sexage manuel", "Reproduction Tilapia"]
    },
    {
      name: "Grossissement",
      category: "Formation technique spécialisée",
      description: "Optimisation de la croissance, alimentation, suivi sanitaire.",
      skills: ["Optimisation de la croissance", "Alimentation", "Suivi sanitaire"]
    },
    {
      name: "Système d’élevage",
      category: "Formation technique spécialisée",
      description: "Étangs, cages flottantes, bassin en béton, aquaponie.",
      skills: ["Étangs", "Cages flottantes", "Bassin en béton", "Aquaponie"]
    },
    {
      name: "Pisciculture intensive",
      category: "Expertise Commerciale",
      description: "Pour les projets commerciaux, avec focus sur la rentabilité, les intrants, et la gestion des cycles de production.",
      skills: ["Rentabilité commerciale", "Gestion des intrants", "Cycles de production", "Haute densité"]
    },
    {
      name: "Pisciculture associée",
      category: "Élevage Intégré",
      description: "Association avec l’élevage de porcs ou de canards pour fertiliser les étangs et améliorer les rendements.",
      skills: ["Élevage de porcs", "Élevage de canards", "Fertilisation naturelle", "Optimisation des rendements"]
    },
    {
      name: "Gestion et entrepreneuriat aquacole",
      category: "Entrepreneuriat",
      description: "Planification, marketing, gestion financière, normes sanitaires.",
      skills: ["Planification", "Marketing", "Gestion financière", "Nommes sanitaires"]
    },
    {
      name: "Pisciculture extensive",
      category: "Système d'élevage",
      description: "Utilise des ressources naturelles, faible densité de poisson.",
      skills: ["Ressources naturelles", "Faible densité"]
    },
    {
      name: "Polyculture",
      category: "Système d'élevage",
      description: "Élevage simultané de tilapia et de pangasius pour optimiser l’espace.",
      skills: ["Tilapia", "Pangasius", "Optimisation d'espace"]
    }
  ];

  console.log('\n🌱 Seeding des formations...');
  for (const f of formations) {
    const existing = await prisma.formation.findFirst({
      where: { name: f.name }
    });

    if (!existing) {
      await prisma.formation.create({
        data: f
      });
      console.log(`✅ Création de la formation: ${f.name}`);
    } else {
      await prisma.formation.update({
        where: { id: existing.id },
        data: f
      });
      console.log(`ℹ️ Mise à jour de la formation: ${f.name}`);
    }
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
