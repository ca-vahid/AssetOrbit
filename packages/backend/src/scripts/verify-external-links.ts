import prisma from '../services/database';
import logger from '../utils/logger';

async function verifyExternalSourceLinks() {
  try {
    logger.info('Verifying ExternalSourceLink integrity...');
    
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
    let fixed = 0;
    
    for (const link of links) {
      // Check if the link's externalId matches the asset's serialNumber
      if (link.externalId !== link.asset.serialNumber) {
        mismatches++;
        logger.warn(`MISMATCH: Link externalId=${link.externalId} but asset ${link.asset.assetTag} has serialNumber=${link.asset.serialNumber}`);
        
        // Find the correct asset with this serial number
        const correctAsset = await prisma.asset.findFirst({
          where: { serialNumber: link.externalId }
        });
        
        if (correctAsset) {
          logger.info(`  -> Found correct asset: ${correctAsset.assetTag} (${correctAsset.id})`);
          
          // Fix the link to point to the correct asset
          try {
            await (prisma as any).externalSourceLink.update({
              where: { id: link.id },
              data: { assetId: correctAsset.id }
            });
            fixed++;
            logger.info(`  -> FIXED: Link now points to correct asset ${correctAsset.assetTag}`);
          } catch (e) {
            logger.error(`  -> Failed to fix link: ${e}`);
          }
        } else {
          logger.warn(`  -> No asset found with serialNumber=${link.externalId}`);
        }
      }
    }
    
    logger.info(`Verification complete: ${mismatches} mismatches found, ${fixed} fixed`);
    
  } catch (error) {
    logger.error('Failed to verify ExternalSourceLinks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyExternalSourceLinks();
