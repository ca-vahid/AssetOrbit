import { ENDPOINT_DEVICE_ROLES, SERVER_ROLES } from './importFilters';

export interface ColumnMapping {
  ninjaColumn: string;
  targetField: string;
  targetType: 'direct' | 'specifications' | 'custom' | 'ignore';
  processor?: (value: string) => any;
  description: string;
  required?: boolean;
}

export interface ProcessingRule {
  field: string;
  rule: 'username_to_aad' | 'role_to_type' | 'memory_format' | 'volume_format' | 'date_format';
  description: string;
}

// Asset type mapping from NinjaOne Role to our assetType
export const NINJA_ROLE_TO_ASSET_TYPE: Record<string, string> = {
  'WINDOWS_DESKTOP': 'DESKTOP',
  'WINDOWS_LAPTOP': 'LAPTOP', 
  'MAC_DESKTOP': 'DESKTOP',
  'MAC_LAPTOP': 'LAPTOP',
  'LINUX_DESKTOP': 'DESKTOP',
  'LINUX_LAPTOP': 'LAPTOP',
  'TABLET': 'TABLET',
  'MOBILE': 'OTHER',
  'WINDOWS_SERVER': 'SERVER',
  'LINUX_SERVER': 'SERVER',
  'HYPER-V_SERVER': 'SERVER',
  'VMWARE_SERVER': 'SERVER',
  'SERVER': 'SERVER',
  'NETWORK_DEVICE': 'OTHER',
  'PRINTER': 'OTHER'
};

function roundToCommonStorageSize(gib: number): string {
  if (gib > 3800) return '4 TB';
  if (gib > 1800) return '2 TB';
  if (gib > 900) return '1 TB';
  if (gib > 450) return '512 GB';
  if (gib > 230) return '256 GB';
  if (gib > 110) return '128 GB';
  if (gib > 50) return '64 GB';
  return `${Math.round(gib)} GB`;
}

// Default NinjaOne column mapping configuration
export const NINJA_COLUMN_MAPPINGS: ColumnMapping[] = [
  {
    ninjaColumn: 'Display Name',
    targetField: 'assetTag',
    targetType: 'direct',
    description: 'BGC Asset Tag',
    required: true
  },
  {
    ninjaColumn: 'Role',
    targetField: 'assetType',
    targetType: 'direct',
    processor: (value: string) => NINJA_ROLE_TO_ASSET_TYPE[value] || 'OTHER',
    description: 'Asset Type (mapped from Role)',
    required: true
  },
  {
    ninjaColumn: 'Warranty End Date',
    targetField: 'warrantyEndDate',
    targetType: 'direct',
    processor: (value: string) => {
      if (!value) return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    },
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
    ninjaColumn: 'Memory Capacity (GiB)',
    targetField: 'ram',
    targetType: 'direct',
    processor: (value: string) => {
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
    },
    description: 'RAM (rounded to common size)'
  },
  {
    ninjaColumn: 'OS Name',
    targetField: 'operatingSystem',
    targetType: 'direct',
    description: 'Operating System'
  },
  {
    ninjaColumn: 'System Manufacturer',
    targetField: 'make',
    targetType: 'direct',
    description: 'Manufacturer',
    required: true
  },
  {
    ninjaColumn: 'System Model',
    targetField: 'model',
    targetType: 'direct',
    description: 'Model',
    required: true
  },
  {
    ninjaColumn: 'Serial Number',
    targetField: 'serialNumber',
    targetType: 'direct',
    description: 'Serial Number'
  },
  {
    ninjaColumn: 'Processors Name',
    targetField: 'processor',
    targetType: 'direct',
    description: 'Processor'
  },
  {
    ninjaColumn: 'Volumes',
    targetField: 'storage',
    targetType: 'direct',
    processor: (value: string) => {
      if (!value) return null;
      
      const volumeRegex = /Type: "(.*?)"(?:[^\(]*)\((\d+\.?\d*)\s*GiB\)/g;
      let totalGib = 0;
      let match;

      while ((match = volumeRegex.exec(value)) !== null) {
        const type = match[1];
        const capacity = parseFloat(match[2]);
        
        if (type.toLowerCase() !== 'removable disk') {
          totalGib += capacity;
        }
      }

      return totalGib > 0 ? roundToCommonStorageSize(totalGib) : null;
    },
    description: 'Aggregated and rounded storage'
  },

  // Additional columns to capture in specifications JSON
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
    ninjaColumn: 'Last Online',
    targetField: 'lastOnline',
    targetType: 'specifications',
    processor: (value: string) => {
      if (!value) return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    },
    description: 'Last Online Date'
  },
  {
    ninjaColumn: 'IP Addresses',
    targetField: 'ipAddresses',
    targetType: 'specifications',
    description: 'IP Addresses'
  },
  {
    ninjaColumn: 'Mac Addresses',
    targetField: 'macAddresses',
    targetType: 'specifications',
    description: 'MAC Addresses'
  },
  // Columns to ignore by default
  {
    ninjaColumn: 'Id',
    targetField: '',
    targetType: 'ignore',
    description: 'NinjaOne Internal ID (not needed)'
  },
  {
    ninjaColumn: 'Client Name',
    targetField: '',
    targetType: 'ignore',
    description: 'Client Name (always BGC Engineering Inc)'
  },
  {
    ninjaColumn: 'Type',
    targetField: '',
    targetType: 'ignore',
    description: 'NinjaOne Agent Type (not needed)'
  },
  {
    ninjaColumn: 'Policy',
    targetField: '',
    targetType: 'ignore',
    description: 'NinjaOne Policy (not needed)'
  },
  {
    ninjaColumn: 'Last Update',
    targetField: '',
    targetType: 'ignore',
    description: 'NinjaOne Last Update (not needed)'
  },
  {
    ninjaColumn: 'IPv4 Addresses',
    targetField: '',
    targetType: 'ignore',
    description: 'IPv4 Addresses (covered by IP Addresses)'
  },
  {
    ninjaColumn: 'IPv6 Addresses',
    targetField: '',
    targetType: 'ignore',
    description: 'IPv6 Addresses (covered by IP Addresses)'
  },
  {
    ninjaColumn: 'Public IP',
    targetField: '',
    targetType: 'ignore',
    description: 'Public IP (not needed for asset tracking)'
  },
  {
    ninjaColumn: 'Memory Capacity',
    targetField: '',
    targetType: 'ignore',
    description: 'Memory in bytes (using GiB version instead)'
  },
  {
    ninjaColumn: 'OS Install Date',
    targetField: '',
    targetType: 'ignore',
    description: 'OS Install Date (not needed)'
  },
  {
    ninjaColumn: 'Last Boot Time',
    targetField: '',
    targetType: 'ignore',
    description: 'Last Boot Time (not needed)'
  },
  {
    ninjaColumn: 'Agent Install Timestamp',
    targetField: '',
    targetType: 'ignore',
    description: 'Agent Install Time (not needed)'
  },
  {
    ninjaColumn: 'SystemName',
    targetField: '',
    targetType: 'ignore',
    description: 'System Name (using Display Name instead)'
  },
  {
    ninjaColumn: 'Bios Serial Number',
    targetField: '',
    targetType: 'ignore',
    description: 'BIOS Serial (using main Serial Number)'
  },
  {
    ninjaColumn: 'System Domain',
    targetField: '',
    targetType: 'ignore',
    description: 'Domain (always BGC)'
  },
  {
    ninjaColumn: 'Processors Max Clock Speed',
    targetField: '',
    targetType: 'ignore',
    description: 'Processor Clock Speed (covered by Processor Name)'
  },
  {
    ninjaColumn: 'Manufacturer Fulfillment Date',
    targetField: '',
    targetType: 'ignore',
    description: 'Fulfillment Date (using Warranty Start if needed)'
  },
  {
    ninjaColumn: 'Tags',
    targetField: '',
    targetType: 'ignore',
    description: 'NinjaOne Tags (not needed)'
  }
];

