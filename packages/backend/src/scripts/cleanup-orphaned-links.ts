import prisma from '../services/database';
import logger from '../utils/logger';

async function cleanupOrphanedLinks() {
  try {
    logger.info('Cleaning up orphaned ExternalSourceLink records...');
    
    // Get all external source links with their assets
    const links = await (prisma as any).externalSourceLink.findMany({
      include: {
        asset: {
          select: {
            id: true,
            assetTag: true,
            serialNumber: true,
            source: true
          }
        }
      }
    });
    
    logger.info(`Found ${links.length} ExternalSourceLink records`);
    
    let mismatches = 0;
    let deleted = 0;
    
    for (const link of links) {
      // Check if the link's externalId matches the asset's serialNumber
      if (link.externalId !== link.asset.serialNumber) {
        mismatches++;
        logger.warn(`MISMATCH: Link externalId=${link.externalId} but asset ${link.asset.assetTag} has serialNumber=${link.asset.serialNumber}`);
        
        // Check if there's another asset with the link's externalId
        const correctAsset = await prisma.asset.findFirst({
          where: { serialNumber: link.externalId }
        });
        
        if (!correctAsset) {
          // No asset exists with this serial number, delete the orphaned link
          try {
            await (prisma as any).externalSourceLink.delete({
              where: { id: link.id }
            });
            deleted++;
            logger.info(`  -> DELETED orphaned link with externalId=${link.externalId}`);
          } catch (e) {
            logger.error(`  -> Failed to delete link: ${e}`);
          }
        }
      }
    }
    
    logger.info(`Cleanup complete: ${mismatches} mismatches found, ${deleted} orphaned links deleted`);
    
    // Now recreate correct links for assets that have serial numbers
    logger.info('Recreating correct ExternalSourceLink records...');
    
    const assetsWithSerials = await prisma.asset.findMany({
      where: {
        serialNumber: { not: null },
        source: { in: ['ROGERS', 'TELUS', 'NINJAONE', 'NINJAONE_SERVERS'] }
      },
      select: {
        id: true,
        assetTag: true,
        serialNumber: true,
        source: true
      }
    });
    
    let created = 0;
    for (const asset of assetsWithSerials) {
      if (!asset.serialNumber) continue;
      
      // Check if a correct link already exists
      const existingLink = await (prisma as any).externalSourceLink.findFirst({
        where: {
          sourceSystem: asset.source,
          externalId: asset.serialNumber,
          assetId: asset.id
        }
      });
      
      if (!existingLink) {
        // Create the correct link
        try {
          await (prisma as any).externalSourceLink.create({
            data: {
              assetId: asset.id,
              sourceSystem: asset.source,
              externalId: asset.serialNumber,
              isPresent: true
            }
          });
          created++;
          logger.info(`Created link: ${asset.serialNumber} -> ${asset.assetTag}`);
        } catch (e) {
          // Might fail if unique constraint violated
          logger.debug(`Could not create link for ${asset.assetTag}: ${e}`);
        }
      }
    }
    
    logger.info(`Created ${created} new correct links`);
    
  } catch (error) {
    logger.error('Failed to cleanup ExternalSourceLinks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupOrphanedLinks();
