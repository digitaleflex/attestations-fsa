import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'eflexcloud@gmail.com';
  const password = 'PasswordAdmin123!';
  const name = 'Super Admin';

  console.log(`🚀 Création de l'utilisateur admin : ${email}...`);

  try {
    const adminExists = await prisma.admin.findFirst({
      where: { email },
    });

    if (!adminExists) {
      const hashedPassword = await hash(password, 12);
      
      await prisma.admin.create({
        data: {
          email,
          password: hashedPassword,
          role: 'ADMIN',
          name,
          emailVerified: new Date()
        },
      });

      console.log('✅ Compte administrateur créé avec succès !');
      console.log(`📧 Email : ${email}`);
      console.log(`🔑 Mot de passe : ${password}`);
    } else {
      console.log('ℹ️ Un compte administrateur avec cet email existe déjà.');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin :', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
