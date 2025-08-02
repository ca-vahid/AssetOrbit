import prisma from '../services/database.js';
import logger from '../utils/logger.js';

// Common location abbreviations and mappings
const locationMappings: Record<string, string[]> = {
  'cal': ['calgary'],
  'van': ['vancouver'],
  'yvr': ['vancouver'],
  'yyz': ['toronto'],
  'tor': ['toronto'],
  'mtl': ['montreal'],
  'ott': ['ottawa'],
  'wpg': ['winnipeg'],
  'edm': ['edmonton'],
  'vic': ['victoria'],
  'hal': ['halifax'],
  'stj': ['st. john\'s', 'st johns'],
};

export async function matchLocations(locationStrings: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  const uniques = Array.from(new Set(locationStrings.map(s => (s || '').trim()).filter(Boolean)));
  if (uniques.length === 0) return result;

  const dbLocations = await prisma.location.findMany({ where: { isActive: true } });
  
  logger.info(`Matching ${uniques.length} locations against ${dbLocations.length} database locations`);

  uniques.forEach(locStr => {
    const normalized = locStr.toLowerCase().trim();
    let match = null;
    let matchReason = '';
    
    // Strategy 1: Exact city name match
    match = dbLocations.find(loc => loc.city.toLowerCase() === normalized);
    if (match) {
      matchReason = `Exact city match: "${normalized}" → "${match.city}"`;
    }
    
    // Strategy 2: Check abbreviation mappings
    if (!match && locationMappings[normalized]) {
      for (const cityName of locationMappings[normalized]) {
        match = dbLocations.find(loc => loc.city.toLowerCase() === cityName);
        if (match) {
          matchReason = `Abbreviation mapping: "${normalized}" → "${cityName}" → "${match.city}"`;
          break;
        }
      }
    }
    
    // Strategy 3: Partial city name match (for longer names)
    if (!match && normalized.length >= 4) {
      match = dbLocations.find(loc => {
        const city = loc.city.toLowerCase();
        return city.includes(normalized) || normalized.includes(city);
      });
      if (match) {
        matchReason = `Partial city match: "${normalized}" ↔ "${match.city}"`;
      }
    }
    
    // Strategy 4: "City, Province" format matching
    if (!match && normalized.includes(',')) {
      const parts = normalized.split(',').map(p => p.trim());
      const cityPart = parts[0];
      const provincePart = parts[1];
      
      match = dbLocations.find(loc => {
        const city = loc.city.toLowerCase();
        const province = loc.province.toLowerCase();
        
        return city === cityPart && (
          province === provincePart ||
          province.startsWith(provincePart) ||
          provincePart.includes(province.substring(0, 2))
        );
      });
      
      if (match) {
        matchReason = `City+Province match: "${cityPart}, ${provincePart}" → "${match.city}, ${match.province}"`;
      }
    }
    
    if (match) {
      logger.info(`✅ ${matchReason}`);
      result[locStr] = match.id;
    } else {
      logger.warn(`❌ No match found for location: "${locStr}"`);
      result[locStr] = null;
    }
  });

  const matched = Object.values(result).filter(v => v !== null).length;
  logger.info(`Location matching complete: ${matched}/${uniques.length} locations matched`);

  return result;
} 