// Get mapping for a specific column
export const getMappingForColumn = (columnName: string): ColumnMapping | undefined => {
  return NINJA_COLUMN_MAPPINGS.find(mapping => mapping.ninjaColumn === columnName);
};

// Get all columns that should be imported (not ignored)
export const getImportableColumns = (): ColumnMapping[] => {
  return NINJA_COLUMN_MAPPINGS.filter(mapping => mapping.targetType !== 'ignore');
};

// Get all ignored columns
export const getIgnoredColumns = (): ColumnMapping[] => {
  return NINJA_COLUMN_MAPPINGS.filter(mapping => mapping.targetType === 'ignore');
};

// Process a single row of NinjaOne data
export const processNinjaRow = (row: Record<string, string>): {
  directFields: Record<string, any>;
  specifications: Record<string, any>;
  processingNotes: string[];
} => {
  const directFields: Record<string, any> = {};
  const specifications: Record<string, any> = {};
  const processingNotes: string[] = [];

  for (const [columnName, value] of Object.entries(row)) {
    const mapping = getMappingForColumn(columnName);
    
    if (!mapping || mapping.targetType === 'ignore') {
      continue;
    }

    let processedValue = value;
    
    // Apply processor if defined
    if (mapping.processor) {
      try {
        processedValue = mapping.processor(value);
      } catch (error) {
        processingNotes.push(`Failed to process ${columnName}: ${error}`);
        continue;
      }
    }

    // Store in appropriate location
    if (mapping.targetType === 'direct') {
      directFields[mapping.targetField] = processedValue;
    } else if (mapping.targetType === 'specifications' || mapping.targetType === 'custom') {
      specifications[mapping.targetField] = processedValue;
    }

    // Special handling for username lookup
    if (mapping.targetField === 'assignedToAadId' && processedValue) {
      processingNotes.push(`Username "${processedValue}" requires Azure AD lookup`);
    }
  }

  return { directFields, specifications, processingNotes };
};

// Validate required fields are present
export const validateRequiredFields = (directFields: Record<string, any>): string[] => {
  const errors: string[] = [];
  const requiredMappings = NINJA_COLUMN_MAPPINGS.filter(m => m.required);
  
  for (const mapping of requiredMappings) {
    if (!directFields[mapping.targetField]) {
      errors.push(`Required field "${mapping.description}" is missing`);
    }
  }
  
  return errors;
}; 