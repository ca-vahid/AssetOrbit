#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';
import logger from '../utils/logger';

const prisma = new PrismaClient();

async function cleanupSampleLocations() {
  try {
    logger.info('Starting cleanup of sample/manual locations...');
    
    // First, let's see what we have
    const allLocations = await prisma.location.findMany({
      orderBy: [
        { source: 'asc' },
        { country: 'asc' },
        { province: 'asc' },
        { city: 'asc' },
      ],
    });
    
    logger.info(`Total locations before cleanup: ${allLocations.length}`);
    
    // Group by source for reporting
    const locationsBySource = allLocations.reduce((acc, location) => {
      if (!acc[location.source]) {
        acc[location.source] = [];
      }
      acc[location.source].push(location);
      return acc;
    }, {} as Record<string, typeof allLocations>);
    
    for (const [source, locations] of Object.entries(locationsBySource)) {
      logger.info(`${source}: ${locations.length} locations`);
      locations.slice(0, 5).forEach(loc => {
        logger.info(`  - ${loc.city}, ${loc.province}, ${loc.country}`);
      });
      if (locations.length > 5) {
        logger.info(`  ... and ${locations.length - 5} more`);
      }
    }
    
    // Check if any assets are assigned to manual locations
    const manualLocationsWithAssets = await prisma.location.findMany({
      where: {
        source: 'MANUAL',
      },
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
    });
    
    const locationsWithAssets = manualLocationsWithAssets.filter(loc => loc._count.assets > 0);
    
    if (locationsWithAssets.length > 0) {
      logger.warn(`Found ${locationsWithAssets.length} manual locations with assigned assets:`);
      locationsWithAssets.forEach(loc => {
        logger.warn(`  - ${loc.city}, ${loc.province}: ${loc._count.assets} assets`);
      });
      
      // Ask for confirmation (in a real scenario, you might want to handle this differently)
      logger.warn('These locations have assets assigned. Proceeding will unassign them.');
    }
    
    // Delete all manual locations
    const deleteResult = await prisma.location.deleteMany({
      where: {
        source: 'MANUAL',
      },
    });
    
    logger.info(`Deleted ${deleteResult.count} manual/sample locations`);
    
    // Show final state
    const remainingLocations = await prisma.location.findMany({
      orderBy: [
        { country: 'asc' },
        { province: 'asc' },
        { city: 'asc' },
      ],
    });
    
    logger.info(`Total locations after cleanup: ${remainingLocations.length}`);
    
    // Group remaining by country for display
    const remainingByCountry = remainingLocations.reduce((acc, location) => {
      if (!acc[location.country]) {
        acc[location.country] = [];
      }
      acc[location.country].push(location);
      return acc;
    }, {} as Record<string, typeof remainingLocations>);
    
    for (const [country, locations] of Object.entries(remainingByCountry)) {
      logger.info(`${country}: ${locations.length} locations (all from Azure AD)`);
      locations.slice(0, 5).forEach(loc => {
        logger.info(`  - ${loc.city}, ${loc.province}`);
      });
      if (locations.length > 5) {
        logger.info(`  ... and ${locations.length - 5} more`);
      }
    }
    
    // Summary
    logger.info(`Cleanup completed successfully!`);
    logger.info(`- Removed: ${deleteResult.count} manual locations`);
    logger.info(`- Remaining: ${remainingLocations.length} Azure AD locations`);
    
  } catch (error) {
    logger.error('Failed to cleanup sample locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when script is executed directly (not imported)
const isMainModule = process.argv[1]?.includes('cleanup-sample-locations');
if (isMainModule) {
  cleanupSampleLocations()
    .then(() => {
      logger.info('Sample locations cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Sample locations cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupSampleLocations }; 