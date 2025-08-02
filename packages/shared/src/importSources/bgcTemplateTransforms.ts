/**
 * BGC Template Import Transformation Module
 * 
 * Contains all transformation logic specific to BGC standardized asset template imports.
 * This module handles the complete transformation pipeline for BGC template data.
 */

import {
  toISO,
  applyColumnMappings,
  type ColumnMapping,
  type TransformationResult
} from '../importTransformations.js';

// ============================================================================
// BGC TEMPLATE COLUMN MAPPINGS
// ============================================================================

export const BGC_TEMPLATE_MAPPINGS: ColumnMapping[] = [
  // Service Tag → Serial Number (required)
  {
    ninjaColumn: 'Service Tag',
    targetField: 'serialNumber',
    targetType: 'direct',
    description: 'Device serial number',
    required: true,
    processor: (value: string) => value?.trim() || null,
  },
  // Brand → Make (with trailing space in header support)
  {
    ninjaColumn: 'Brand ',
    targetField: 'make',
    targetType: 'direct',
    description: 'Manufacturer (Dell, Lenovo, etc.)',
    required: false,
    processor: (value: string) => {
      const clean = value?.trim();
      return clean && clean.length > 0 ? clean : 'Dell';
    },
  },
  // Alternate header without trailing space (observed in some CSVs)
  {
    ninjaColumn: 'Brand',
    targetField: 'make',
    targetType: 'direct',
    description: 'Manufacturer (Dell, Lenovo, etc.)',
    required: false,
    processor: (value: string) => {
      const clean = value?.trim();
      return clean && clean.length > 0 ? clean : 'Dell';
    },
  },
  // Model → Model
  {
    ninjaColumn: 'Model',
    targetField: 'model',
    targetType: 'direct',
    description: 'Device model',
    required: false,
    processor: (value: string) => value?.trim(),
  },
  // Purchase date (MM/DD/YYYY) → purchaseDate (ISO)
  {
    ninjaColumn: 'Purchase date',
    targetField: 'purchaseDate',
    targetType: 'direct',
    description: 'Purchase date',
    processor: (value: string) => {
      if (!value) return null;
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    },
  },
  // Location of computer → locationId (resolved later)
  {
    ninjaColumn: 'Location of computer',
    targetField: 'locationId',
    targetType: 'direct',
    description: 'Physical location name (resolved to ID)',
    processor: (value: string) => value?.trim(),
  },
  // Asset Tag (direct mapping)
  {
    ninjaColumn: 'Asset Tag',
    targetField: 'assetTag',
    targetType: 'direct',
    description: 'BGC Asset Tag',
    processor: (value: string) => {
      const trimmed = value?.trim();
      if (!trimmed) return null;
      
      // Auto-add BGC prefix for numeric-only tags
      if (/^\d+$/.test(trimmed)) {
        return `BGC${trimmed.padStart(6, '0')}`;
      }
      
      // Ensure BGC prefix for alphanumeric tags that don't have it
      if (!trimmed.toUpperCase().startsWith('BGC') && /^[A-Z0-9]+$/i.test(trimmed)) {
        return `BGC${trimmed.toUpperCase()}`;
      }
      
      return trimmed.toUpperCase();
    },
  },
  // Assigned User
  {
    ninjaColumn: 'Assigned User',
    targetField: 'assignedToAadId',
    targetType: 'direct',
    description: 'Assigned user (requires Azure AD lookup)',
    processor: (value: string) => value?.trim() || null,
  },
  // Device Type → Asset Type
  {
    ninjaColumn: 'Device Type',
    targetField: 'assetType',
    targetType: 'direct',
    description: 'Asset type',
    processor: (value: string) => {
      if (!value) return 'LAPTOP'; // Default fallback
      
      const typeMap: Record<string, string> = {
        'laptop': 'LAPTOP',
        'desktop': 'DESKTOP',
        'tablet': 'TABLET',
        'phone': 'PHONE',
        'server': 'SERVER',
        'workstation': 'DESKTOP',
        'all-in-one': 'DESKTOP',
      };
      
      return typeMap[value.toLowerCase()] || 'OTHER';
    },
  },
  // Status
  {
    ninjaColumn: 'Status',
    targetField: 'status',
    targetType: 'direct',
    description: 'Asset status',
    processor: (value: string) => {
      if (!value) return 'AVAILABLE'; // Default fallback
      
      const statusMap: Record<string, string> = {
        'active': 'AVAILABLE',
        'available': 'AVAILABLE',
        'assigned': 'ASSIGNED',
        'in use': 'ASSIGNED',
        'spare': 'SPARE',
        'maintenance': 'MAINTENANCE',
        'repair': 'MAINTENANCE',
        'retired': 'RETIRED',
        'disposed': 'DISPOSED',
      };
      
      return statusMap[value.toLowerCase()] || 'AVAILABLE';
    },
  },
  // Condition
  {
    ninjaColumn: 'Condition',
    targetField: 'condition',
    targetType: 'direct',
    description: 'Device condition',
    processor: (value: string) => {
      if (!value) return 'GOOD'; // Default fallback
      
      const conditionMap: Record<string, string> = {
        'new': 'NEW',
        'excellent': 'GOOD',
        'good': 'GOOD',
        'fair': 'FAIR',
        'poor': 'POOR',
        'damaged': 'POOR',
      };
      
      return conditionMap[value.toLowerCase()] || 'GOOD';
    },
  },
  // Purchase Price
  {
    ninjaColumn: 'Purchase Price',
    targetField: 'purchasePrice',
    targetType: 'direct',
    description: 'Purchase price',
    processor: (value: string) => {
      if (!value) return null;
      // Remove currency symbols and parse as float
      const cleaned = value.replace(/[$,]/g, '');
      const price = parseFloat(cleaned);
      return isNaN(price) ? null : price;
    },
  },
  // Warranty Start Date
  {
    ninjaColumn: 'Warranty Start',
    targetField: 'warrantyStartDate',
    targetType: 'direct',
    description: 'Warranty start date',
    processor: toISO,
  },
  // Warranty End Date
  {
    ninjaColumn: 'Warranty End',
    targetField: 'warrantyEndDate',
    targetType: 'direct',
    description: 'Warranty end date',
    processor: toISO,
  },
  // Notes
  {
    ninjaColumn: 'Notes',
    targetField: 'notes',
    targetType: 'direct',
    description: 'Additional notes',
    processor: (value: string) => value?.trim() || null,
  },
];

