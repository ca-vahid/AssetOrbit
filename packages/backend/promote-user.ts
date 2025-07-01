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

async function promoteUser() {
  try {
    // First, let's see all users
    console.log('Current users:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
    console.table(users);

    // Ask for email to promote
    const email = await question('\nEnter email address to promote to ADMIN: ');
    
    if (!email.trim()) {
      console.log('❌ No email provided');
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (existingUser) {
      // Update existing user
      const user = await prisma.user.update({
        where: { email: email.trim() },
        data: { role: 'ADMIN' },
      });
      console.log(`\n✅ Successfully updated ${user.email} to ${user.role} role!`);
    } else {
      // Create new user
      console.log(`\n👤 User ${email} not found. Creating new admin user...`);
      
      const displayName = await question('Enter display name: ');
      
      const user = await prisma.user.create({
        data: {
          azureAdId: `admin-${Date.now()}`, // temporary ID
          email: email.trim(),
          displayName: displayName.trim() || email.trim(),
          role: 'ADMIN',
        },
      });
      
      console.log(`\n✅ Successfully created new admin user: ${user.email} with ${user.role} role!`);
    }

    // Show updated users table
    console.log('\nUpdated users:');
    const updatedUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
    console.table(updatedUsers);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

promoteUser(); 