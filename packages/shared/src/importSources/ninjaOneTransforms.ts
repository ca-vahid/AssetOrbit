/**
 * NinjaOne Import Transformation Module
 * 
 * Contains all transformation logic specific to NinjaOne RMM exports.
 * This module handles the complete transformation pipeline for NinjaOne data.
 */

import {
  toISO,
  simplifyRam,
  aggregateVolumes,
  aggregateServerVolumes,
  resolveServerLocation,
  detectVirtualization,
  NINJA_ROLE_TO_ASSET_TYPE,
  applyColumnMappings,
  type ColumnMapping,
  type TransformationResult
} from '../importTransformations.js';

// ============================================================================
// NINJA ONE COLUMN MAPPINGS
// ============================================================================

export const NINJA_ONE_MAPPINGS: ColumnMapping[] = [
  {
    ninjaColumn: 'Display Name',
    targetField: 'assetTag',
    targetType: 'direct',
    description: 'BGC Asset Tag',
    required: true,
    processor: (value: string) => {
      const trimmed = value.trim();
      // Auto-add BGC prefix for numeric-only tags
      if (/^\d+$/.test(trimmed)) {
        return `BGC${trimmed.padStart(6, '0')}`;
      }
      return trimmed.toUpperCase();
    }
  },
  {
    ninjaColumn: 'Role',
    targetField: 'assetType',
    targetType: 'direct',
    processor: (value: string) => NINJA_ROLE_TO_ASSET_TYPE[value.toUpperCase()] || 'OTHER',
    description: 'Asset Type (mapped from Role)',
    required: true
  },
  {
    ninjaColumn: 'Warranty End Date',
    targetField: 'warrantyEndDate',
    targetType: 'direct',
    processor: toISO,
    description: 'Warranty End Date'
  },
  {
    ninjaColumn: 'Last LoggedIn User',
    targetField: 'assignedToAadId',
    targetType: 'direct',
    processor: (value: string) => {
      if (!value) return null;
      // Extract username from "BGC\\username" format
      const match = value.match(/BGC\\(.+)/);
      const raw = match ? match[1] : value;
      return raw.trim();
    },
    description: 'Assigned User (requires Azure AD lookup)'
  },
  {
    ninjaColumn: 'RAM',
    targetField: 'ram',
    targetType: 'specifications',
    processor: simplifyRam,
    description: 'RAM (rounded to common size)'
  },
  {
    ninjaColumn: 'OS Name',
    targetField: 'operatingSystem',
    targetType: 'specifications',
    description: 'Operating System'
  },
  {
    ninjaColumn: 'OS Architecture',
    targetField: 'osArchitecture',
    targetType: 'specifications',
    description: 'OS Architecture (64-bit/32-bit)'
  },
  {
    ninjaColumn: 'OS Build Number',
    targetField: 'osBuildNumber',
    targetType: 'specifications',
    description: 'OS Build Number'
  },
  {
    ninjaColumn: 'OS Version',
    targetField: 'osVersion',
    targetType: 'specifications',
    description: 'Operating System Version'
  },
  {
    ninjaColumn: 'Processor',
    targetField: 'processor',
    targetType: 'specifications',
    description: 'Processor'
  },
  {
    ninjaColumn: 'Volumes',
    targetField: 'storage',
    targetType: 'specifications',
    processor: aggregateVolumes,
    description: 'Storage (aggregated from volumes)'
  },
  {
    ninjaColumn: 'Graphics',
    targetField: 'graphics',
    targetType: 'specifications',
    description: 'Graphics Card'
  },
  {
    ninjaColumn: 'Network Adapters',
    targetField: 'networkAdapters',
    targetType: 'specifications',
    description: 'Network Adapters'
  },
  {
    ninjaColumn: 'Serial Number',
    targetField: 'serialNumber',
    targetType: 'direct',
    description: 'Serial Number',
    required: true
  },
  {
    ninjaColumn: 'Manufacturer',
    targetField: 'make',
    targetType: 'direct',
    description: 'Manufacturer'
  },
  {
    ninjaColumn: 'Model',
    targetField: 'model',
    targetType: 'direct',
    description: 'Product Model'
  },
  {
    ninjaColumn: 'System Model',
    targetField: 'model',
    targetType: 'direct',
    description: 'System Model'
  },
  {
    ninjaColumn: 'Last Online',
    targetField: 'lastOnline',
    targetType: 'specifications',
    processor: toISO,
    description: 'Last Online Date'
  },
  {
    ninjaColumn: 'System Name',
    targetField: 'systemName',
    targetType: 'specifications',
    description: 'System Name'
  }
];

