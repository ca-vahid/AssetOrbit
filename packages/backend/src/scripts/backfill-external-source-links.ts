import prisma from '../services/database';
import logger from '../utils/logger';

// One-time backfill: create ExternalSourceLink entries for existing assets
// Supported sources: NINJAONE, NINJAONE_SERVERS, TELUS, ROGERS

async function main() {
  const supportedSources = new Set(['NINJAONE', 'NINJAONE_SERVERS', 'TELUS', 'ROGERS']);
  const now = new Date();

  const assets = await prisma.asset.findMany({
    where: {
      source: { in: Array.from(supportedSources) },
      serialNumber: { not: null }
    },
    select: { id: true, assetTag: true, source: true, serialNumber: true }
  });

  logger.info(`Backfill: found ${assets.length} assets with supported sources and serial numbers.`);

  let created = 0;
  let updated = 0;
  for (const a of assets) {
    try {
      await (prisma as any).externalSourceLink.upsert({
        where: { sourceSystem_externalId: { sourceSystem: a.source, externalId: String(a.serialNumber) } },
        update: { assetId: a.id, lastSeenAt: now, isPresent: true },
        create: {
          assetId: a.id,
          sourceSystem: a.source,
          externalId: String(a.serialNumber),
          firstSeenAt: now,
          lastSeenAt: now,
          isPresent: true
        }
      });
      // upsert may create or update; we approximate by checking existence after the fact if needed
      // For simplicity, count as updated if link already existed
      updated++;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // Unique constraint violation; treat as updated
        updated++;
      } else {
        logger.warn(`Failed to upsert link for asset ${a.id} (${a.assetTag})`, e);
      }
    }
  }

  logger.info(`Backfill complete. Created/Updated links: ${created + updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



