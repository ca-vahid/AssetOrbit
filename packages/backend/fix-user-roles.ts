import { PrismaClient } from './src/generated/prisma/index.js';
import { USER_ROLES } from './src/constants/index.js';

const prisma = new PrismaClient();

async function fixUserRoles() {
  console.log('🔍 Checking user roles...\n');

  // Get all users
  const users = await prisma.user.findMany({
    orderBy: [
      { role: 'desc' },
      { displayName: 'asc' }
    ]
  });

  console.log('Current user roles:');
  users.forEach(user => {
    console.log(`  ${user.displayName} (${user.email}) - ${user.role}`);
  });

  // Find users that should likely be admins or writers
  const adminEmails = [
    'admin@company.com',
    'vhaeri@bgcengineering.ca',
    'adm_VHaeri@bgcengineering.ca',
  ];

  const writerEmails = [
    // Add emails of users who should have write access
  ];

  console.log('\n🔧 Fixing user roles...\n');

  // Promote admin users
  for (const email of adminEmails) {
    const user = users.find(u => u.email === email);
    if (user && user.role !== USER_ROLES.ADMIN) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: USER_ROLES.ADMIN }
      });
      console.log(`✅ Promoted ${user.displayName} to ADMIN`);
    }
  }

  // Promote writer users
  for (const email of writerEmails) {
    const user = users.find(u => u.email === email);
    if (user && user.role !== USER_ROLES.WRITE && user.role !== USER_ROLES.ADMIN) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: USER_ROLES.WRITE }
      });
      console.log(`✅ Promoted ${user.displayName} to WRITE`);
    }
  }

  // Interactive mode - ask about each READ user
  const readUsers = users.filter(u => u.role === USER_ROLES.READ);
  
  if (readUsers.length > 0) {
    console.log('\n📋 Users currently with READ role:');
    readUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.displayName} (${user.email})`);
    });

    console.log('\n💡 To promote users, you can:');
    console.log('1. Add their emails to the adminEmails or writerEmails arrays in this script');
    console.log('2. Use the Users page in the web interface (if you have admin access)');
    console.log('3. Run the promote-user.ts script for individual users');
  }

  console.log('\n✅ Role fixing complete!');
}

async function main() {
  try {
    await fixUserRoles();
  } catch (error) {
    console.error('❌ Error fixing user roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error); 