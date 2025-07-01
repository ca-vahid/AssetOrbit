import { PrismaClient } from './src/generated/prisma/index.js';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function deleteUser() {
  try {
    // Show all users
    console.log('📋 Current users:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        azureAdId: true,
      },
      orderBy: { displayName: 'asc' },
    });
    
    // Display users with index numbers
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.displayName} (${user.email}) - ${user.role}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Azure AD ID: ${user.azureAdId}`);
      console.log('');
    });

    if (users.length === 0) {
      console.log('No users found.');
      return;
    }

    // Ask which user to delete
    const choice = await question(`Enter the number (1-${users.length}) of the user to DELETE, or 'q' to quit: `);
    
    if (choice.toLowerCase() === 'q') {
      console.log('❌ Cancelled');
      return;
    }

    const userIndex = parseInt(choice) - 1;
    if (isNaN(userIndex) || userIndex < 0 || userIndex >= users.length) {
      console.log('❌ Invalid selection');
      return;
    }

    const userToDelete = users[userIndex];
    
    // Confirm deletion
    const confirm = await question(`⚠️  Are you sure you want to DELETE "${userToDelete.displayName}" (${userToDelete.email})? Type 'yes' to confirm: `);
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      return;
    }

    // Delete the user
    const deletedUser = await prisma.user.delete({
      where: { 
        id: userToDelete.id
      },
    });

    console.log('\n✅ Successfully deleted user:');
    console.log(`  Name: ${deletedUser.displayName}`);
    console.log(`  Email: ${deletedUser.email}`);
    console.log(`  Role: ${deletedUser.role}`);

    // Show remaining users
    console.log('\n📋 Remaining users:');
    const remainingUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
    console.table(remainingUsers);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

deleteUser(); 