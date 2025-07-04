#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma/index.js';
import { graphService } from '../services/graphService.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

async function syncLocationsFromAzureAD() {
  try {
    logger.info('Starting location sync from Azure AD...');
    
    // Fetch distinct locations from Azure AD
    const azureLocations = await graphService.getDistinctLocations();
    logger.info(`Found ${azureLocations.length} distinct locations in Azure AD`);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const location of azureLocations) {
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
          logger.debug(`Location already exists: ${location.city}, ${location.province}, ${location.country}`);
          skipped++;
          continue;
        }
        
        // Create new location
        await prisma.location.create({
          data: {
            city: location.city,
            province: location.province,
            country: location.country,
            source: 'AZURE_AD',
            isActive: true,
          },
        });
        
        logger.info(`Created location: ${location.city}, ${location.province}, ${location.country}`);
        created++;
      } catch (error) {
        logger.error(`Error creating location ${location.city}, ${location.province}:`, error);
        errors++;
      }
    }
    
    logger.info(`Location sync completed: ${created} created, ${skipped} skipped, ${errors} errors`);
    
    // Display summary of all locations in database
    const allLocations = await prisma.location.findMany({
      orderBy: [
        { country: 'asc' },
        { province: 'asc' },
        { city: 'asc' },
      ],
    });
    
    logger.info(`Total locations in database: ${allLocations.length}`);
    
    // Group by country for display
    const locationsByCountry = allLocations.reduce((acc, location) => {
      if (!acc[location.country]) {
        acc[location.country] = [];
      }
      acc[location.country].push(location);
      return acc;
    }, {} as Record<string, typeof allLocations>);
    
    for (const [country, locations] of Object.entries(locationsByCountry)) {
      logger.info(`${country}: ${locations.length} locations`);
      locations.slice(0, 5).forEach(loc => {
        logger.info(`  - ${loc.city}, ${loc.province} (${loc.source})`);
      });
      if (locations.length > 5) {
        logger.info(`  ... and ${locations.length - 5} more`);
      }
    }
    
  } catch (error) {
    logger.error('Failed to sync locations from Azure AD:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when script is executed directly (not imported)
const isMainModule = process.argv[1]?.includes('sync-locations');
if (isMainModule) {
  syncLocationsFromAzureAD()
    .then(() => {
      logger.info('Location sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Location sync failed:', error);
      process.exit(1);
    });
}

export { syncLocationsFromAzureAD }; 