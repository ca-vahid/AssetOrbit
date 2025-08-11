import { getImportSource } from './importSources';

export interface FilterRule {
  field: string;
  operator: 'equals' | 'includes' | 'excludes' | 'startsWith' | 'endsWith' | 'daysSince';
  values: string[];
  description: string;
  maxDays?: number; // For daysSince operator
}

export interface ImportFilter {
  name: string;
  description: string;
  rules: FilterRule[];
}

// Define endpoint device roles (for NinjaOne)
export const ENDPOINT_DEVICE_ROLES = [
  'WINDOWS_DESKTOP',
  'WINDOWS_LAPTOP', 
  'MAC_DESKTOP',
  'MAC_LAPTOP',
  'LINUX_DESKTOP',
  'LINUX_LAPTOP',
  'TABLET',
  'MOBILE'
];

// Define server roles (for NinjaOne)
export const SERVER_ROLES = [
  'WINDOWS_SERVER',
  'LINUX_SERVER',
  'HYPER-V_SERVER',
  'VMWARE_SERVER',
  'SERVER',
  'NETWORK_DEVICE',
  'PRINTER' // Could be considered infrastructure
];

// Import filters for different scenarios
export const IMPORT_FILTERS: Record<string, ImportFilter> = {
  'ninja-endpoints': {
    name: 'NinjaOne Endpoint Devices',
    description: 'Filter for endpoint devices only (desktops, laptops, tablets, phones)',
    rules: [
      {
        field: 'Role',
        operator: 'includes',
        values: ENDPOINT_DEVICE_ROLES,
        description: 'Include only endpoint device roles'
      }
    ]
  },
  'ninja-servers': {
    name: 'NinjaOne Servers',
    description: 'Filter for servers and infrastructure devices',
    rules: [
      {
        field: 'Role',
        operator: 'includes', 
        values: SERVER_ROLES,
        description: 'Include only server and infrastructure roles'
      }
    ]
  },
  'bgc-endpoints': {
    name: 'BGC Template Endpoints',
    description: 'Filter for BGC endpoint devices',
    rules: [
      {
        field: 'Type',
        operator: 'includes',
        values: ['laptop', 'desktop', 'tablet', 'mobile'],
        description: 'Include only endpoint device types'
      }
    ]
  },
  'bgc-servers': {
    name: 'BGC Template Servers', 
    description: 'Filter for BGC server devices',
    rules: [
      {
        field: 'Type',
        operator: 'includes',
        values: ['server', 'virtual-machine', 'infrastructure'],
        description: 'Include only server device types'
      }
    ]
  }
};

// Function to apply filters to CSV data with optional Last Online filter
export function applyImportFilter(
  csvData: Record<string, string>[],
  filterKey: string,
  lastOnlineMaxDays?: number
): {
  filteredData: Record<string, string>[];
  excludedData: Record<string, string>[];
  filterStats: {
    total: number;
    included: number;
    excluded: number;
    filterName: string;
  };
} {
  const filter = IMPORT_FILTERS[filterKey];
  
  if (!filter) {
    // No filter found, return all data
    return {
      filteredData: csvData,
      excludedData: [],
      filterStats: {
        total: csvData.length,
        included: csvData.length,
        excluded: 0,
        filterName: 'No Filter'
      }
    };
  }

  // Create a copy of filter rules and add Last Online rule if specified
  const filterRules = [...filter.rules];
  if (lastOnlineMaxDays !== undefined && lastOnlineMaxDays > 0) {
    filterRules.push({
      field: 'Last Online',
      operator: 'daysSince',
      values: [],
      maxDays: lastOnlineMaxDays,
      description: `Device was online within the last ${lastOnlineMaxDays} days`
    });
  }

  const filteredData: Record<string, string>[] = [];
  const excludedData: Record<string, string>[] = [];

  for (const row of csvData) {
    let includeRow = true;

    // Apply all rules (AND logic)
    for (const rule of filterRules) {
      const fieldValue = row[rule.field];
      
      if (!fieldValue) {
        // Field doesn't exist or is empty
        includeRow = false;
        break;
      }

      let ruleMatches = false;

      switch (rule.operator) {
        case 'equals':
          ruleMatches = rule.values.includes(fieldValue);
          break;
        case 'includes':
          ruleMatches = rule.values.includes(fieldValue);
          break;
        case 'excludes':
          ruleMatches = !rule.values.includes(fieldValue);
          break;
        case 'startsWith':
          ruleMatches = rule.values.some(value => fieldValue.startsWith(value));
          break;
        case 'endsWith':
          ruleMatches = rule.values.some(value => fieldValue.endsWith(value));
          break;
        case 'daysSince':
          if (rule.maxDays !== undefined) {
            const daysSince = daysSinceDate(fieldValue);
            ruleMatches = daysSince <= rule.maxDays;
          } else {
            ruleMatches = false;
          }
          break;
      }

      if (!ruleMatches) {
        includeRow = false;
        break;
      }
    }

    if (includeRow) {
      filteredData.push(row);
    } else {
      excludedData.push(row);
    }
  }

  return {
    filteredData,
    excludedData,
    filterStats: {
      total: csvData.length,
      included: filteredData.length,
      excluded: excludedData.length,
      filterName: filter.name
    }
  };
}

// Get filter key based on source and category
export function getFilterKey(source: string, category: string): string {
  const srcCfg = getImportSource(category as any, source as any);
  if (srcCfg && srcCfg.filterKey !== undefined) {
    return srcCfg.filterKey || '';
  }
  if (source === 'ninjaone' && category === 'endpoints') {
    return 'ninja-endpoints';
  }
  if (source === 'ninjaone' && category === 'servers') {
    return 'ninja-servers';
  }
  if (source === 'bgc-template' && category === 'endpoints') {
    return '';
  }
  if (source === 'bgc-template' && category === 'servers') {
    return '';
  }
  if (source === 'invoice') {
    return ''; // No filtering for invoice imports
  }
  
  // Default: no filtering
  return '';
}

// Utility function to calculate days since a date
function daysSinceDate(dateString: string): number {
  if (!dateString) return Infinity;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return Infinity;
    
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    return Infinity;
  }
}

// Get human-readable filter description
export function getFilterDescription(filterKey: string, lastOnlineMaxDays?: number): string {
  const filter = IMPORT_FILTERS[filterKey];
  let description = filter ? filter.description : 'No filtering applied';
  
  if (lastOnlineMaxDays !== undefined && lastOnlineMaxDays > 0) {
    const onlineFilter = `devices online within ${lastOnlineMaxDays} days`;
    if (filter) {
      description += ` + ${onlineFilter}`;
    } else {
      description = `Filter for ${onlineFilter}`;
    }
  }
  
  return description;
} 