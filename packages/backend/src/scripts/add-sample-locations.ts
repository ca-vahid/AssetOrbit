#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';
import logger from '../utils/logger';

const prisma = new PrismaClient();

const sampleLocations = [
  { city: 'Toronto', province: 'Ontario', country: 'Canada' },
  { city: 'Vancouver', province: 'British Columbia', country: 'Canada' },
  { city: 'Montreal', province: 'Quebec', country: 'Canada' },
  { city: 'Calgary', province: 'Alberta', country: 'Canada' },
  { city: 'Ottawa', province: 'Ontario', country: 'Canada' },
  { city: 'Edmonton', province: 'Alberta', country: 'Canada' },
  { city: 'Mississauga', province: 'Ontario', country: 'Canada' },
  { city: 'Winnipeg', province: 'Manitoba', country: 'Canada' },
  { city: 'Halifax', province: 'Nova Scotia', country: 'Canada' },
  { city: 'Regina', province: 'Saskatchewan', country: 'Canada' },
];

async function addSampleLocations() {
  try {
    logger.info('Adding sample locations...');
    
    let created = 0;
    let skipped = 0;
    
    for (const location of sampleLocations) {
      try {
        // Check if location already exists
        const existing = await prisma.location.findFirst({
          where: {
            city: location.city,
            province: location.province,
            country: location.country,
          },
        });
        
        if (existing) {
          logger.debug(`Location already exists: ${location.city}, ${location.province}`);
          skipped++;
          continue;
        }
        
        // Create new location
        await prisma.location.create({
          data: {
            city: location.city,
            province: location.province,
            country: location.country,
            source: 'MANUAL',
            isActive: true,
          },
        });
        
        logger.info(`Created location: ${location.city}, ${location.province}`);
        created++;
      } catch (error) {
        logger.error(`Error creating location ${location.city}, ${location.province}:`, error);
      }
    }
    
    logger.info(`Sample locations added: ${created} created, ${skipped} skipped`);
    
    // Display all locations
    const allLocations = await prisma.location.findMany({
      orderBy: [
        { province: 'asc' },
        { city: 'asc' },
      ],
    });
    
    logger.info(`Total locations in database: ${allLocations.length}`);
    allLocations.forEach(loc => {
      logger.info(`  - ${loc.city}, ${loc.province} (${loc.source})`);
    });
    
  } catch (error) {
    logger.error('Failed to add sample locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when script is executed directly (not imported)
const isMainModule = process.argv[1]?.includes('add-sample-locations');
if (isMainModule) {
  addSampleLocations()
    .then(() => {
      logger.info('Sample locations added successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Failed to add sample locations:', error);
      process.exit(1);
    });
}

export { addSampleLocations }; 