// ============================================================================
// NINJA ONE SERVER MAPPINGS
// ============================================================================

export const NINJA_ONE_SERVER_MAPPINGS: ColumnMapping[] = [
  {
    ninjaColumn: 'Display Name',
    targetField: 'assetTag',
    targetType: 'direct',
    description: 'Server Asset Tag',
    required: true,
    processor: (value: string) => value.trim().toUpperCase()
  },
  {
    ninjaColumn: 'Role',
    targetField: 'assetType',
    targetType: 'direct',
    processor: (value: string) => {
      const mapped = NINJA_ROLE_TO_ASSET_TYPE[value.toUpperCase()];
      return mapped === 'SERVER' ? 'SERVER' : 'OTHER';
    },
    description: 'Asset Type (mapped from Role)',
    required: true
  },
  {
    ninjaColumn: 'Display Name',
    targetField: 'locationName',
    targetType: 'direct',
    processor: resolveServerLocation,
    description: 'Location (extracted from server name)'
  },
  {
    ninjaColumn: 'System Model',
    targetField: 'virtualizationType',
    targetType: 'specifications',
    processor: detectVirtualization,
    description: 'Virtual or Physical server'
  },
  {
    ninjaColumn: 'Warranty End Date',
    targetField: 'warrantyEndDate',
    targetType: 'direct',
    processor: toISO,
    description: 'Warranty End Date'
  },
  {
    ninjaColumn: 'Last LoggedIn User',
    targetField: 'assignedToAadId',
    targetType: 'direct',
    processor: (value: string) => {
      if (!value) return null;
      // Extract username from "BGC\\username" format
      const match = value.match(/BGC\\(.+)/);
      const raw = match ? match[1] : value;
      return raw.trim();
    },
    description: 'Last Logged In User (requires Azure AD lookup)'
  },
  {
    ninjaColumn: 'RAM',
    targetField: 'ram',
    targetType: 'specifications',
    processor: simplifyRam,
    description: 'RAM (rounded to common size)'
  },
  {
    ninjaColumn: 'OS Name',
    targetField: 'operatingSystem',
    targetType: 'specifications',
    description: 'Operating System'
  },
  {
    ninjaColumn: 'OS Architecture',
    targetField: 'osArchitecture',
    targetType: 'specifications',
    description: 'OS Architecture (64-bit/32-bit)'
  },
  {
    ninjaColumn: 'OS Build Number',
    targetField: 'osBuildNumber',
    targetType: 'specifications',
    description: 'OS Build Number'
  },
  {
    ninjaColumn: 'OS Version',
    targetField: 'osVersion',
    targetType: 'specifications',
    description: 'Operating System Version'
  },
  {
    ninjaColumn: 'Processor',
    targetField: 'processor',
    targetType: 'specifications',
    description: 'Processor'
  },
  {
    ninjaColumn: 'Volumes',
    targetField: 'storage',
    targetType: 'specifications',
    processor: aggregateServerVolumes,
    description: 'Storage (aggregated with granular TB rounding)'
  },
  {
    ninjaColumn: 'Graphics',
    targetField: 'graphics',
    targetType: 'specifications',
    description: 'Graphics Card'
  },
  {
    ninjaColumn: 'Network Adapters',
    targetField: 'networkAdapters',
    targetType: 'specifications',
    description: 'Network Adapters'
  },
  {
    ninjaColumn: 'Serial Number',
    targetField: 'serialNumber',
    targetType: 'direct',
    description: 'Serial Number',
    required: true
  },
  {
    ninjaColumn: 'Manufacturer',
    targetField: 'make',
    targetType: 'direct',
    description: 'Manufacturer'
  },
  {
    ninjaColumn: 'Model',
    targetField: 'model',
    targetType: 'direct',
    description: 'Product Model'
  },
  {
    ninjaColumn: 'System Model',
    targetField: 'model',
    targetType: 'direct',
    description: 'System Model'
  },
  {
    ninjaColumn: 'Last Online',
    targetField: 'lastOnline',
    targetType: 'specifications',
    processor: toISO,
    description: 'Last Online Date'
  },
  {
    ninjaColumn: 'System Name',
    targetField: 'systemName',
    targetType: 'specifications',
    description: 'System Name'
  }
];

