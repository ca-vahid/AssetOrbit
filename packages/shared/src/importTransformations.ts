/**
 * Shared Import Transformation Utilities
 * 
 * This module contains all transformation logic for import processing.
 * Used by both frontend (preview) and backend (actual import) to ensure consistency.
 * Each import source should have its own transformation module that uses these utilities.
 */

// ============================================================================
// CORE TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Convert various date strings (or Excel serial numbers) to ISO 8601 string
 */
export function toISO(value: string): string | null {
  if (!value) return null;

  // Excel serial number (positive integer)
  if (/^\d+$/.test(value)) {
    const serial = parseInt(value, 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch (1900-01-00)
    const iso = new Date(excelEpoch.getTime() + serial * 86400000).toISOString();
    return iso;
  }

  // Add missing colon in timezone offset, e.g. "-0700" -> "-07:00"
  const cleaned = value.replace(/([\+\-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Round storage capacity in GiB to common commercial sizes
 */
export function roundToCommonStorageSize(gib: number): string {
  if (gib > 1800) return '2 TB';
  if (gib > 900) return '1 TB';
  if (gib > 450) return '512 GB';
  if (gib > 230) return '256 GB';
  if (gib > 110) return '128 GB';
  if (gib > 55) return '64 GB';
  if (gib > 28) return '32 GB';
  if (gib > 14) return '16 GB';
  if (gib > 6) return '8 GB';
  return `${Math.round(gib)} GB`;
}

/**
 * Simplify raw memory value in GiB to nearest common size label
 */
export function simplifyRam(value: string): string | null {
  if (!value) return null;
  const gib = parseFloat(value);
  if (isNaN(gib)) return null;

  if (gib > 120) return '128 GB';
  if (gib > 90) return '96 GB';
  if (gib > 60) return '64 GB';
  if (gib > 30) return '32 GB';
  if (gib > 14) return '16 GB';
  if (gib > 6) return '8 GB';
  if (gib > 2) return '4 GB';
  return `${Math.round(gib)} GB`;
}

/**
 * Aggregate NinjaOne "Volumes" column into a single rounded storage size label
 */
export function aggregateVolumes(value: string): string | null {
  if (!value) return null;
  const volumeRegex = /Type: "(.*?)"(?:[^\(]*)\((\d+\.?\d*)\s*GiB\)/g;
  let totalGib = 0;
  let match: RegExpExecArray | null;

  while ((match = volumeRegex.exec(value)) !== null) {
    const type = match[1];
    const capacity = parseFloat(match[2]);
    // Skip removable disks – we only want local storage
    if (type.toLowerCase() !== 'removable disk') {
      totalGib += capacity;
    }
  }

  return totalGib > 0 ? roundToCommonStorageSize(totalGib) : null;
}

/**
 * Parse device names to extract make, model, and storage for phone imports
 */
export function parseDeviceName(deviceName: string): { make: string; model: string; storage?: string } {
  if (!deviceName) {
    return { make: 'Unknown', model: 'Unknown' };
  }

  // Strip common noise prefixes first
  let normalized = deviceName.trim().toUpperCase();
  if (normalized.startsWith('SWAP ')) {
    normalized = normalized.substring(5);
  }

  // Helper to extract storage token and remove it from the string
  const storageMatch = normalized.match(/(\d+)(?:GB|TB)/);
  const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
  if (storageMatch) {
    normalized = normalized.replace(storageMatch[0], '').trim();
  }

  // Apple iPhone patterns
  if (normalized.includes('IPHONE')) {
    const make = 'Apple';
    
    // Extract iPhone model (e.g., "IPHONE 14 PRO 128GB SPACE BLACK" -> "iPhone 14 Pro")
    const iphoneMatch = normalized.match(/IPHONE\s+(\d+(?:\s+(?:PRO|PLUS|MINI|MAX))*)/);
    if (iphoneMatch) {
      const modelPart = iphoneMatch[1];
      const model = `iPhone ${modelPart.split(' ').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ')}`;
      
      return { make, model, storage };
    }
    
    return { make, model: 'iPhone', storage };
  }
  
  // Apple iPad patterns
  if (normalized.includes('IPAD')) {
    const make = 'Apple';

    // Remove APPLE prefix if present
    normalized = normalized.replace(/^APPLE\s+/, '');

    // Example variants: "IPAD PRO 10.5", "IPAD 6TH GEN", "IPAD AIR2"
    let modelPart = normalized;

    // Remove color / misc tokens
    modelPart = modelPart.replace(/SPACE|SPC|GRAY|GRY|GREY|SILVER|SLV|ARTL|TL|ML|AL|TI|BLK|MID|ROSE|GOLD/g, '').trim();

    // Title-case
    const model = modelPart.split(' ').filter(Boolean).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

    return { make, model, storage };
  }

  // Apple Watch patterns
  if (normalized.includes('WATCH')) {
    const make = 'Apple';

    normalized = normalized.replace(/^APPLE\s+/, '');

    let modelPart = normalized;
    modelPart = modelPart.replace(/ULTRA|SERIES|S\d|SE|TI|AL|MID|GPS|CELL|ARTL|TL|ML/g, match => {
      // Keep main identifiers like ULTRA or S7
      return match;
    });

    // Remove color tokens
    modelPart = modelPart.replace(/SPACE|SPC|GRAY|GRY|GREY|BLACK|BLK|MID|BLUE|RED|PINK|ORANGE|YELLOW|WHITE|SILVER|STAINLESS/g, '').trim();

    const model = modelPart.split(' ').filter(Boolean).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

    return { make, model, storage };
  }

  // Samsung prefixes "SS" or explicit SAMSUNG GALAXY
  if (normalized.startsWith('SS ')) {
    normalized = 'SAMSUNG ' + normalized.substring(3);
  }

  // Samsung Galaxy patterns
  if (normalized.includes('SAMSUNG') && normalized.includes('GALAXY')) {
    const make = 'Samsung';
    
    // Extract Galaxy model (e.g., "SAMSUNG GALAXY S25 256GB NAVY ANDROID SMARTPHONE" -> "Galaxy S25")
    const galaxyMatch = normalized.match(/GALAXY\s+([A-Z]\d+(?:\s+(?:PLUS|ULTRA|FE))*)/);
    if (galaxyMatch) {
      const modelPart = galaxyMatch[1];
      const model = `Galaxy ${modelPart.split(' ').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ')}`;
      
      return { make, model, storage };
    }
    
    return { make, model: 'Galaxy', storage };
  }
  
  // Google Pixel patterns (Fixed to handle "6a", "7a", etc.)
  if (normalized.includes('PIXEL')) {
    const make = 'Google';
    
    // Updated regex to capture "6a", "7a", "6 PRO", etc.
    const pixelMatch = normalized.match(/PIXEL\s+(\d+[A-Z]*(?:\s+(?:PRO|XL))*)/);
    if (pixelMatch) {
      const modelPart = pixelMatch[1];
      const model = `Pixel ${modelPart.split(' ').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ')}`;
      
      return { make, model, storage };
    }
    
    return { make, model: 'Pixel', storage };
  }
  
  // Generic fallback - try to extract make from first word
  const words = normalized.split(' ');
  if (words.length > 0) {
    const make = words[0].charAt(0) + words[0].slice(1).toLowerCase();
    const model = deviceName.trim(); // Keep original casing for model
    
    return { make, model, storage };
  }

  return { make: 'Unknown', model: deviceName.trim() };
}

// ============================================================================
// ENHANCED FEATURES FROM IMPORT GUIDE V2
// ============================================================================

/**
 * Enhanced User Resolution (from Import Guide v2)
 * Supports corporate email format, SAM account names, fuzzy matching
 */
export interface UserResolutionResult {
  userId?: string;
  displayName?: string;
  email?: string;
  confidence: 'exact' | 'fuzzy' | 'none';
}

/**
 * Resolve user by username with enhanced logic
 */
export function resolveUserByUsername(username: string): UserResolutionResult {
  if (!username?.trim()) {
    return { confidence: 'none' };
  }

  const trimmed = username.trim();
  
  // Corporate email format (prioritize @bgcengineering.ca)
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    const confidence = email.includes('@bgcengineering.ca') ? 'exact' : 'fuzzy';
    return { email, confidence };
  }
  
  // SAM account names and fuzzy matching
  // This would be implemented with actual Azure AD integration
  // For now, return the processed username
  return { 
    userId: trimmed,
    confidence: 'fuzzy'
  };
}

/**
 * BGC Asset Tag Normalization (from Import Guide v2)
 * Automatic BGC prefix handling
 */
export function normalizeBGCAssetTag(value: string): string {
  if (!value) return value;
  
  const trimmed = value.trim();
  
  // If it's just numbers, add BGC prefix and pad
  if (/^\d+$/.test(trimmed)) {
    return `BGC${trimmed.padStart(6, '0')}`;
  }
  
  return trimmed.toUpperCase();
}

/**
 * Location Matching with Abbreviations (from Import Guide v2)
 */
export const LOCATION_ABBREVIATIONS: Record<string, string> = {
  'CAL': 'Calgary',
  'VAN': 'Vancouver',
  'TOR': 'Toronto',
  'EDM': 'Edmonton',
  'MTL': 'Montreal',
  'OTT': 'Ottawa'
};

/**
 * Resolve location from abbreviation or full name
 */
export function resolveLocation(location: string): string | null {
  if (!location?.trim()) return null;
  
  const trimmed = location.trim().toUpperCase();
  
  // Check abbreviations first
  if (LOCATION_ABBREVIATIONS[trimmed]) {
    return LOCATION_ABBREVIATIONS[trimmed];
  }
  
  // Check if it's already a full name (case-insensitive)
  const fullNames = Object.values(LOCATION_ABBREVIATIONS).map(name => name.toUpperCase());
  const matchedName = fullNames.find(name => name === trimmed);
  if (matchedName) {
    return Object.values(LOCATION_ABBREVIATIONS).find(name => name.toUpperCase() === matchedName) || null;
  }
  
  return null;
}

/**
 * Phone Asset Processing (from Import Guide v2)
 * Generate asset tags in "PH-First Last" format for assigned users
 */
export function generatePhoneAssetTag(userDisplayName?: string): string {
  if (!userDisplayName?.trim()) {
    return `PH-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  }
  
  const trimmed = userDisplayName.trim();
  const nameParts = trimmed.split(' ').filter(Boolean);
  
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    return `PH-${firstName} ${lastName}`;
  }
  
  // Fallback for single name
  return `PH-${trimmed}`;
}

/**
 * IMEI Fallback Logic (from Import Guide v2)
 * Use IMEI as serial number if serial number is missing
 */
export function handleIMEIFallback(serialNumber?: string, imei?: string): {
  serialNumber?: string;
  imei?: string;
} {
  // If we have both, use as-is
  if (serialNumber && imei) {
    return { serialNumber, imei };
  }
  
  // If only IMEI, use it for both fields
  if (imei && !serialNumber) {
    return { serialNumber: imei, imei };
  }
  
  // If only serial number, keep as-is
  if (serialNumber && !imei) {
    return { serialNumber };
  }
  
  // Neither provided
  return {};
}

/**
 * Clean phone number by removing non-digits
 */
export function cleanPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;
  return phoneNumber.replace(/[^\d]/g, '');
}

// ============================================================================
// SOURCE-SPECIFIC TRANSFORMATION MODULES
// ============================================================================

/**
 * Asset type mapping for NinjaOne roles
 */
export const NINJA_ROLE_TO_ASSET_TYPE: Record<string, string> = {
  'WINDOWS_DESKTOP': 'DESKTOP',
  'WINDOWS_LAPTOP': 'LAPTOP',
  'WINDOWS WORKSTATION': 'LAPTOP', // NinjaOne uses this for Windows laptops
  'MAC_DESKTOP': 'DESKTOP',
  'MAC_LAPTOP': 'LAPTOP',
  'LINUX_DESKTOP': 'DESKTOP',
  'LINUX_LAPTOP': 'LAPTOP',
  'WINDOWS_SERVER': 'SERVER',
  'LINUX_SERVER': 'SERVER',
  'HYPER-V_SERVER': 'SERVER',
  'VMWARE_SERVER': 'SERVER',
  'SERVER': 'SERVER',
  'TABLET': 'TABLET',
  'MOBILE': 'OTHER',
  'NETWORK_DEVICE': 'OTHER',
  'PRINTER': 'OTHER'
};

// ============================================================================
// TRANSFORMATION INTERFACES
// ============================================================================

export interface TransformationResult {
  directFields: Record<string, any>;
  specifications: Record<string, any>;
  customFields: Record<string, any>;
  processingNotes: string[];
  validationErrors: string[];
}

export interface ColumnMapping {
  ninjaColumn: string;
  targetField: string;
  targetType: 'direct' | 'specifications' | 'custom' | 'ignore';
  processor?: (value: string) => any;
  description: string;
  required?: boolean;
}

/**
 * Base transformation engine that applies column mappings
 */
export function applyColumnMappings(
  row: Record<string, string>,
  mappings: ColumnMapping[]
): TransformationResult {
  const result: TransformationResult = {
    directFields: {},
    specifications: {},
    customFields: {},
    processingNotes: [],
    validationErrors: []
  };

  for (const mapping of mappings) {
    // Allow case-insensitive and whitespace-insensitive header matching
    const headerKey = Object.keys(row).find(
      k => k.trim().toLowerCase() === mapping.ninjaColumn.trim().toLowerCase()
    );
    const csvValue = headerKey ? row[headerKey] : undefined;
    
    // Handle required field validation
    if (!csvValue && mapping.required) {
      result.validationErrors.push(`Required field ${mapping.targetField} is missing`);
      continue;
    }

    if (csvValue !== undefined) {
      let transformedValue: any = csvValue;

      // Apply processor if defined
      if (mapping.processor) {
        try {
          transformedValue = mapping.processor(csvValue);
        } catch (error) {
          result.processingNotes.push(`Failed to process ${mapping.ninjaColumn}: ${String(error)}`);
          continue;
        }
      }

      // Store in appropriate location
      if (mapping.targetField.startsWith('cf_')) {
        const customFieldId = mapping.targetField.substring(3);
        result.customFields[customFieldId] = transformedValue;
      } else if (mapping.targetType === 'direct') {
        result.directFields[mapping.targetField] = transformedValue;
      } else if (mapping.targetType === 'specifications') {
        result.specifications[mapping.targetField] = transformedValue;
      }
    }
  }

  return result;
}