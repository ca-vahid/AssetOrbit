/**
 * Rogers Phone Import Transformation Module
 * 
 * Contains all transformation logic specific to Rogers phone imports.
 * This module handles the complete transformation pipeline for Rogers phone data.
 */

import {
  toISO,
  parseDeviceName,
  applyColumnMappings,
  handleIMEIFallback,
  cleanPhoneNumber,
  type ColumnMapping,
  type TransformationResult
} from '../importTransformations';

// ============================================================================
// ROGERS PHONE COLUMN MAPPINGS
// ============================================================================

export const ROGERS_PHONE_MAPPINGS: ColumnMapping[] = [
  {
    ninjaColumn: 'Usernames',
    targetField: 'assignedToAadId',
    targetType: 'direct',
    description: 'Username (attempt Azure AD resolution)',
    processor: (value: string) => value?.trim() || null,
  },
  {
    ninjaColumn: 'Subscriber Number',
    targetField: 'phoneNumber',
    targetType: 'specifications',
    description: 'Phone number',
    processor: (value: string) => value?.replace(/[^\d]+/g, ''),
  },
  {
    ninjaColumn: 'Price Plan Description',
    targetField: 'planType',
    targetType: 'specifications',
    description: 'Plan type',
  },
  {
    ninjaColumn: 'Device Description',
    targetField: 'model',
    targetType: 'direct',
    description: 'Device model (make will be auto-extracted)',
    processor: (value: string) => {
      const parsed = parseRogersDeviceName(value);
      return parsed.model;
    },
    required: true,
  },
  {
    ninjaColumn: 'Device Description',
    targetField: 'make',
    targetType: 'direct',
    description: 'Device manufacturer (auto-extracted from device description)',
    processor: (value: string) => {
      const parsed = parseRogersDeviceName(value);
      return parsed.make;
    },
  },
  {
    ninjaColumn: 'Device Description',
    targetField: 'storage',
    targetType: 'specifications',
    description: 'Storage capacity extracted from device description',
    processor: (value: string) => {
      const parsed = parseRogersDeviceName(value);
      return parsed.storage;
    },
  },
  {
    ninjaColumn: 'IMEI',
    targetField: 'imei',
    targetType: 'specifications',
    description: 'IMEI number',
    required: true,
  },
  {
    ninjaColumn: 'IMEI',
    targetField: 'serialNumber',
    targetType: 'direct',
    description: 'IMEI as serial number (fallback)',
    processor: (value: string) => value?.trim() || null,
  },
  {
    ninjaColumn: 'SIM Card',
    targetField: 'simCard',
    targetType: 'specifications',
    description: 'SIM card number',
  },
  {
    ninjaColumn: 'Commit Start Date',
    targetField: 'purchaseDate',
    targetType: 'direct',
    description: 'Purchase date (commit start)',
    processor: (value: string) => {
      if (!value) return null;
      const clean = value.trim();
      
      // Try parsing as-is first
      let date = new Date(clean);
      
      // If that fails, try common formats
      if (isNaN(date.getTime())) {
        // Try YYYYMMDD format
        const compactMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (compactMatch) {
          date = new Date(`${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`);
        }
      }
      
      return isNaN(date.getTime()) ? null : date.toISOString();
    },
  },
  {
    ninjaColumn: 'Commit End Date',
    targetField: 'contractEndDate',
    targetType: 'specifications',
    description: 'Contract end date',
    processor: (value: string) => {
      if (!value) return null;
      const clean = value.trim();
      
      // Try parsing as-is first
      let date = new Date(clean);
      
      // If that fails, try common formats
      if (isNaN(date.getTime())) {
        // Try YYYYMMDD format
        const compactMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (compactMatch) {
          date = new Date(`${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`);
        }
      }
      
      return isNaN(date.getTime()) ? null : date.toISOString();
    },
  },
  {
    ninjaColumn: 'HUP Eligible (y/n)',
    targetField: 'hupEligible',
    targetType: 'specifications',
    description: 'Hardware Upgrade Program eligible',
    processor: (value: string) => {
      if (!value) return null;
      const normalized = value.trim().toLowerCase();
      return normalized === 'y' || normalized === 'yes' || normalized === 'true';
    },
  },
  // Use Account Number column as a trigger to set assetType → PHONE
  {
    ninjaColumn: 'Account Number',
    targetField: 'assetType',
    targetType: 'direct',
    required: true,
    description: 'Set assetType to PHONE',
    processor: () => 'PHONE',
  },
  // Ignore columns not needed
  {
    ninjaColumn: 'Status',
    targetField: '',
    targetType: 'ignore',
    description: 'Status (ignored)',
  },
  {
    ninjaColumn: '# of Months Remaining',
    targetField: '',
    targetType: 'ignore',
    description: 'Months remaining (ignored)',
  },
  {
    ninjaColumn: 'Early Cancellation Fee',
    targetField: '',
    targetType: 'ignore',
    description: 'Early cancellation fee (ignored)',
  },
  {
    ninjaColumn: ' Applicable Pre-HUP ',
    targetField: '',
    targetType: 'ignore',
    description: 'Pre-HUP credit (ignored)',
  },
  {
    ninjaColumn: 'Available HUP Date(s)',
    targetField: '',
    targetType: 'ignore',
    description: 'HUP available dates (ignored)',
  },
];

