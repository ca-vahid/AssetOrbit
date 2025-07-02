#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';
import logger from '../utils/logger';

const prisma = new PrismaClient();

async function mergeDuplicateCities() {
  try {
    logger.info('Starting duplicate city merger...');
    
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
    
    // Group by city to find duplicates
    const citiesMap = new Map<string, typeof canadianLocations>();
    
    canadianLocations.forEach(location => {
      const cityKey = location.city.toLowerCase();
      if (!citiesMap.has(cityKey)) {
        citiesMap.set(cityKey, []);
      }
      citiesMap.get(cityKey)!.push(location);
    });
    
    let mergedCities = 0;
    let deletedDuplicates = 0;
    
    for (const [cityKey, cityLocations] of citiesMap.entries()) {
      if (cityLocations.length > 1) {
        logger.info(`\nFound ${cityLocations.length} entries for ${cityLocations[0].city}:`);
        cityLocations.forEach(loc => {
          logger.info(`  - ${loc.province} (${loc.source}, ${loc._count.assets} assets, ${loc.isActive ? 'active' : 'inactive'})`);
        });
        
        // Sort to prefer: 1) Active over inactive, 2) Clean province format (AB vs CA-AB), 3) More assets
        const sortedLocations = cityLocations.sort((a, b) => {
          // First, prefer active locations
          if (a.isActive !== b.isActive) {
            return a.isActive ? -1 : 1;
          }
          
          // Then prefer cleaner province format (shorter = better)
          if (a.province.length !== b.province.length) {
            return a.province.length - b.province.length;
          }
          
          // Then prefer more assets
          return b._count.assets - a._count.assets;
        });
        
        const keepLocation = sortedLocations[0];
        const deleteLocations = sortedLocations.slice(1);
        
        logger.info(`  → Keeping: ${keepLocation.province} (${keepLocation.source}, ${keepLocation._count.assets} assets, ${keepLocation.isActive ? 'active' : 'inactive'})`);
        
        // Move assets from duplicate locations to the kept location
        for (const deleteLocation of deleteLocations) {
          try {
            if (deleteLocation._count.assets > 0) {
              const updateResult = await prisma.asset.updateMany({
                where: { locationId: deleteLocation.id },
                data: { locationId: keepLocation.id },
              });
              logger.info(`    Moved ${updateResult.count} assets from ${deleteLocation.province}`);
            }
            
            // Delete the duplicate
            await prisma.location.delete({
              where: { id: deleteLocation.id },
            });
            logger.info(`    Deleted: ${deleteLocation.province}`);
            deletedDuplicates++;
          } catch (error) {
            logger.error(`    Error processing ${deleteLocation.province}:`, error);
          }
        }
        
        mergedCities++;
      }
    }
    
    logger.info(`\nMerge completed: ${mergedCities} cities processed, ${deletedDuplicates} duplicates removed`);
    
    // Show final clean state
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
    
    logger.info(`\nFinal Canadian locations: ${finalLocations.length} total`);
    for (const [province, locations] of Object.entries(provinceGroups)) {
      logger.info(`  ${province}: ${locations.length} locations`);
      locations.forEach(loc => {
        logger.info(`    - ${loc.city} (${loc.source})`);
      });
    }
    
  } catch (error) {
    logger.error('Failed to merge duplicate cities:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when script is executed directly
const isMainModule = process.argv[1]?.includes('merge-duplicate-cities');
if (isMainModule) {
  mergeDuplicateCities()
    .then(() => {
      logger.info('Duplicate city merger completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Duplicate city merger failed:', error);
      process.exit(1);
    });
}

export { mergeDuplicateCities }; 