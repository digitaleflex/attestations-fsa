import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

export type CredentialAccountClient = Pick<PrismaClient, 'account'>;

/**
 * Garantit qu'un utilisateur possède un enregistrement `Account`
 * `providerId: "credential"` exploitable par Better Auth, sans doublon.
 *
 * Better Auth 1.7 authentifie un mot de passe via cet enregistrement et exige
 * `accountId === user.id` (cf. better-auth/dist/api/routes/sign-in.mjs).
 *
 * Idempotent : un second passage sur une donnée saine renvoie "exists" sans
 * aucune écriture ; une donnée absente ou désalignée est créée / réparée.
 */
export async function ensureCredentialAccount(
  client: CredentialAccountClient,
  params: { userId: string; passwordHash: string },
): Promise<'created' | 'repaired' | 'exists'> {
  const existing = await client.account.findFirst({
    where: { userId: params.userId, providerId: 'credential' },
  });

  if (existing) {
    const isUsable =
      existing.accountId === params.userId && Boolean(existing.password);

    if (isUsable) {
      return 'exists';
    }

    await client.account.update({
      where: { id: existing.id },
      data: {
        accountId: params.userId,
        password: params.passwordHash,
        updatedAt: new Date(),
      },
    });

    return 'repaired';
  }

  await client.account.create({
    data: {
      userId: params.userId,
      providerId: 'credential',
      accountId: params.userId,
      password: params.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return 'created';
}


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

    // Compte 'credential' Better Auth : accountId === user.id (helper idempotent).
    await ensureCredentialAccount(prisma, {
      userId: newUser.id,
      passwordHash: hashedAdminPassword,
    });

    console.log('✅ Compte administrateur unifié créé avec succès (Better Auth Ready)');
    console.log('📧 Email: admin@fsa.bj');
    console.log('🔑 Mot de passe:', adminPassword);
    console.log('\n⚠️  Veuillez changer ce mot de passe après votre première connexion !');
  } else {
    console.log('ℹ️ Un compte administrateur unifié existe déjà');
  }
  
  // Créer un utilisateur de test (candidat)
  const candidateEmail = 'candidat@example.com';
  const candidatePassword = 'Candidat123!';

  const userExists = await prisma.user.findUnique({
    where: { email: candidateEmail },
  });

  if (!userExists) {
    const hashedPassword = await hashPassword(candidatePassword);

    const candidate = await prisma.user.create({
      data: {
        email: candidateEmail,
        password: hashedPassword,
        role: 'USER',
        name: 'Jean Koffi',
        birthDate: new Date('1995-05-15'),
        birthPlace: 'Cotonou, Bénin',
        phone: '+229 95 12 34 56',
        emailVerified: new Date()
      },
    });

    // Better Auth authentifie un mot de passe via l'enregistrement `Account`
    // "credential" (accountId = user.id), pas via `User.password` seul.
    await ensureCredentialAccount(prisma, {
      userId: candidate.id,
      passwordHash: hashedPassword,
    });

    console.log('✅ Compte candidat de test créé avec succès (Better Auth Ready)');
    console.log('📧 Email: candidat@example.com');
    console.log('🔑 Mot de passe: Candidat123!');
  } else {
    // Idempotent : répare un `Account` manquant ou désaligné (ancien seed,
    // import partiel) sans créer de doublon.
    const hashedPassword = await hashPassword(candidatePassword);
    const accountState = await ensureCredentialAccount(prisma, {
      userId: userExists.id,
      passwordHash: hashedPassword,
    });

    if (accountState === 'exists') {
      console.log('ℹ️ Un compte candidat de test existe déjà (Account credential présent)');
    } else {
      console.log('✅ Compte candidat de test réparé : Account credential créé');
      console.log('📧 Email: candidat@example.com');
      console.log('🔑 Mot de passe: Candidat123!');
    }
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