// ============================================================================
// ROGERS PHONE TRANSFORMATION ENGINE
// ============================================================================

/**
 * Transform a single row of Rogers phone data
 */
export function transformRogersPhoneRow(row: Record<string, string>): TransformationResult {
  const result = applyColumnMappings(row, ROGERS_PHONE_MAPPINGS);
  
  // Post-processing for Rogers phone specific business logic
  
  // Ensure phone asset type is set
  result.directFields.assetType = 'PHONE';
  
  // Set default values
  result.directFields.condition = result.directFields.condition || 'GOOD';
  result.directFields.source = 'ROGERS';
  
  // Ensure carrier information
  result.specifications.carrier = result.specifications.carrier || 'Rogers';
  
  // Generate phone-specific asset tag
  if (result.directFields.assignedToAadId) {
    // Try to extract name from assigned user for asset tag
    const userName = result.directFields.assignedToAadId;
    if (userName.includes(' ')) {
      // If display name with spaces, use it
      const nameParts = userName.split(' ');
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        result.directFields.assetTag = `PH-${firstName} ${lastName}`;
      } else {
        result.directFields.assetTag = `PH-${userName}`;
      }
    } else {
      // Username format, try to make it more readable
      result.directFields.assetTag = `PH-${userName}`;
    }
  } else {
    // No assigned user, use generic format with timestamp
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
    result.directFields.assetTag = `PH-${timestamp}-${randomSuffix}`;
  }
  
  // Handle IMEI fallback logic using enhanced utility
  const imeiResult = handleIMEIFallback(
    result.directFields.serialNumber,
    result.specifications.imei as string
  );
  
  if (imeiResult.serialNumber) {
    result.directFields.serialNumber = imeiResult.serialNumber;
  }
  if (imeiResult.imei) {
    result.specifications.imei = imeiResult.imei;
  }
  
  // Determine status based on assignment
  if (result.directFields.assignedToAadId) {
    result.directFields.status = 'ASSIGNED';
  } else {
    result.directFields.status = 'AVAILABLE';
  }
  
  // Save full raw device descriptor for phone field display
  if (row['Device Description']) {
    result.specifications.operatingSystem = row['Device Description'];
  }
  
  // Add processing notes for username lookup
  if (result.directFields.assignedToAadId) {
    result.processingNotes.push(`Username "${result.directFields.assignedToAadId}" requires Azure AD lookup`);
  }
  
  return result;
}