// ============================================================================
// BGC TEMPLATE TRANSFORMATION ENGINE
// ============================================================================

/**
 * Transform a single row of BGC template data
 */
export function transformBGCTemplateRow(row: Record<string, string>): TransformationResult {
  const result = applyColumnMappings(row, BGC_TEMPLATE_MAPPINGS);
  
  // Post-processing for BGC template specific business logic
  
  // Set default values if not provided
  result.directFields.condition = result.directFields.condition || 'GOOD';
  result.directFields.assetType = result.directFields.assetType || 'LAPTOP';
  result.directFields.make = result.directFields.make || 'Dell';
  result.directFields.model = result.directFields.model || 'Unknown';
  result.directFields.source = 'EXCEL';
  
  // Generate asset tag if not provided
  if (!result.directFields.assetTag) {
    const prefix = result.directFields.assetType === 'LAPTOP' ? 'LT' : 
                  result.directFields.assetType === 'DESKTOP' ? 'DT' : 
                  result.directFields.assetType === 'PHONE' ? 'PH' : 'AS';
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
    result.directFields.assetTag = `${prefix}-${timestamp}-${randomSuffix}`;
  }
  
  // Determine status based on assignment if status not explicitly set
  if (!result.directFields.status) {
    if (result.directFields.assignedToAadId) {
      result.directFields.status = 'ASSIGNED';
    } else {
      result.directFields.status = 'AVAILABLE';
    }
  }
  
  // Add processing notes for username lookup
  if (result.directFields.assignedToAadId) {
    result.processingNotes.push(`Username "${result.directFields.assignedToAadId}" requires Azure AD lookup`);
  }
  
  return result;
}

/**
 * Get column mapping for a specific BGC template column
 */
export function getBGCTemplateMapping(columnName: string): ColumnMapping | undefined {
  return BGC_TEMPLATE_MAPPINGS.find(mapping => mapping.ninjaColumn === columnName);
}

/**
 * Validate required fields for BGC template import
 */
export function validateBGCTemplateData(data: Record<string, any>): string[] {
  const errors: string[] = [];
  
  if (!data.serialNumber || data.serialNumber.trim() === '') {
    errors.push('Serial Number (Service Tag) is required');
  }
  
  return errors;
}

// ============================================================================
// BGC TEMPLATE SPECIFIC UTILITIES
// ============================================================================

/**
 * Normalize BGC asset tags with proper prefixing
 */
export function normalizeBGCAssetTag(value: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  
  // Auto-add BGC prefix for numeric-only tags
  if (/^\d+$/.test(trimmed)) {
    return `BGC${trimmed.padStart(6, '0')}`;
  }
  
  // Ensure BGC prefix for alphanumeric tags that don't have it
  if (!trimmed.toUpperCase().startsWith('BGC') && /^[A-Z0-9]+$/i.test(trimmed)) {
    return `BGC${trimmed.toUpperCase()}`;
  }
  
  return trimmed.toUpperCase();
}

/**
 * Parse and validate purchase price
 */
export function parsePurchasePrice(value: string): number | null {
  if (!value) return null;
  
  // Remove currency symbols and parse as float
  const cleaned = value.replace(/[$,€£¥]/g, '');
  const price = parseFloat(cleaned);
  
  if (isNaN(price) || price < 0) return null;
  
  // Cap at reasonable maximum (e.g., $100,000)
  return Math.min(price, 100000);
}

/**
 * Standardize device condition values
 */
export function standardizeCondition(value: string): string {
  if (!value) return 'GOOD';
  
  const conditionMap: Record<string, string> = {
    'new': 'NEW',
    'brand new': 'NEW',
    'excellent': 'GOOD',
    'very good': 'GOOD',
    'good': 'GOOD',
    'fair': 'FAIR',
    'poor': 'POOR',
    'damaged': 'POOR',
    'broken': 'POOR',
  };
  
  return conditionMap[value.toLowerCase()] || 'GOOD';
} 