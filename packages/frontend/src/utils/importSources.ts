import { FileSpreadsheet, FileText, Zap, Shield, Cloud, Building2 } from 'lucide-react';
import { ColumnMapping } from './ninjaMapping';
import { getImportMappings } from '@ats/shared-transformations';

export type UploadCategory = 'endpoints' | 'servers' | 'phones';
export type UploadSource =
  | 'ninjaone'
  | 'bgc-template'
  | 'invoice'
  | 'intune'
  | 'custom-excel'
  | 'telus'
  | 'rogers'
  | 'bell'
  | 'verizon'
  | 'excetel';

export interface ImportSourceConfig {
  id: UploadSource;
  title: string;
  description: string;
  icon: any; // Lucide icon component
  iconColor: string;
  iconBg: string;
  acceptedFormats: string[];
  sampleFile: string | null;
  enabled: boolean;
  comingSoon?: boolean;
  features: string[];
  // NEW: override global required fields (e.g. assetType) for this source
  requiredOverrides?: string[];
  // NEW: name of filter to apply (key in IMPORT_FILTERS) – null or undefined = no filter
  filterKey?: string | null;
  // New extensibility properties
  category: UploadCategory;
  getMappings?: () => ColumnMapping[] | Promise<ColumnMapping[]>;
  getFilters?: () => any;
  customProcessing?: {
    userResolution?: boolean;
    locationResolution?: boolean;
    conflictDetection?: boolean;
    customValidation?: (data: any) => { isValid: boolean; errors: string[] };
  };
}

// NinjaOne-specific mappings (imported from existing file)
export const getNinjaOneMappings = async (): Promise<ColumnMapping[]> => {
  const { NINJA_COLUMN_MAPPINGS } = await import('./ninjaMapping');
  return NINJA_COLUMN_MAPPINGS;
};

// NinjaOne Server mappings (from shared transformation modules)
export const getNinjaOneServerMappings = (): ColumnMapping[] => {
  return getImportMappings('ninjaone-servers');
};

