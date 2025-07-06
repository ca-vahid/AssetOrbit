import prisma from '../services/database';

export async function matchLocations(locationStrings: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  const uniques = Array.from(new Set(locationStrings.map(s => (s || '').trim()).filter(Boolean)));
  if (uniques.length === 0) return result;

  const dbLocations = await prisma.location.findMany({ where: { isActive: true } });

  uniques.forEach(locStr => {
    const normalized = locStr.toLowerCase();
    const match = dbLocations.find(loc => {
      const candidate = `${loc.city} ${loc.province}`.toLowerCase();
      return candidate.includes(normalized) || normalized.includes(candidate);
    });
    result[locStr] = match ? match.id : null;
  });

  return result;
} 