// ============================================================================
// NINJA ONE TRANSFORMATION ENGINE
// ============================================================================

/**
 * Transform a single row of NinjaOne data for endpoints
 */
export function transformNinjaOneRow(row: Record<string, string>): TransformationResult {
  const result = applyColumnMappings(row, NINJA_ONE_MAPPINGS);
  
  // Post-processing for NinjaOne specific business logic
  
  // Set default values
  if (!result.directFields.condition) {
    result.directFields.condition = 'GOOD';
  }
  
  if (!result.directFields.make) {
    result.directFields.make = 'Unknown';
  }
  
  if (!result.directFields.model) {
    result.directFields.model = 'Unknown';
  }
  
  // Determine status based on assignment
  if (result.directFields.assignedToAadId) {
    result.directFields.status = 'ASSIGNED';
  } else {
    result.directFields.status = 'AVAILABLE';
  }
  
  // Add processing notes for username lookup
  if (result.directFields.assignedToAadId) {
    result.processingNotes.push(`Username "${result.directFields.assignedToAadId}" requires Azure AD lookup`);
  }
  
  return result;
}

/**
 * Transform a single row of NinjaOne data for servers
 */
export function transformNinjaOneServerRow(row: Record<string, string>): TransformationResult {
  const result = applyColumnMappings(row, NINJA_ONE_SERVER_MAPPINGS);
  
  // Post-processing for server-specific business logic
  
  // Set default values
  if (!result.directFields.condition) {
    result.directFields.condition = 'GOOD';
  }
  
  if (!result.directFields.make) {
    result.directFields.make = 'Unknown';
  }
  
  if (!result.directFields.model) {
    result.directFields.model = 'Unknown';
  }
  
  // Servers are typically not assigned to individuals like endpoints
  // Set status based on whether it's online/accessible
  result.directFields.status = 'ASSIGNED'; // Servers are typically in use
  
  // Add processing notes for location and user lookup
  if (result.directFields.locationName) {
    result.processingNotes.push(`Location "${result.directFields.locationName}" will be matched to existing locations`);
  }
  
  if (result.directFields.assignedToAadId) {
    result.processingNotes.push(`Username "${result.directFields.assignedToAadId}" requires Azure AD lookup`);
  }
  
  return result;
}

/**
 * Get column mapping for a specific NinjaOne column
 */
export function getNinjaOneMapping(columnName: string): ColumnMapping | undefined {
  return NINJA_ONE_MAPPINGS.find(mapping => mapping.ninjaColumn === columnName);
}

/**
 * Validate required fields for NinjaOne import
 */
export function validateNinjaOneData(data: Record<string, any>): string[] {
  const errors: string[] = [];
  
  if (!data.assetTag || data.assetTag.trim() === '') {
    errors.push('Asset Tag is required');
  }
  
  if (!data.serialNumber || data.serialNumber.trim() === '') {
    errors.push('Serial Number is required');
  }
  
  if (!data.assetType || data.assetType.trim() === '') {
    errors.push('Asset Type is required');
  }
  
  return errors;
}

// ============================================================================
// NINJA ONE FILTERS
// ============================================================================

export const NINJA_ONE_ENDPOINT_ROLES = [
  'WINDOWS_DESKTOP', 'WINDOWS_LAPTOP', 'MAC_DESKTOP', 'MAC_LAPTOP',
  'LINUX_DESKTOP', 'LINUX_LAPTOP', 'TABLET', 'MOBILE'
];

export const NINJA_ONE_SERVER_ROLES = [
  'WINDOWS_SERVER', 'LINUX_SERVER', 'HYPER-V_SERVER', 'VMWARE_SERVER',
  'SERVER', 'NETWORK_DEVICE', 'PRINTER'
];

/**
 * Filter for endpoint devices only
 */
export function filterNinjaOneEndpoints(data: Record<string, string>[]): Record<string, string>[] {
  return data.filter(row => {
    const role = row['Role'];
    return role && NINJA_ONE_ENDPOINT_ROLES.includes(role.toUpperCase());
  });
}

/**
 * Filter for server devices only
 */
export function filterNinjaOneServers(data: Record<string, string>[]): Record<string, string>[] {
  return data.filter(row => {
    const role = row['Role'];
    return role && NINJA_ONE_SERVER_ROLES.includes(role.toUpperCase());
  });
} 