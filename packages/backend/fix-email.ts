import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function fixEmail() {
  try {
    // Update the user with the correct email
    const user = await prisma.user.update({
      where: { 
        azureAdId: 'b7f64ad2-f939-4424-a48b-bc0bd65295d6' 
      },
      data: { 
        email: 'adm_VHaeri@bgcengineering.ca' 
      },
    });

    console.log('✅ Updated user email:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Display Name: ${user.displayName}`);
    console.log(`  Role: ${user.role}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmail(); 