// BGC Template mappings (to be defined)
export const getBGCTemplateMappings = (): ColumnMapping[] => {
  return [
    // Service Tag → Serial Number (required)
    {
      ninjaColumn: 'Service Tag',
      targetField: 'serialNumber',
      targetType: 'direct',
      description: 'Device serial number',
      required: true,
      processor: (val: string) => val?.trim() || null,
    },
    // Brand → Make (with trailing space in header)
    {
      ninjaColumn: 'Brand ',
      targetField: 'make',
      targetType: 'direct',
      description: 'Manufacturer (Dell, Lenovo, etc.)',
      required: false,
      processor: (val: string) => {
        const clean = val?.trim();
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
      processor: (val: string) => {
        const clean = val?.trim();
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
      processor: (val: string) => val?.trim(),
    },
    // Purchase date (MM/DD/YYYY) → purchaseDate (ISO)
    {
      ninjaColumn: 'Purchase date',
      targetField: 'purchaseDate',
      targetType: 'direct',
      description: 'Purchase date',
      processor: (val: string) => {
        if (!val) return null;
        const parsed = new Date(val);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      },
    },
    // Location of computer → locationId (resolved later)
    {
      ninjaColumn: 'Location of computer',
      targetField: 'locationId',
      targetType: 'direct',
      description: 'Physical location name (resolved to ID)',
      processor: (val: string) => val?.trim(),
    },
    // Owner → assignedToAadId (username or display name)
    {
      ninjaColumn: 'Owner',
      targetField: 'assignedToAadId',
      targetType: 'direct',
      description: 'Assigned user (username or full name)',
      processor: (val: string) => {
        if (!val) return null;
        const clean = val.trim();
        if (!clean) return null;
        
        // Store as-is - backend will detect format and use appropriate lookup
        // Examples:
        // - "AAliSambaIssiaka" → username lookup
        // - "Jorge Gonzalez Perez" → display name lookup
        return clean;
      },
    },
    // BGC Asset Tag → assetTag (ensure prefix)
    {
      ninjaColumn: 'BGC Asset Tag',
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'Asset tag with BGC prefix',
      required: false,
      processor: (val: string) => {
        if (!val) return null;
        const trimmed = val.trim();
        if (!trimmed) return null;
        
        // If it already starts with BGC, return as-is (uppercase)
        if (trimmed.toUpperCase().startsWith('BGC')) {
          return trimmed.toUpperCase();
        }
        
        // If it's just a number or doesn't have BGC prefix, add BGC
        return `BGC${trimmed.toUpperCase()}`;
      },
    },
    // Duplicate mapping: Asset Tag (technicians often omit "BGC" prefix)
    {
      ninjaColumn: 'Asset Tag',
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'Asset tag (may be missing BGC prefix)',
      required: false,
      processor: (val: string) => {
        if (!val) return null;
        const trimmed = val.trim();
        if (!trimmed) return null;
        if (trimmed.toUpperCase().startsWith('BGC')) {
          return trimmed.toUpperCase();
        }
        return `BGC${trimmed.toUpperCase()}`;
      },
    },
    // Ticket number → specifications.ticketNumber (store in JSON for now)
    {
      ninjaColumn: 'Ticket number',
      targetField: 'ticketNumber',
      targetType: 'specifications',
      description: 'Related ticket reference',
      processor: (val: string) => val?.trim() || null,
    },
  ];
};

// Telus Mappings - Import from shared transformation modules

export const getTelusMappings = (): ColumnMapping[] => {
  // Use the shared transformation mappings from our refactored modules
  return getImportMappings('telus');
};

// OLD FALLBACK MAPPINGS - keeping for reference but not used
const OLD_TELUS_MAPPINGS = [
    // Ignore columns not needed
    {
      ninjaColumn: 'Status',
      targetField: '',
      targetType: 'ignore',
      description: 'Status (ignored)',
    },
    {
      ninjaColumn: 'Service Category',
      targetField: '',
      targetType: 'ignore',
      description: 'Service category (ignored)',
    },
    {
      ninjaColumn: 'Upgrade eligible',
      targetField: '',
      targetType: 'ignore',
      description: 'Upgrade eligible (ignored)',
    },
    {
      ninjaColumn: 'Remaining balance due',
      targetField: '',
      targetType: 'ignore',
      description: 'Remaining balance (ignored)',
    },
    {
      ninjaColumn: 'Sim Serial Number',
      targetField: '',
      targetType: 'ignore',
      description: 'SIM serial number (ignored)',
    },
    {
      ninjaColumn: 'Domestic Usage(MB)',
      targetField: '',
      targetType: 'ignore',
      description: 'Domestic usage (ignored)',
    },
    {
      ninjaColumn: 'Domestic Allowance(MB)',
      targetField: '',
      targetType: 'ignore',
      description: 'Domestic allowance (ignored)',
    },
    {
      ninjaColumn: 'Domestic Overage(MB)',
      targetField: '',
      targetType: 'ignore',
      description: 'Domestic overage (ignored)',
    },
    {
      ninjaColumn: 'Domestic tiered charges ($)',
      targetField: '',
      targetType: 'ignore',
      description: 'Domestic charges (ignored)',
    },
    {
      ninjaColumn: 'Domestic Overage Charge',
      targetField: '',
      targetType: 'ignore',
      description: 'Domestic overage charge (ignored)',
    },
    {
      ninjaColumn: 'Roaming Usage(MB)',
      targetField: '',
      targetType: 'ignore',
      description: 'Roaming usage (ignored)',
    },
    {
      ninjaColumn: 'Roaming Allowance(MB)',
      targetField: '',
      targetType: 'ignore',
      description: 'Roaming allowance (ignored)',
    },
    {
      ninjaColumn: 'Roaming Overage(MB)',
      targetField: '',
      targetType: 'ignore',
      description: 'Roaming overage (ignored)',
    },
    {
      ninjaColumn: 'Roaming tiered charges ($)',
      targetField: '',
      targetType: 'ignore',
      description: 'Roaming charges (ignored)',
    },
    {
      ninjaColumn: 'Roaming Overage charge',
      targetField: '',
      targetType: 'ignore',
      description: 'Roaming overage charge (ignored)',
    },
    {
      ninjaColumn: 'Days left',
      targetField: '',
      targetType: 'ignore',
      description: 'Days left (ignored)',
    },
];

// Future Intune mappings (placeholder)
export const getIntuneMappings = (): ColumnMapping[] => {
  return [
    {
      ninjaColumn: 'Device name',
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'Device Name as Asset Tag',
      required: true
    },
    {
      ninjaColumn: 'Device type',
      targetField: 'assetType',
      targetType: 'direct',
      processor: (value: string) => {
        const typeMap: Record<string, string> = {
          'desktop': 'DESKTOP',
          'laptop': 'LAPTOP',
          'tablet': 'TABLET',
          'phone': 'PHONE'
        };
        return typeMap[value.toLowerCase()] || 'OTHER';
      },
      description: 'Asset Type from Intune',
      required: true
    },
    {
      ninjaColumn: 'Manufacturer',
      targetField: 'make',
      targetType: 'direct',
      description: 'Manufacturer',
      required: true
    },
    {
      ninjaColumn: 'Model',
      targetField: 'model',
      targetType: 'direct',
      description: 'Model',
      required: true
    },
    {
      ninjaColumn: 'Serial number',
      targetField: 'serialNumber',
      targetType: 'direct',
      description: 'Serial Number'
    },
    {
      ninjaColumn: 'Primary user UPN',
      targetField: 'assignedToAadId',
      targetType: 'direct',
      processor: (value: string) => {
        // Extract username from UPN for Intune
        return value ? value.split('@')[0] : null;
      },
      description: 'Primary User from Intune'
    },
    {
      ninjaColumn: 'OS',
      targetField: 'operatingSystem',
      targetType: 'direct',
      description: 'Operating System'
    },
    {
      ninjaColumn: 'OS version',
      targetField: 'osVersion',
      targetType: 'specifications',
      description: 'OS Version'
    },
    {
      ninjaColumn: 'Last check-in',
      targetField: 'lastCheckIn',
      targetType: 'specifications',
      processor: (value: string) => {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      },
      description: 'Last Check-in Date'
    }
  ];
};

// Import source registry
export const IMPORT_SOURCES: Record<UploadCategory, ImportSourceConfig[]> = {
  endpoints: [
    {
      id: 'ninjaone',
      title: 'NinjaOne Export',
      description: 'Import from NinjaOne RMM system with full device details',
      icon: Zap,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: '/samples/ninjaone-export.csv',
      enabled: true,
      category: 'endpoints',
      features: [
        'Hardware specifications',
        'Software inventory',
        'Network information',
        'User assignments'
      ],
      requiredOverrides: [],
      filterKey: 'ninja-endpoints',
      getMappings: getNinjaOneMappings,
      customProcessing: {
        userResolution: true,
        locationResolution: true,
        conflictDetection: true
      }
    },
    {
      id: 'intune',
      title: 'Microsoft Intune',
      description: 'Import from Microsoft Intune device management',
      icon: Shield,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: '/samples/intune-export.csv',
      enabled: false,
      comingSoon: true,
      category: 'endpoints',
      features: [
        'Device compliance status',
        'Azure AD integration',
        'Mobile device management',
        'App deployment status'
      ],
      getMappings: () => getIntuneMappings(),
      customProcessing: {
        userResolution: true,
        locationResolution: false,
        conflictDetection: true
      }
    },
    {
      id: 'bgc-template',
      title: 'BGC Asset Template',
      description: 'Use our standardized asset inventory template',
      icon: FileSpreadsheet,
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: '/samples/bgc-asset-template.xlsx',
      enabled: true,
      category: 'endpoints',
      features: [
        'Basic asset information',
        'Assignment tracking',
        'Purchase details',
        'Warranty information'
      ],
      getMappings: () => getBGCTemplateMappings(),
      requiredOverrides: ['assetType', 'make', 'assetTag'],
      filterKey: null,
      customProcessing: {
        userResolution: true,
        locationResolution: true,
        conflictDetection: true
      }
    },
    {
      id: 'custom-excel',
      title: 'Custom Excel/CSV',
      description: 'Import from any Excel or CSV file with custom mapping',
      icon: FileSpreadsheet,
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: null,
      enabled: false,
      comingSoon: true,
      category: 'endpoints',
      features: [
        'Custom column mapping',
        'Flexible data formats',
        'Data validation',
        'Preview before import'
      ],
      getMappings: () => [], // Dynamic mapping in UI
      customProcessing: {
        userResolution: false,
        locationResolution: false,
        conflictDetection: true
      }
    },
    {
      id: 'invoice',
      title: 'Invoice / PO Document',
      description: 'Extract asset information from purchase documents',
      icon: FileText,
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      acceptedFormats: ['PDF', 'JPG', 'PNG'],
      sampleFile: null,
      enabled: true,
      comingSoon: false,
      category: 'endpoints',
      features: [
        'OCR text extraction',
        'Automatic field mapping',
        'Purchase price detection',
        'Vendor identification'
      ],
      getMappings: () => [], // OCR-based mapping
      filterKey: null, // No filtering needed for invoice imports
      customProcessing: {
        userResolution: false,
        locationResolution: false,
        conflictDetection: true
      }
    }
  ],
  servers: [
    {
      id: 'ninjaone',
      title: 'NinjaOne Export',
      description: 'Import servers from NinjaOne RMM system',
      icon: Zap,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: '/samples/ninjaone-export.csv',
      enabled: true,
      category: 'servers',
      features: [
        'Server specifications',
        'Virtual/Physical detection',
        'Location extraction from name',
        'Storage aggregation'
      ],
      requiredOverrides: [],
      filterKey: 'ninja-servers',
      getMappings: getNinjaOneServerMappings,
      customProcessing: {
        userResolution: true,
        locationResolution: true,
        conflictDetection: true
      }
    },
    {
      id: 'bgc-template',
      title: 'BGC Server Template',
      description: 'Import server inventory using our template',
      icon: Building2,
      iconColor: 'text-gray-600 dark:text-gray-400',
      iconBg: 'bg-gray-100 dark:bg-gray-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: '/samples/bgc-server-template.xlsx',
      enabled: false,
      comingSoon: true,
      category: 'servers',
      features: [
        'Server specifications',
        'Rack location tracking',
        'Service assignments',
        'Maintenance schedules'
      ],
      getMappings: () => [], // To be defined
      customProcessing: {
        userResolution: false,
        locationResolution: true,
        conflictDetection: true
      }
    }
  ],
  phones: [
    {
      id: 'telus',
      title: 'Telus (Canada)',
      description: 'Import from Telus Mobility corporate accounts',
      icon: Building2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: '/samples/telus-export.csv',
      enabled: true,
      category: 'phones',
      features: ['User assignments', 'Device details', 'Plan information'],
      getMappings: () => getTelusMappings(),
      requiredOverrides: ['assetTag', 'make', 'assetType'], // Phones don't need BGC asset tags, explicit make, or assetType (all auto-set in backend)
      customProcessing: {
        userResolution: true,
        locationResolution: false,
        conflictDetection: true,
      },
    },
    {
      id: 'rogers',
      title: 'Rogers (Canada)',
      description: 'Import from Rogers for Business corporate accounts',
      icon: Building2,
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      acceptedFormats: ['CSV', 'XLSX', 'XLSM'],
      sampleFile: null,
      enabled: true,
      category: 'phones',
      features: ['User assignments', 'Device details', 'Plan information', 'Contract tracking', 'HUP eligibility'],
      getMappings: () => getImportMappings('rogers'),
      requiredOverrides: ['assetTag', 'make', 'assetType'], // Phones don't need BGC asset tags, explicit make, or assetType (all auto-set in backend)
      customProcessing: {
        userResolution: true,
        locationResolution: false,
        conflictDetection: true,
      },
    },
    {
      id: 'bell',
      title: 'Bell (Canada)',
      description: 'Import from Bell Mobility business accounts',
      icon: Building2,
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-100 dark:bg-sky-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: null,
      enabled: false,
      comingSoon: true,
      category: 'phones',
      features: [],
      getMappings: () => [],
    },
    {
      id: 'verizon',
      title: 'Verizon (US)',
      description: 'Import from Verizon Business accounts',
      icon: Building2,
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: null,
      enabled: false,
      comingSoon: true,
      category: 'phones',
      features: [],
      getMappings: () => [],
    },
    {
      id: 'excetel',
      title: 'Excetel (Australia)',
      description: 'Import from Excetel Business accounts',
      icon: Building2,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      acceptedFormats: ['CSV', 'XLSX'],
      sampleFile: null,
      enabled: false,
      comingSoon: true,
      category: 'phones',
      features: [],
      getMappings: () => [],
    },
  ]
};

// Helper functions for the import system
export const getImportSource = (category: UploadCategory, sourceId: UploadSource): ImportSourceConfig | undefined => {
  return IMPORT_SOURCES[category]?.find(source => source.id === sourceId);
};

export const getAvailableSources = (category: UploadCategory): ImportSourceConfig[] => {
  return IMPORT_SOURCES[category] || [];
};

export const getEnabledSources = (category: UploadCategory): ImportSourceConfig[] => {
  return getAvailableSources(category).filter(source => source.enabled);
};

export const getAcceptedFileTypes = (source: ImportSourceConfig): Record<string, string[]> => {
  const accept: Record<string, string[]> = {};

  source.acceptedFormats.forEach(fmt => {
    switch (fmt) {
      case 'CSV':
        accept['text/csv'] = ['.csv'];
        break;
      case 'XLSX':
        accept['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] = ['.xlsx'];
        break;
      case 'XLSM':
        accept['application/vnd.ms-excel.sheet.macroEnabled.12'] = ['.xlsm'];
        break;
      case 'PDF':
        accept['application/pdf'] = ['.pdf'];
        break;
      case 'JPG':
        accept['image/jpeg'] = ['.jpg', '.jpeg'];
        break;
      case 'PNG':
        accept['image/png'] = ['.png'];
        break;
      default:
        break;
    }
  });

  return accept;
};

// Factory function to get mappings for a source
export const getMappingsForSource = async (sourceId: UploadSource, category: UploadCategory): Promise<ColumnMapping[]> => {
  const source = getImportSource(category, sourceId);
  if (!source?.getMappings) {
    return [];
  }
  
  return await source.getMappings();
};

// Check if a source supports specific processing features
export const sourceSupports = (source: ImportSourceConfig, feature: keyof NonNullable<ImportSourceConfig['customProcessing']>): boolean => {
  return source.customProcessing?.[feature] === true;
}; 