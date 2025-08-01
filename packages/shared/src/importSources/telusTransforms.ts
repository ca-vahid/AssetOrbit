/**
 * Telus Phone Import Transformation Module
 * 
 * Contains all transformation logic specific to Telus Mobility phone imports.
 * This module handles the complete transformation pipeline for Telus phone data.
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
// TELUS PHONE COLUMN MAPPINGS
// ============================================================================

export const TELUS_PHONE_MAPPINGS: ColumnMapping[] = [
  {
    ninjaColumn: 'Subscriber Name',
    targetField: 'assignedToAadId',
    targetType: 'direct',
    description: 'Subscriber name (attempt Azure AD resolution)',
    processor: (value: string) => value?.trim() || null,
  },
  {
    ninjaColumn: 'Phone Number',
    targetField: 'phoneNumber',
    targetType: 'specifications',
    description: 'Phone number',
    processor: (value: string) => value?.replace(/[^\d]+/g, ''),
  },
  {
    ninjaColumn: 'Rate Plan',
    targetField: 'planType',
    targetType: 'specifications',
    description: 'Plan type',
  },
  {
    ninjaColumn: 'Device Name',
    targetField: 'model',
    targetType: 'direct',
    description: 'Device model (make will be auto-extracted)',
    processor: (value: string) => {
      const parsed = parseDeviceName(value);
      return parsed.model;
    },
    required: true,
  },
  {
    ninjaColumn: 'Device Name',
    targetField: 'make',
    targetType: 'direct',
    description: 'Device manufacturer (auto-extracted from device name)',
    processor: (value: string) => {
      const parsed = parseDeviceName(value);
      return parsed.make;
    },
  },
  {
    ninjaColumn: 'Device Name',
    targetField: 'storage',
    targetType: 'specifications',
    description: 'Storage capacity extracted from device name',
    processor: (value: string) => {
      const parsed = parseDeviceName(value);
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
    ninjaColumn: 'Contract end date',
    targetField: 'contractEndDate',
    targetType: 'specifications',
    description: 'Contract end date',
    processor: (value: string) => {
      if (!value) return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    },
  },
  // Use Billing Account Number (BAN) column as a trigger to set assetType → PHONE
  {
    ninjaColumn: 'BAN',
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
];

// ============================================================================
// TELUS PHONE TRANSFORMATION ENGINE
// ============================================================================

/**
 * Transform a single row of Telus phone data
 */
export function transformTelusPhoneRow(row: Record<string, string>): TransformationResult {
  const result = applyColumnMappings(row, TELUS_PHONE_MAPPINGS);
  
  // Post-processing for Telus phone specific business logic
  
  // Ensure phone asset type is set
  result.directFields.assetType = 'PHONE';
  
  // Set default values
  result.directFields.condition = result.directFields.condition || 'GOOD';
  result.directFields.source = 'TELUS';
  
  // Ensure carrier information
  result.specifications.carrier = result.specifications.carrier || 'Telus';
  
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
  if (row['Device Name']) {
    result.specifications.operatingSystem = row['Device Name'];
  }
  
  // Add processing notes for username lookup
  if (result.directFields.assignedToAadId) {
    result.processingNotes.push(`Username "${result.directFields.assignedToAadId}" requires Azure AD lookup`);
  }
  
  return result;
}

/**
 * Get column mapping for a specific Telus column
 */
export function getTelusMapping(columnName: string): ColumnMapping | undefined {
  return TELUS_PHONE_MAPPINGS.find(mapping => mapping.ninjaColumn === columnName);
}

/**
 * Validate required fields for Telus phone import
 */
export function validateTelusPhoneData(data: Record<string, any>): string[] {
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
// TELUS PHONE SPECIFIC UTILITIES
// ============================================================================

/**
 * Generate appropriate asset tag for Telus phones
 */
export function generatePhoneAssetTag(
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
 * Extract phone details from Telus device name with fallbacks
 */
export function parseTelusDeviceName(deviceName: string): {
  make: string;
  model: string;
  storage?: string;
} {
  if (!deviceName) {
    return { make: 'Unknown', model: 'Unknown' };
  }

  // Use the shared parseDeviceName function but with Telus-specific fallbacks
  const parsed = parseDeviceName(deviceName);
  
  // Telus-specific brand mapping
  if (parsed.make === 'Unknown' || parsed.make === 'Other') {
    const upper = deviceName.toUpperCase();
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