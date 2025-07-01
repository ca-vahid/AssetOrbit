import { PrismaClient } from '../src/generated/prisma';
import { 
  USER_ROLES, 
  ASSET_TYPES, 
  ASSET_STATUSES, 
  ASSET_CONDITIONS 
} from '../src/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.assetTicket.deleteMany();
  await prisma.customFieldValue.deleteMany();
  await prisma.customField.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.location.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  // Create Departments
  const departments = await Promise.all([
    prisma.department.create({
      data: {
        name: 'IT',
        description: 'Information Technology Department',
      },
    }),
    prisma.department.create({
      data: {
        name: 'Sales',
        description: 'Sales Department',
      },
    }),
    prisma.department.create({
      data: {
        name: 'Marketing',
        description: 'Marketing Department',
      },
    }),
    prisma.department.create({
      data: {
        name: 'Engineering',
        description: 'Engineering Department',
      },
    }),
    prisma.department.create({
      data: {
        name: 'HR',
        description: 'Human Resources Department',
      },
    }),
  ]);

  // Create Locations
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        name: 'HQ - Floor 1',
        building: 'Headquarters',
        floor: '1',
        address: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        postalCode: '98101',
      },
    }),
    prisma.location.create({
      data: {
        name: 'HQ - Floor 2',
        building: 'Headquarters',
        floor: '2',
        address: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        postalCode: '98101',
      },
    }),
    prisma.location.create({
      data: {
        name: 'Storage Room',
        building: 'Warehouse',
        room: 'SR-101',
        address: '456 Storage Blvd',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        postalCode: '98102',
      },
    }),
  ]);

  // Create Vendors
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        name: 'Dell Technologies',
        contactName: 'John Smith',
        email: 'sales@dell.com',
        phone: '1-800-999-3355',
        website: 'https://www.dell.com',
      },
    }),
    prisma.vendor.create({
      data: {
        name: 'Lenovo',
        contactName: 'Jane Doe',
        email: 'sales@lenovo.com',
        phone: '1-855-253-6686',
        website: 'https://www.lenovo.com',
      },
    }),
    prisma.vendor.create({
      data: {
        name: 'HP Inc.',
        contactName: 'Bob Johnson',
        email: 'sales@hp.com',
        phone: '1-800-474-6836',
        website: 'https://www.hp.com',
      },
    }),
  ]);

  // Create Users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        azureAdId: 'admin-azure-id',
        email: 'admin@company.com',
        displayName: 'Admin User',
        givenName: 'Admin',
        surname: 'User',
        jobTitle: 'IT Administrator',
        department: 'IT',
        role: USER_ROLES.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        azureAdId: 'john-azure-id',
        email: 'john.doe@company.com',
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
        jobTitle: 'Software Engineer',
        department: 'Engineering',
        role: USER_ROLES.WRITE,
      },
    }),
    prisma.user.create({
      data: {
        azureAdId: 'jane-azure-id',
        email: 'jane.smith@company.com',
        displayName: 'Jane Smith',
        givenName: 'Jane',
        surname: 'Smith',
        jobTitle: 'Sales Manager',
        department: 'Sales',
        role: USER_ROLES.READ,
      },
    }),
    prisma.user.create({
      data: {
        azureAdId: 'bob-azure-id',
        email: 'bob.wilson@company.com',
        displayName: 'Bob Wilson',
        givenName: 'Bob',
        surname: 'Wilson',
        jobTitle: 'Marketing Specialist',
        department: 'Marketing',
        role: USER_ROLES.READ,
      },
    }),
  ]);

  const adminUser = users[0];

  // Create Custom Field Definitions
  const customFields = await Promise.all([
    prisma.customField.create({
      data: {
        name: 'Processor',
        fieldType: 'SINGLE_SELECT',
        options: JSON.stringify([
          'Intel Core i5',
          'Intel Core i7',
          'Intel Core i9',
          'AMD Ryzen 5',
          'AMD Ryzen 7',
          'AMD Ryzen 9',
          'Apple M1',
          'Apple M1 Pro',
          'Apple M1 Max',
          'Apple M1 Ultra',
          'Apple M2',
          'Apple M2 Pro',
          'Apple M2 Max',
          'Apple M2 Ultra',
        ]),
      },
    }),
    prisma.customField.create({
      data: {
        name: 'Memory (RAM)',
        fieldType: 'NUMBER',
      },
    }),
    prisma.customField.create({
      data: {
        name: 'Hard Drive Space',
        fieldType: 'NUMBER',
      },
    }),
    prisma.customField.create({
      data: {
        name: 'Video Card (GPU)',
        fieldType: 'STRING',
      },
    }),
    prisma.customField.create({
      data: {
        name: 'Classification',
        fieldType: 'SINGLE_SELECT',
        options: JSON.stringify([
          'High-end',
          'Senior',
          'GIS',
          'CAD',
          'Regular',
          'Field Laptop',
        ]),
      },
    }),
    prisma.customField.create({
      data: {
        name: 'Track About Number',
        fieldType: 'STRING',
      },
    }),
  ]);

  // Create sample laptop specifications
  const laptopSpecs = [
    {
      processor: 'Intel Core i7-1165G7',
      ram: '16GB DDR4',
      storage: '512GB NVMe SSD',
      display: '14" FHD',
      graphics: 'Intel Iris Xe',
      os: 'Windows 11 Pro',
    },
    {
      processor: 'Intel Core i5-1135G7',
      ram: '8GB DDR4',
      storage: '256GB NVMe SSD',
      display: '13.3" FHD',
      graphics: 'Intel Iris Xe',
      os: 'Windows 11 Pro',
    },
    {
      processor: 'AMD Ryzen 7 5800U',
      ram: '16GB DDR4',
      storage: '1TB NVMe SSD',
      display: '15.6" FHD',
      graphics: 'AMD Radeon Graphics',
      os: 'Windows 11 Pro',
    },
  ];

  // Create Assets
  const assetData = [
    // Assigned laptops
    {
      assetTag: 'LT-001',
      assetType: ASSET_TYPES.LAPTOP,
      status: ASSET_STATUSES.ASSIGNED,
      condition: ASSET_CONDITIONS.GOOD,
      make: 'Dell',
      model: 'Latitude 5420',
      serialNumber: 'DL5420001',
      specifications: JSON.stringify(laptopSpecs[0]),
      assignedToId: users[1].id,
      departmentId: departments[3].id, // Engineering
      locationId: locations[0].id,
      purchaseDate: new Date('2023-06-15'),
      purchasePrice: 1299.99,
      vendorId: vendors[0].id,
      warrantyStartDate: new Date('2023-06-15'),
      warrantyEndDate: new Date('2026-06-15'),
      createdById: adminUser.id,
    },
    {
      assetTag: 'LT-002',
      assetType: ASSET_TYPES.LAPTOP,
      status: ASSET_STATUSES.ASSIGNED,
      condition: ASSET_CONDITIONS.NEW,
      make: 'Lenovo',
      model: 'ThinkPad X1 Carbon',
      serialNumber: 'LT002X1C',
      specifications: JSON.stringify(laptopSpecs[2]),
      assignedToId: users[2].id,
      departmentId: departments[1].id, // Sales
      locationId: locations[1].id,
      purchaseDate: new Date('2024-01-10'),
      purchasePrice: 1899.99,
      vendorId: vendors[1].id,
      warrantyStartDate: new Date('2024-01-10'),
      warrantyEndDate: new Date('2027-01-10'),
      createdById: adminUser.id,
    },
    // Available laptops
    {
      assetTag: 'LT-003',
      assetType: ASSET_TYPES.LAPTOP,
      status: ASSET_STATUSES.AVAILABLE,
      condition: ASSET_CONDITIONS.GOOD,
      make: 'HP',
      model: 'EliteBook 840 G8',
      serialNumber: 'HP840G8003',
      specifications: JSON.stringify(laptopSpecs[1]),
      departmentId: departments[0].id, // IT
      locationId: locations[2].id, // Storage
      purchaseDate: new Date('2023-09-20'),
      purchasePrice: 1099.99,
      vendorId: vendors[2].id,
      warrantyStartDate: new Date('2023-09-20'),
      warrantyEndDate: new Date('2026-09-20'),
      createdById: adminUser.id,
    },
    {
      assetTag: 'LT-004',
      assetType: ASSET_TYPES.LAPTOP,
      status: ASSET_STATUSES.AVAILABLE,
      condition: ASSET_CONDITIONS.NEW,
      make: 'Dell',
      model: 'XPS 13',
      serialNumber: 'DLXPS13004',
      specifications: JSON.stringify(laptopSpecs[0]),
      departmentId: departments[0].id, // IT
      locationId: locations[2].id, // Storage
      purchaseDate: new Date('2024-02-01'),
      purchasePrice: 1599.99,
      vendorId: vendors[0].id,
      warrantyStartDate: new Date('2024-02-01'),
      warrantyEndDate: new Date('2027-02-01'),
      createdById: adminUser.id,
    },
    // Spare laptop
    {
      assetTag: 'LT-005',
      assetType: ASSET_TYPES.LAPTOP,
      status: ASSET_STATUSES.SPARE,
      condition: ASSET_CONDITIONS.FAIR,
      make: 'Lenovo',
      model: 'ThinkPad T14',
      serialNumber: 'LTT14005',
      specifications: JSON.stringify(laptopSpecs[1]),
      departmentId: departments[0].id, // IT
      locationId: locations[2].id, // Storage
      purchaseDate: new Date('2022-11-15'),
      purchasePrice: 999.99,
      vendorId: vendors[1].id,
      warrantyStartDate: new Date('2022-11-15'),
      warrantyEndDate: new Date('2025-11-15'),
      notes: 'Spare laptop for temporary use. Has minor scratches on the lid.',
      createdById: adminUser.id,
    },
    // Maintenance laptop
    {
      assetTag: 'LT-006',
      assetType: ASSET_TYPES.LAPTOP,
      status: ASSET_STATUSES.MAINTENANCE,
      condition: ASSET_CONDITIONS.POOR,
      make: 'HP',
      model: 'ProBook 450 G7',
      serialNumber: 'HPPB450006',
      specifications: JSON.stringify(laptopSpecs[1]),
      departmentId: departments[0].id, // IT
      locationId: locations[2].id, // Storage
      purchaseDate: new Date('2021-05-20'),
      purchasePrice: 799.99,
      vendorId: vendors[2].id,
      warrantyStartDate: new Date('2021-05-20'),
      warrantyEndDate: new Date('2024-05-20'),
      notes: 'Keyboard not working properly. Sent for repair.',
      createdById: adminUser.id,
    },
  ];

  // Create assets
  const assets = await Promise.all(
    assetData.map((data) => prisma.asset.create({ data }))
  );

  // Create some sample tickets
  await Promise.all([
    prisma.assetTicket.create({
      data: {
        assetId: assets[5].id, // Maintenance laptop
        ticketNumber: 'INC0001234',
        ticketSystem: 'Freshservice',
        title: 'Keyboard malfunction',
        description: 'Several keys on the keyboard are not responding',
        status: 'Open',
        priority: 'Medium',
      },
    }),
    prisma.assetTicket.create({
      data: {
        assetId: assets[0].id,
        ticketNumber: 'INC0001100',
        ticketSystem: 'Freshservice',
        title: 'Software installation request',
        description: 'User requested Visual Studio Code installation',
        status: 'Closed',
        priority: 'Low',
      },
    }),
  ]);

  // Create some activity logs
  await Promise.all([
    prisma.activityLog.create({
      data: {
        assetId: assets[0].id,
        userId: adminUser.id,
        action: 'CREATE',
        entityType: 'ASSET',
        entityId: assets[0].id,
        changes: JSON.stringify({ action: 'Asset created' }),
      },
    }),
    prisma.activityLog.create({
      data: {
        assetId: assets[0].id,
        userId: adminUser.id,
        action: 'ASSIGN',
        entityType: 'ASSET',
        entityId: assets[0].id,
        changes: JSON.stringify({ 
          assignedTo: { 
            from: null, 
            to: users[1].email 
          } 
        }),
      },
    }),
  ]);

  console.log('Database seeded successfully!');
  console.log(`Created ${users.length} users`);
  console.log(`Created ${departments.length} departments`);
  console.log(`Created ${locations.length} locations`);
  console.log(`Created ${vendors.length} vendors`);
  console.log(`Created ${assets.length} assets`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 