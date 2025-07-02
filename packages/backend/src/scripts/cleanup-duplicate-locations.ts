#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';
import logger from '../utils/logger';

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

async function cleanupDuplicateLocations() {
  try {
    logger.info('Starting duplicate location cleanup and province normalization...');
    
    // Get all Canadian locations
    const canadianLocations = await prisma.location.findMany({
      where: {
        country: 'Canada',
      },
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
      orderBy: [
        { city: 'asc' },
        { province: 'asc' },
      ],
    });
    
    logger.info(`Found ${canadianLocations.length} Canadian locations`);
    
    // Group locations by city to find duplicates
    const locationsByCity = canadianLocations.reduce((acc, location) => {
      if (!acc[location.city]) {
        acc[location.city] = [];
      }
      acc[location.city].push(location);
      return acc;
    }, {} as Record<string, typeof canadianLocations>);
    
    let merged = 0;
    let normalized = 0;
    let deleted = 0;
    
    for (const [city, cityLocations] of Object.entries(locationsByCity)) {
      if (cityLocations.length === 1) {
        // Single location - just normalize province if needed
        const location = cityLocations[0];
        const standardProvince = provinceMapping[location.province] || location.province;
        
        if (standardProvince !== location.province) {
          await prisma.location.update({
            where: { id: location.id },
            data: { province: standardProvince },
          });
          logger.info(`Normalized: ${city}, ${location.province} → ${standardProvince}`);
          normalized++;
        }
      } else {
        // Multiple locations for same city - need to merge
        logger.info(`Found ${cityLocations.length} locations for ${city}:`);
        cityLocations.forEach(loc => {
          logger.info(`  - ${loc.province} (${loc.source}, ${loc._count.assets} assets)`);
        });
        
        // Find the best location to keep (prefer Azure AD, then most assets)
        const sortedLocations = cityLocations.sort((a, b) => {
          // Prefer Azure AD source
          if (a.source !== b.source) {
            return a.source === 'AZURE_AD' ? -1 : 1;
          }
          // Then prefer more assets
          return b._count.assets - a._count.assets;
        });
        
        const keepLocation = sortedLocations[0];
        const deleteLocations = sortedLocations.slice(1);
        
        // Normalize the province of the location we're keeping
        const standardProvince = provinceMapping[keepLocation.province] || keepLocation.province;
        
        if (standardProvince !== keepLocation.province) {
          await prisma.location.update({
            where: { id: keepLocation.id },
            data: { province: standardProvince },
          });
          logger.info(`Normalized kept location: ${city}, ${keepLocation.province} → ${standardProvince}`);
          normalized++;
        }
        
                 // Move any assets from deleted locations to the kept location
         for (const deleteLocation of deleteLocations) {
           try {
             if (deleteLocation._count.assets > 0) {
               await prisma.asset.updateMany({
                 where: { locationId: deleteLocation.id },
                 data: { locationId: keepLocation.id },
               });
               logger.info(`Moved ${deleteLocation._count.assets} assets from duplicate location`);
             }
             
             // Delete the duplicate location
             await prisma.location.delete({
               where: { id: deleteLocation.id },
             });
             logger.info(`Deleted duplicate: ${city}, ${deleteLocation.province}`);
             deleted++;
           } catch (error) {
             logger.error(`Error deleting duplicate location ${city}, ${deleteLocation.province}:`, error);
           }
         }
        
        logger.info(`Kept: ${city}, ${standardProvince} (${keepLocation.source})`);
        merged++;
      }
    }
    
    logger.info(`Cleanup completed: ${merged} cities merged, ${normalized} provinces normalized, ${deleted} duplicates deleted`);
    
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
    
    logger.info(`Final Canadian locations: ${finalLocations.length} total`);
    for (const [province, locations] of Object.entries(finalGroups)) {
      logger.info(`  ${province}: ${locations.length} locations`);
      locations.forEach(loc => {
        logger.info(`    - ${loc.city} (${loc.source})`);
      });
    }
    
  } catch (error) {
    logger.error('Failed to cleanup duplicate locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when script is executed directly
const isMainModule = process.argv[1]?.includes('cleanup-duplicate-locations');
if (isMainModule) {
  cleanupDuplicateLocations()
    .then(() => {
      logger.info('Duplicate location cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Duplicate location cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateLocations }; 