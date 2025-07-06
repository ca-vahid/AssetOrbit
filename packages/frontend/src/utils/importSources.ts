import { FileSpreadsheet, FileText, Zap, Shield, Cloud, Building2 } from 'lucide-react';
import { ColumnMapping } from './ninjaMapping';

export type UploadCategory = 'endpoints' | 'servers';
export type UploadSource = 'ninjaone' | 'bgc-template' | 'invoice' | 'intune' | 'custom-excel';

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

// BGC Template mappings (to be defined)
export const getBGCTemplateMappings = (): ColumnMapping[] => {
  return [
    {
      ninjaColumn: 'Asset Tag',
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'BGC Asset Tag',
      required: true
    },
    {
      ninjaColumn: 'Asset Type',
      targetField: 'assetType',
      targetType: 'direct',
      description: 'Asset Type (LAPTOP, DESKTOP, etc.)',
      required: true
    },
    {
      ninjaColumn: 'Make',
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
      ninjaColumn: 'Serial Number',
      targetField: 'serialNumber',
      targetType: 'direct',
      description: 'Serial Number'
    },
    {
      ninjaColumn: 'Assigned To',
      targetField: 'assignedToAadId',
      targetType: 'direct',
      processor: (value: string) => {
        // Simple username extraction for BGC template
        return value ? value.trim() : null;
      },
      description: 'Assigned User (requires Azure AD lookup)'
    },
    {
      ninjaColumn: 'Status',
      targetField: 'status',
      targetType: 'direct',
      processor: (value: string) => {
        const statusMap: Record<string, string> = {
          'available': 'AVAILABLE',
          'assigned': 'ASSIGNED',
          'retired': 'RETIRED',
          'maintenance': 'MAINTENANCE'
        };
        return statusMap[value.toLowerCase()] || 'AVAILABLE';
      },
      description: 'Asset Status'
    },
    {
      ninjaColumn: 'Condition',
      targetField: 'condition',
      targetType: 'direct',
      processor: (value: string) => {
        const conditionMap: Record<string, string> = {
          'new': 'NEW',
          'good': 'GOOD',
          'fair': 'FAIR',
          'poor': 'POOR'
        };
        return conditionMap[value.toLowerCase()] || 'GOOD';
      },
      description: 'Asset Condition'
    },
    {
      ninjaColumn: 'Purchase Date',
      targetField: 'purchaseDate',
      targetType: 'direct',
      processor: (value: string) => {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      },
      description: 'Purchase Date'
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
      ninjaColumn: 'Notes',
      targetField: 'notes',
      targetType: 'direct',
      description: 'Notes'
    }
  ];
};

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
      customProcessing: {
        userResolution: true,
        locationResolution: false,
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
      enabled: false,
      comingSoon: true,
      category: 'endpoints',
      features: [
        'OCR text extraction',
        'Automatic field mapping',
        'Purchase price detection',
        'Vendor identification'
      ],
      getMappings: () => [], // OCR-based mapping
      customProcessing: {
        userResolution: false,
        locationResolution: false,
        conflictDetection: true
      }
    }
  ],
  servers: [
    // Future server import sources
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