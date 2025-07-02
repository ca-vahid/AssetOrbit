import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function migrateDepartmentsToWorkloadCategories() {
  console.log('Starting migration from Departments to Workload Categories...');

  try {
    // Get all departments
    const departments = await prisma.department.findMany({
      include: {
        assets: true,
      },
    });

    console.log(`Found ${departments.length} departments to migrate`);

    for (const dept of departments) {
      console.log(`Migrating department: ${dept.name} (${dept.assets.length} assets)`);

      // Create workload category
      const workloadCategory = await prisma.workloadCategory.create({
        data: {
          name: dept.name,
          description: dept.description || `Migrated from department: ${dept.name}`,
          isActive: dept.isActive,
        },
      });

      console.log(`Created workload category: ${workloadCategory.name}`);

      // Link all assets from this department to the new workload category
      if (dept.assets.length > 0) {
        await prisma.assetWorkloadCategory.createMany({
          data: dept.assets.map((asset) => ({
            assetId: asset.id,
            categoryId: workloadCategory.id,
          })),
        });

        console.log(`Linked ${dept.assets.length} assets to workload category: ${workloadCategory.name}`);
      }
    }

    console.log('Migration completed successfully!');
    console.log('Note: Department data is preserved. You can remove it manually after verifying the migration.');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateDepartmentsToWorkloadCategories()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 