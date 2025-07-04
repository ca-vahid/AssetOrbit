#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

// Province mapping from Azure AD formats to standardized format
const provinceMapping: Record<string, string> = {
  // Azure AD formats to standard abbreviations
  'CA-AB': 'AB',
  'CA-BC': 'BC', 
  'CA-MB': 'MB',
  'CA-NB': 'NB',
  'CA-NL': 'NL',
  'CA-NS': 'NS',
  'CA-NT': 'NT',
  'CA-NU': 'NU',
  'CA-ON': 'ON',
  'CA-PE': 'PE',
  'CA-QC': 'QC',
  'CA-SK': 'SK',
  'CA-YT': 'YT',
  
  // Full names to abbreviations
  'Alberta': 'AB',
  'British Columbia': 'BC',
  'Manitoba': 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Nova Scotia': 'NS',
  'Northwest Territories': 'NT',
  'Nunavut': 'NU',
  'Ontario': 'ON',
  'Prince Edward Island': 'PE',
  'Quebec': 'QC',
  'Saskatchewan': 'SK',
  'Yukon': 'YT',
};

async function normalizeProvinces() {
  try {
    logger.info('Starting province normalization...');
    
    // Get all Canadian locations
    const canadianLocations = await prisma.location.findMany({
      where: {
        country: 'Canada',
      },
      orderBy: [
        { province: 'asc' },
        { city: 'asc' },
      ],
    });
    
    logger.info(`Found ${canadianLocations.length} Canadian locations`);
    
    // Group by current province format
    const provinceGroups = canadianLocations.reduce((acc, location) => {
      if (!acc[location.province]) {
        acc[location.province] = [];
      }
      acc[location.province].push(location);
      return acc;
    }, {} as Record<string, typeof canadianLocations>);
    
    logger.info('Current province formats:');
    for (const [province, locations] of Object.entries(provinceGroups)) {
      const standardized = provinceMapping[province] || province;
      logger.info(`  ${province} → ${standardized} (${locations.length} locations)`);
    }
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Update each location
    for (const location of canadianLocations) {
      const standardProvince = provinceMapping[location.province];
      
      if (!standardProvince) {
        logger.warn(`No mapping found for province: ${location.province} (${location.city})`);
        skipped++;
        continue;
      }
      
      if (standardProvince === location.province) {
        // Already in correct format
        skipped++;
        continue;
      }
      
      try {
        // Check if a location with the standardized province already exists
        const existing = await prisma.location.findFirst({
          where: {
            city: location.city,
            province: standardProvince,
            country: location.country,
            id: { not: location.id },
          },
        });
        
        if (existing) {
          logger.warn(`Duplicate would be created: ${location.city}, ${standardProvince}. Skipping ${location.city}, ${location.province}`);
          skipped++;
          continue;
        }
        
        // Update the province
        await prisma.location.update({
          where: { id: location.id },
          data: { province: standardProvince },
        });
        
        logger.info(`Updated: ${location.city}, ${location.province} → ${standardProvince}`);
        updated++;
      } catch (error) {
        logger.error(`Error updating ${location.city}, ${location.province}:`, error);
        errors++;
      }
    }
    
    logger.info(`Province normalization completed: ${updated} updated, ${skipped} skipped, ${errors} errors`);
    
    // Show final state
    const finalLocations = await prisma.location.findMany({
      where: { country: 'Canada' },
      orderBy: [{ province: 'asc' }, { city: 'asc' }],
    });
    
    const finalGroups = finalLocations.reduce((acc, location) => {
      if (!acc[location.province]) {
        acc[location.province] = [];
      }
      acc[location.province].push(location);
      return acc;
    }, {} as Record<string, typeof finalLocations>);
    
    logger.info('Final Canadian province distribution:');
    for (const [province, locations] of Object.entries(finalGroups)) {
      logger.info(`  ${province}: ${locations.length} locations`);
    }
    
  } catch (error) {
    logger.error('Failed to normalize provinces:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when script is executed directly
const isMainModule = process.argv[1]?.includes('normalize-provinces');
if (isMainModule) {
  normalizeProvinces()
    .then(() => {
      logger.info('Province normalization completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Province normalization failed:', error);
      process.exit(1);
    });
}

export { normalizeProvinces }; 