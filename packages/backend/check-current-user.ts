import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function checkCurrentUser() {
  try {
    // The Azure AD ID from the token in the error
    const tokenAzureAdId = '5e699a8b-ee3e-403e-b320-9f8dab118ea1';
    const tokenEmail = 'vhaeri@bgcengineering.ca';

    console.log('🔍 Checking current token user...');
    console.log(`Token Azure AD ID: ${tokenAzureAdId}`);
    console.log(`Token Email: ${tokenEmail}`);

    // Check if this user exists
    const userByAzureId = await prisma.user.findUnique({
      where: { azureAdId: tokenAzureAdId },
    });

    const userByEmail = await prisma.user.findUnique({
      where: { email: tokenEmail },
    });

    console.log('\n📋 User lookup results:');
    console.log('By Azure AD ID:', userByAzureId || 'NOT FOUND');
    console.log('By Email:', userByEmail || 'NOT FOUND');

    // Show all users for reference
    console.log('\n📋 All users in database:');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        azureAdId: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
    console.table(allUsers);

    // If the token user doesn't exist or isn't admin, we need to fix it
    if (!userByAzureId) {
      console.log('\n🔧 The token user does not exist in database.');
      console.log('Options:');
      console.log('1. Create new user with token Azure AD ID and promote to ADMIN');
      console.log('2. Update existing ADMIN user to match token Azure AD ID');
    } else if (userByAzureId.role !== 'ADMIN') {
      console.log(`\n🔧 Token user exists but has role: ${userByAzureId.role}`);
      console.log('Need to promote to ADMIN');
    } else {
      console.log('\n✅ Token user exists and is ADMIN - something else is wrong');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentUser(); 