/**
 * Get column mapping for a specific Rogers column
 */
export function getRogersMapping(columnName: string): ColumnMapping | undefined {
  return ROGERS_PHONE_MAPPINGS.find(mapping => mapping.ninjaColumn === columnName);
}

/**
 * Validate required fields for Rogers phone import
 */
export function validateRogersPhoneData(data: Record<string, any>): string[] {
  const errors: string[] = [];
  
  if (!data.model || data.model.trim() === '') {
    errors.push('Device model is required');
  }
  
  if (!data.imei || data.imei.trim() === '') {
    errors.push('IMEI is required');
  }
  
  // Ensure we have either IMEI or serial number
  if ((!data.serialNumber || data.serialNumber.trim() === '') && 
      (!data.imei || data.imei.trim() === '')) {
    errors.push('Either Serial Number or IMEI is required');
  }
  
  return errors;
}

// ============================================================================
// ROGERS PHONE SPECIFIC UTILITIES
// ============================================================================

/**
 * Generate appropriate asset tag for Rogers phones
 */
export function generateRogersPhoneAssetTag(
  assignedUser?: string, 
  deviceName?: string, 
  phoneNumber?: string
): string {
  if (assignedUser) {
    if (assignedUser.includes(' ')) {
      // Display name format
      const nameParts = assignedUser.split(' ');
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        return `PH-${firstName} ${lastName}`;
      }
      return `PH-${assignedUser}`;
    } else {
      // Username format
      return `PH-${assignedUser}`;
    }
  }
  
  // Fallback to phone number
  if (phoneNumber) {
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    if (cleanPhone.length >= 10) {
      return `PH-${cleanPhone.slice(-4)}`;
    }
  }
  
  // Generic fallback
  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
  return `PH-${timestamp}-${randomSuffix}`;
}

/**
 * Extract phone details from Rogers device description with fallbacks
 */
