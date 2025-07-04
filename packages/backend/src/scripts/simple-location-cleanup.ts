#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

async function simpleLocationCleanup() {
  try {
    logger.info('Starting simple location cleanup...');
    
    // Get all locations
    const allLocations = await prisma.location.findMany({
      orderBy: [
        { country: 'asc' },
        { city: 'asc' },
        { province: 'asc' },
      ],
    });
    
    logger.info(`Found ${allLocations.length} total locations`);
    
    // Manual cleanup of known duplicates
    const duplicatesToRemove = [
      { city: 'Vancouver', province: 'British Columbia' },
      { city: 'Calgary', province: 'CA-AB' },
      { city: 'Kamloops', province: 'CA-BC' },
      { city: 'Vancouver', province: 'CA-BC' },
      { city: 'Victoria', province: 'CA-BC' },
      { city: 'Fredericton', province: 'CA-NB' },
      { city: 'Halifax', province: 'CA-NS' },
      { city: 'Ottawa', province: 'Ontario' },
      { city: 'Montreal', province: 'Quebec' },
    ];
    
    let deleted = 0;
    
    for (const duplicate of duplicatesToRemove) {
      try {
        const result = await prisma.location.deleteMany({
          where: {
            city: duplicate.city,
            province: duplicate.province,
            country: 'Canada',
          },
        });
        
        if (result.count > 0) {
          logger.info(`Deleted ${result.count} duplicate(s): ${duplicate.city}, ${duplicate.province}`);
          deleted += result.count;
        }
      } catch (error) {
        logger.error(`Error deleting ${duplicate.city}, ${duplicate.province}:`, error);
      }
    }
    
    // Normalize remaining Canadian provinces
    const provinceMappings = [
      { from: 'CA-AB', to: 'AB' },
      { from: 'CA-BC', to: 'BC' },
      { from: 'CA-ON', to: 'ON' },
      { from: 'CA-QC', to: 'QC' },
      { from: 'CA-NB', to: 'NB' },
      { from: 'CA-NS', to: 'NS' },
    ];
    
    let normalized = 0;
    
    for (const mapping of provinceMappings) {
      try {
        const result = await prisma.location.updateMany({
          where: {
            province: mapping.from,
            country: 'Canada',
          },
          data: {
            province: mapping.to,
          },
        });
        
        if (result.count > 0) {
          logger.info(`Normalized ${result.count} location(s): ${mapping.from} → ${mapping.to}`);
          normalized += result.count;
        }
      } catch (error) {
        logger.error(`Error normalizing ${mapping.from} → ${mapping.to}:`, error);
      }
    }
    
    logger.info(`Simple cleanup completed: ${deleted} deleted, ${normalized} normalized`);
    
    // Show final state
    const finalLocations = await prisma.location.findMany({
      where: { country: 'Canada' },
      orderBy: [{ province: 'asc' }, { city: 'asc' }],
    });
    
    const provinceGroups = finalLocations.reduce((acc, location) => {
      if (!acc[location.province]) {
        acc[location.province] = [];
      }
      acc[location.province].push(location);
      return acc;
    }, {} as Record<string, typeof finalLocations>);
    
    logger.info(`Final Canadian locations: ${finalLocations.length} total`);
    for (const [province, locations] of Object.entries(provinceGroups)) {
      logger.info(`  ${province}: ${locations.length} locations`);
    }
    
  } catch (error) {
    logger.error('Failed to cleanup locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when script is executed directly
const isMainModule = process.argv[1]?.includes('simple-location-cleanup');
if (isMainModule) {
  simpleLocationCleanup()
    .then(() => {
      logger.info('Simple location cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Simple location cleanup failed:', error);
      process.exit(1);
    });
}

export { simpleLocationCleanup }; 