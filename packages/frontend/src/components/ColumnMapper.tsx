import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  X, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Info,
  Database,
  FileText,
  Settings
} from 'lucide-react';
import { ColumnMapping, getMappingForColumn } from '../utils/ninjaMapping';
import { getImportSource } from '../utils/importSources';
import type { UploadCategory, UploadSource } from '../utils/importSources';
import type { AssetFieldMeta } from '../services/api';
import type { CustomField } from '@ats/shared';

interface ColumnMapperProps {
  csvHeaders: string[];
  sampleData: Record<string, string>[];
  selectedCategory: UploadCategory;
  selectedSource: UploadSource;
  onMappingChange: (mappings: ColumnMapping[]) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
  assetFields: AssetFieldMeta[];
  customFields: CustomField[];
  requiredOverrides?: string[];
}

interface MappingState extends ColumnMapping {
  isCustom?: boolean;
  originalMapping?: ColumnMapping;
}

const ColumnMapper: React.FC<ColumnMapperProps> = ({ 
  csvHeaders, 
  sampleData, 
  selectedCategory,
  selectedSource,
  onMappingChange,
  onValidationChange,
  assetFields,
  customFields,
  requiredOverrides = [],
}) => {
  const [mappings, setMappings] = useState<MappingState[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);
  const [showSampleData, setShowSampleData] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Refs to track previous values and prevent infinite loops
  const lastValidationRef = useRef<string>('');
  const lastMappingsRef = useRef<string>('');

  // Specifications base list
  const BASE_SPEC_KEYS = [
    'processor',
    'ram',
    'storage',
    'operatingSystem',
    'osArchitecture',
    'osBuildNumber',
    'ipAddresses',
    'macAddresses',
    'lastOnline',
  ];

  const directFieldKeys = assetFields.map(f => f.key);
  const specKeys = BASE_SPEC_KEYS.filter(key => !directFieldKeys.includes(key));

  // Initialize mappings when headers or source change
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      let templateMappings: ColumnMapping[] = [];

      // NinjaOne special handling (built-in mapping list)
      if (selectedSource === 'ninjaone') {
        // use getMappingForColumn per column, no template list needed.
      } else {
        const config = getImportSource(selectedCategory, selectedSource);
        if (config?.getMappings) {
          const m = await config.getMappings();
          templateMappings = m || [];
      }
    }

    const findDefault = (header: string): ColumnMapping | undefined => {
        if (selectedSource === 'ninjaone') return getMappingForColumn(header);
        return templateMappings.find(m => m.ninjaColumn === header);
    };

    const initialMappings: MappingState[] = csvHeaders.map(header => {
      const defaultMapping = findDefault(header);
      if (defaultMapping) {
        return {
          ...defaultMapping,
          ninjaColumn: header,
          originalMapping: defaultMapping
        };
      }
      // Unknown column - ignore by default
      return {
        ninjaColumn: header,
        targetField: '',
        targetType: 'ignore',
        description: 'Unknown column (will be ignored)',
        isCustom: true
      } as MappingState;
    });

      if (isMounted) setMappings(initialMappings);
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [csvHeaders, selectedCategory, selectedSource]);

  // Validate mappings and notify parent
  useEffect(() => {
    const errors: string[] = [];
    const activeMappings = mappings.filter(m => m.targetType !== 'ignore');
    
    // Check for required fields returned by backend
    let requiredFields = assetFields.filter(f => f.required).map(f => f.key);
    if (requiredOverrides.length) {
      requiredFields = requiredFields.filter(f => !requiredOverrides.includes(f));
    }
    
    // Add source-specific required fields from mappings
    const sourceRequiredFields = activeMappings
      .filter(m => m.required === true)
      .map(m => m.targetField);
    
    // Combine both sets of required fields
    const allRequiredFields = [...new Set([...requiredFields, ...sourceRequiredFields])];
    
    const mappedFields = activeMappings.map(m => m.targetField);
    allRequiredFields.forEach(reqKey => {
      if (!mappedFields.includes(reqKey)) {
        const label = assetFields.find(f => f.key === reqKey)?.label || reqKey;
        errors.push(`Required field "${label}" is not mapped`);
      }
    });

    // Check for duplicate mappings
    const fieldCounts: Record<string, number> = {};
    activeMappings.forEach(m => {
      if (m.targetField) {
        fieldCounts[m.targetField] = (fieldCounts[m.targetField] || 0) + 1;
      }
    });

    Object.entries(fieldCounts).forEach(([field, count]) => {
      if (count > 1) {
        errors.push(`Field "${field}" is mapped multiple times`);
      }
    });

    setValidationErrors(errors);
    
    // Only call parent callbacks if values actually changed
    const isValid = errors.length === 0;
    const validationString = `${isValid}-${JSON.stringify(errors)}`;
    const mappingsString = JSON.stringify(activeMappings);
    
    // Use refs to track previous values to prevent unnecessary calls
    if (lastValidationRef.current !== validationString) {
      lastValidationRef.current = validationString;
      onValidationChange(isValid, errors);
    }
    
    if (lastMappingsRef.current !== mappingsString) {
      lastMappingsRef.current = mappingsString;
      onMappingChange(activeMappings);
    }
  }, [mappings, assetFields, requiredOverrides]);

  const updateMapping = (index: number, updates: Partial<MappingState>) => {
    setMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, ...updates, isCustom: true } : mapping
    ));
  };

  const resetMapping = (index: number) => {
    setMappings(prev => prev.map((mapping, i) => {
      if (i === index && mapping.originalMapping) {
        return {
          ...mapping.originalMapping,
          ninjaColumn: mapping.ninjaColumn,
          originalMapping: mapping.originalMapping
        };
      }
      return mapping;
    }));
  };

  const getTargetTypeIcon = (type: string) => {
    switch (type) {
      case 'direct': return <Database className="w-4 h-4 text-blue-500" />;
      case 'specifications': return <FileText className="w-4 h-4 text-green-500" />;
      case 'custom': return <Settings className="w-4 h-4 text-purple-500" />;
      case 'ignore': return <EyeOff className="w-4 h-4 text-gray-400" />;
      default: return null;
    }
  };

  const getTargetTypeLabel = (type: string) => {
    switch (type) {
      case 'direct': return 'Direct Field';
      case 'specifications': return 'Specifications';
      case 'custom': return 'Custom Field';
      case 'ignore': return 'Ignore';
      default: return type;
    }
  };

  const visibleMappings = showIgnored ? mappings : mappings.filter(m => m.targetType !== 'ignore');
  const ignoredCount = mappings.filter(m => m.targetType === 'ignore').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Column Mapping</h3>
          <p className="text-sm text-gray-600">
            Review and adjust how CSV columns map to asset fields
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSampleData(!showSampleData)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showSampleData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showSampleData ? 'Hide' : 'Show'} Sample Data
          </button>
          
          {ignoredCount > 0 && (
            <button
              onClick={() => setShowIgnored(!showIgnored)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <EyeOff className="w-4 h-4" />
              {showIgnored ? 'Hide' : 'Show'} Ignored ({ignoredCount})
            </button>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Mapping Issues</h4>
              <ul className="mt-2 text-sm text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-6 text-xs font-medium text-gray-700 uppercase tracking-wide">
            <div className="col-span-3">CSV Column</div>
            <div className="col-span-1 text-center">→</div>
            <div className="col-span-3">Target Field</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Description</div>
            <div className="col-span-1">Actions</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {visibleMappings.map((mapping, index) => {
            const actualIndex = mappings.indexOf(mapping);
            const sampleValue = sampleData[0]?.[mapping.ninjaColumn] || '';
            
            return (
              <div key={mapping.ninjaColumn} className="px-6 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-12 gap-6 items-start">
                                      {/* CSV Column */}
                    <div className="col-span-3">
                      <div className="font-medium text-gray-900 text-sm">{mapping.ninjaColumn}</div>
                      {showSampleData && sampleValue && (
                        <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded border" title={sampleValue}>
                          <span className="font-medium">Sample:</span> {sampleValue.length > 50 ? sampleValue.substring(0, 50) + '...' : sampleValue}
                        </div>
                      )}
                    </div>

                  {/* Arrow */}
                  <div className="col-span-1 flex justify-center">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>

                                      {/* Target Field */}
                    <div className="col-span-3">
                      <select
                        value={mapping.targetField}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('cf_')) {
                            updateMapping(actualIndex, { targetField: val, targetType: 'custom' });
                          } else if (val) {
                            updateMapping(actualIndex, { targetField: val, targetType: 'direct' });
                          } else {
                            updateMapping(actualIndex, { targetField: '', targetType: 'ignore' });
                          }
                        }}
                        className="w-full text-sm border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 py-2"
                      >
                        <option value="">-- Ignore --</option>
                        {assetFields.length > 0 && (
                          <optgroup label="Direct Fields">
                            {assetFields.map(f => (
                              <option key={f.key} value={f.key}>
                                {f.label}{f.required ? ' *' : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {customFields.length > 0 && (
                          <optgroup label="Custom Fields">
                            {customFields.map(cf => (
                              <option key={`cf_${cf.id}`} value={`cf_${cf.id}`}>
                                {cf.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Specifications">
                          {specKeys.map(spec => (
                            <option key={spec} value={spec}>{spec.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}</option>
                          ))}
                        </optgroup>
                      </select>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      {getTargetTypeIcon(mapping.targetType)}
                      <span className="text-sm text-gray-600">
                        {getTargetTypeLabel(mapping.targetType)}
                      </span>
                    </div>
                  </div>

                                      {/* Description */}
                    <div className="col-span-2">
                      <div className="text-sm text-gray-600 leading-relaxed">{mapping.description}</div>
                      {mapping.processor && (
                        <div className="flex items-center gap-1 mt-2 px-2 py-1 bg-blue-50 rounded text-xs">
                          <Info className="w-3 h-3 text-blue-500" />
                          <span className="text-blue-600 font-medium">Auto-processed</span>
                        </div>
                      )}
                    </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-1">
                      {mapping.isCustom && mapping.originalMapping && (
                        <button
                          onClick={() => resetMapping(actualIndex)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Reset to default mapping"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      
                      {mapping.targetType !== 'ignore' && (
                        <div className="w-4 h-4 flex items-center justify-center">
                          <Check className="w-3 h-3 text-green-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Mapping Summary</p>
            <ul className="mt-2 space-y-1">
              <li>• {mappings.filter(m => m.targetType === 'direct').length} columns → Direct fields</li>
              <li>• {mappings.filter(m => m.targetType === 'specifications').length} columns → Specifications JSON</li>
              <li>• {mappings.filter(m => m.targetType === 'ignore').length} columns → Ignored</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnMapper; 