export function parseRogersDeviceName(deviceName: string): {
  make: string;
  model: string;
  storage?: string;
} {
  if (!deviceName) {
    return { make: 'Unknown', model: 'Unknown' };
  }

  const upper = deviceName.toUpperCase();

  // --------------------------------------------------------------------------
  // Handle Rogers-specific Apple abbreviations first
  // --------------------------------------------------------------------------
  // Examples:
  //   "APPLE IPADAIR128 GSM"           -> iPad Air 128GB
  //   "APLE IP11PM 6425651GR..."       -> iPhone 11 Pro Max
  //   "APLE IP11P 64256512GR..."       -> iPhone 11 Pro
  //   "APLE IP12P 128256512GP..."      -> iPhone 12 Pro (storage optional)
  //
  // Strategy:
  //   1. Detect IPAD or IP prefix
  //   2. Map codes (AIR, MINI, PRO, etc.) or numeric generation + suffixes (P, PM)
  // --------------------------------------------------------------------------
  // iPad Air pattern (no spaces): IPADAIR128
  // Remove spaces/slashes for easier pattern matching
  const compact = upper.replace(/[^A-Z0-9]/g, '');

  // --------------------------------------------------------------------------
  // iPad Pro abbreviation pattern: IPDP11, IPDP12, etc.
  // --------------------------------------------------------------------------
  const ipadProMatch = compact.match(/IPDP(\d{1,2})?/);
  if (ipadProMatch) {
    const sizeCode = ipadProMatch[1];
    const model = sizeCode ? `iPad Pro ${sizeCode}"` : 'iPad Pro';
    // Look for storage anywhere in original string
    const storageMatch = upper.match(/\b(32|64|128|256|512)\b/);
    const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
    return {
      make: 'Apple',
      model,
      storage,
    };
  }

  // --------------------------------------------------------------------------
  const ipadAirMatch = upper.match(/IPADAIR(\d{2,3})?/);
  if (ipadAirMatch) {
    const storage = ipadAirMatch[1] ? `${ipadAirMatch[1]}GB` : undefined;
    return {
      make: 'Apple',
      model: 'iPad Air',
      storage,
    };
  }

  // --------------------------------------------------------------------------
  // Full text iPad Pro pattern: "IPAD PRO 11 512GB SPACE GREY", etc.
  // --------------------------------------------------------------------------
  const ipadProFull = upper.match(/IPAD\s+PRO\s+(\d{1,2}(?:\.\d+)?)?/);
  if (ipadProFull) {
    const sizeText = ipadProFull[1];
    const model = sizeText ? `iPad Pro ${sizeText}` : 'iPad Pro';
    const storageMatch = upper.match(/\b(32|64|128|256|512)\b/);
    const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
    return {
      make: 'Apple',
      model,
      storage,
    };
  }

  // Generic iPad pattern e.g., IPADPRO256, IPADMINI64, IPADAIR256, etc.
  const ipadMatch = upper.match(/IPAD(\w*)(\d{2,3})?/); // captures subtype + storage
  if (ipadMatch) {
    const subtype = ipadMatch[1] ? ipadMatch[1] : '';
    const niceSubtype = subtype
      ? subtype === 'PRO' ? 'Pro' : subtype === 'MINI' ? 'mini' : subtype
      : '';
    const storage = ipadMatch[2] ? `${ipadMatch[2]}GB` : undefined;
    return {
      make: 'Apple',
      model: `iPad${niceSubtype ? ' ' + niceSubtype : ''}`.trim(),
      storage,
    };
  }

  // iPhone abbreviation pattern: IP<generation>(P|PM)?
  const iphoneMatch = upper.match(/IP(\d{2})(PM?|PRO|PROMAX)?/);
  if (iphoneMatch) {
    const gen = iphoneMatch[1];
    const suffixCode = iphoneMatch[2] || '';
    let suffix = '';
    switch (suffixCode) {
      case 'P':
      case 'PRO':
        suffix = ' Pro';
        break;
      case 'PM':
      case 'PROMAX':
        suffix = ' Pro Max';
        break;
      case 'PLUS':
        suffix = ' Plus';
        break;
      default:
        suffix = '';
    }
    // Attempt to capture storage elsewhere in the string (first 3-digit number >= 64)
    const storageMatch = upper.match(/\b(64|128|256|512)\b/);
    const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
    return {
      make: 'Apple',
      model: `iPhone ${gen}${suffix}`.trim(),
      storage,
    };
  }

  // --------------------------------------------------------------------------
  // Handle Samsung Galaxy S-series without "Galaxy" prefix (e.g., "S21 Grey - 128GB")
  // --------------------------------------------------------------------------
  if (/^S\d+/.test(upper)) {
    const sMatch = upper.match(/^(S\d+[A-Z]*)/);
    const storageMatch = upper.match(/(\d+)GB/);
    if (sMatch) {
      return {
        make: 'Samsung',
        model: `Galaxy ${sMatch[1]}`,
        storage: storageMatch ? `${storageMatch[1]}GB` : undefined,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Fallback: use the shared parseDeviceName function for other patterns
  // --------------------------------------------------------------------------
  const parsed = parseDeviceName(deviceName);
  
  // Additional Rogers-specific brand mapping for cases shared function misses
  if (parsed.make === 'Unknown' || parsed.make === 'Other') {
    if (upper.includes('SAMSUNG') || upper.startsWith('SS ')) {
      parsed.make = 'Samsung';
    } else if (upper.includes('APPLE') || upper.includes('IPHONE') || upper.includes('IPAD')) {
      parsed.make = 'Apple';
    } else if (upper.includes('GOOGLE') || upper.includes('PIXEL')) {
      parsed.make = 'Google';
    } else if (upper.includes('ONEPLUS')) {
      parsed.make = 'OnePlus';
    } else if (upper.includes('HUAWEI')) {
      parsed.make = 'Huawei';
    }
  }
  
  return parsed;
}