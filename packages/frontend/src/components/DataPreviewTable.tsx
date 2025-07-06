import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Database,
  FileText,
  User,
  X
} from 'lucide-react';
import { ColumnMapping, processNinjaRow, validateRequiredFields } from '../utils/ninjaMapping';

interface DataPreviewTableProps {
  csvData: {
    headers: string[];
    rows: Record<string, string>[];
  };
  mappings: ColumnMapping[];
  sourceType: 'ninja' | 'bgc';
  userMap: Record<string, { id: string; displayName: string; officeLocation?: string } | null>;
  locationMap: Record<string, string | null>;
  conflicts?: Record<string, { id: string; assetTag: string; serialNumber: string }>;
  onRemoveItem?: (index: number) => void;
  showRemoveOption?: boolean;
}

interface ProcessedRow {
  originalData: Record<string, string>;
  directFields: Record<string, any>;
  specifications: Record<string, any>;
  processingNotes: string[];
  validationErrors: string[];
  index: number;
  assignedToDisplayName?: string;
  locationDisplayName?: string;
}

const DataPreviewTable: React.FC<DataPreviewTableProps> = ({ 
  csvData, 
  mappings, 
  sourceType, 
  userMap, 
  locationMap, 
  conflicts = {},
  onRemoveItem,
  showRemoveOption = false
}) => {
  const [showProcessedData, setShowProcessedData] = useState(true);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  // Process all rows for preview
  const processedRows: ProcessedRow[] = csvData.rows.map((row, index) => {
    const { directFields, specifications, processingNotes: initialProcessingNotes } = processNinjaRow(row);
    const validationErrors = validateRequiredFields(directFields);
    const processingNotes = [...initialProcessingNotes]; // Create mutable copy

    let assignedToDisplayName: string | undefined = undefined;
    let locationDisplayName: string | undefined = undefined;

    // Resolve username and update notes/errors
    const usernameToResolve = directFields.assignedToAadId;
    if (usernameToResolve) {
      const userMatch = userMap[usernameToResolve];
      if (userMatch) {
        directFields.assignedToAadId = userMatch.id;
        assignedToDisplayName = userMatch.displayName;
        // Get location from user's office location
        if (userMatch.officeLocation) {
          locationDisplayName = userMatch.officeLocation;
        }
        const noteIndex = processingNotes.findIndex(note => note.includes(`Username "${usernameToResolve}"`));
        if (noteIndex > -1) {
          processingNotes.splice(noteIndex, 1);
        }
      } else if (Object.keys(userMap).length > 0) {
        validationErrors.push(`User '${usernameToResolve}' not found in Azure AD.`);
      }
    }
    
    // NOTE: This assumes a 'location' field is mapped from CSV. 
    // A future step will be to get location from resolved user profile.
    const locationStringToResolve = directFields.locationId; 
    if (locationStringToResolve) {
        const locId = locationMap[locationStringToResolve];
        if (locId) {
            directFields.locationId = locId;
            locationDisplayName = locationStringToResolve; // show original string for now
             const noteIndex = processingNotes.findIndex(note => note.includes(`Location "${locationStringToResolve}"`));
            if (noteIndex > -1) {
              processingNotes.splice(noteIndex, 1);
            }
        } else if (Object.keys(locationMap).length > 0) {
            validationErrors.push(`Location '${locationStringToResolve}' not found.`);
        }
    }

    // Check for conflicts
    const serialNumber = directFields.serialNumber;
    if (serialNumber && conflicts[serialNumber]) {
      const conflict = conflicts[serialNumber];
      validationErrors.push(`Serial number conflict: Asset ${conflict.assetTag} (ID: ${conflict.id}) already exists with this serial number.`);
    }

    return {
      originalData: row,
      directFields,
      specifications,
      processingNotes,
      validationErrors,
      index,
      assignedToDisplayName,
      locationDisplayName,
    };
  });

  const totalErrors = processedRows.reduce((count, row) => count + row.validationErrors.length, 0);
  const totalWarnings = processedRows.reduce((count, row) => count + row.processingNotes.length, 0);

  const getRowStatusIcon = (row: ProcessedRow) => {
    if (row.validationErrors.length > 0) {
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    if (row.processingNotes.length > 0) {
      return <Info className="w-4 h-4 text-amber-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getRowStatusText = (row: ProcessedRow) => {
    if (row.validationErrors.length > 0) return 'Errors';
    if (row.processingNotes.length > 0) return 'Warnings';
    return 'Ready';
  };

  const getRowStatusColor = (row: ProcessedRow) => {
    if (row.validationErrors.length > 0) return 'text-red-700 bg-red-50 border-red-200';
    if (row.processingNotes.length > 0) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-green-700 bg-green-50 border-green-200';
  };

  return (
    <div className="space-y-3">
      {/* Compact Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Data Preview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {csvData.rows.length} rows to import
            </p>
          </div>
          
          {/* Inline Stats */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-700 dark:text-green-300 font-medium">
                {processedRows.filter(r => r.validationErrors.length === 0).length} Ready
              </span>
            </div>
            {totalWarnings > 0 && (
              <div className="flex items-center gap-1">
                <Info className="w-4 h-4 text-amber-500" />
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {totalWarnings} Warnings
                </span>
              </div>
            )}
            {totalErrors > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-red-700 dark:text-red-300 font-medium">
                  {totalErrors} Errors
                </span>
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={() => setShowProcessedData(!showProcessedData)}
          className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {showProcessedData ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showProcessedData ? 'Original' : 'Processed'}
        </button>
      </div>

      {/* Compact Data Table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
          <div className={`grid gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide ${showRemoveOption ? 'grid-cols-10' : 'grid-cols-9'}`}>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Asset Tag</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-1">Serial #</div>
            <div className="col-span-1">Memory</div>
            <div className="col-span-1">Storage</div>
            <div className="col-span-1">Location</div>
            <div className="col-span-1">Actions</div>
            {showRemoveOption && <div className="col-span-1">Remove</div>}
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
          {processedRows.map((row) => (
            <React.Fragment key={row.index}>
              <div className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className={`grid gap-2 items-center ${showRemoveOption ? 'grid-cols-10' : 'grid-cols-9'}`}>
                  <div className="col-span-1">
                    <div className="flex items-center gap-1">
                      {getRowStatusIcon(row)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">#{row.index + 1}</span>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <div className="font-medium text-gray-900 dark:text-gray-100 text-xs truncate">
                      {showProcessedData ? row.directFields.assetTag : row.originalData['Display Name']}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {showProcessedData 
                        ? `${row.directFields.make || ''} ${row.directFields.model || ''}`.trim() || 'No model'
                        : `${row.originalData['System Manufacturer'] || ''} ${row.originalData['System Model'] || ''}`.trim() || 'No model'
                      }
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {showProcessedData 
                        ? row.assignedToDisplayName || 'Unassigned'
                        : row.originalData['Last LoggedIn User'] || 'Unassigned'
                      }
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {showProcessedData ? row.directFields.assetType : row.originalData['Role']}
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate font-mono">
                      {showProcessedData 
                        ? row.directFields.serialNumber || 'N/A'
                        : row.originalData['Serial Number'] || 'N/A'
                      }
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {showProcessedData 
                        ? row.directFields.ram || 'N/A'
                        : row.originalData['Total RAM'] || 'N/A'
                      }
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {showProcessedData 
                        ? row.directFields.storage || 'N/A'
                        : row.originalData['Total Storage'] || 'N/A'
                      }
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {row.locationDisplayName || 'Unknown'}
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <button 
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      onClick={() => setSelectedRow(selectedRow === row.index ? null : row.index)}
                    >
                      {selectedRow === row.index ? 'Hide' : 'Details'}
                    </button>
                  </div>
                  
                  {showRemoveOption && (
                    <div className="col-span-1">
                      <button
                        onClick={() => onRemoveItem?.(row.index)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Remove this item from import"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Expanded Row Details */}
              {selectedRow === row.index && (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Direct Fields */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Database className="w-3 h-3 text-blue-500" />
                        <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100">Direct Fields</h4>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(row.directFields).slice(0, 6).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400 capitalize truncate">{key.replace(/([A-Z])/g, ' $1')}:</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-32">
                              {key === 'assignedToAadId' && row.assignedToDisplayName
                                ? row.assignedToDisplayName
                                : String(value) || 'N/A'
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Specifications */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText className="w-3 h-3 text-green-500" />
                        <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100">Specifications</h4>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(row.specifications).slice(0, 4).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400 truncate">{key}:</span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-32">
                              {String(value) || 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Issues & Notes */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100">Issues & Notes</h4>
                      </div>
                      <div className="space-y-1">
                        {row.validationErrors.map((error, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                            <AlertTriangle className="w-3 h-3 mt-0.5 text-red-500 flex-shrink-0" />
                            <span className="truncate">{error}</span>
                          </div>
                        ))}
                        {row.processingNotes.map((note, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                            <Info className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
                            <span className="truncate">{note}</span>
                          </div>
                        ))}
                        {row.validationErrors.length === 0 && row.processingNotes.length === 0 && (
                          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span>No issues found</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Import Summary */}
      {totalErrors === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <div className="text-sm text-green-800 dark:text-green-200">
              <span className="font-medium">Ready to Import:</span>
              <span className="ml-1">
                All {csvData.rows.length} assets are valid and ready for import.
                {totalWarnings > 0 && ` ${totalWarnings} warnings noted.`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPreviewTable; 