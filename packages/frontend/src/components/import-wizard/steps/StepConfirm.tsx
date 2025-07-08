import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  X,
  User,
  MapPin,
  AlertCircle
} from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import DataPreviewTable from '../../../components/DataPreviewTable';
import { generateSessionId } from '../../../hooks/useImportAssets';
import type { ColumnMapping } from '../../../utils/ninjaMapping';

interface Props {
  countToImport: number;
  lastOnlineExcluded: number;
  conflictCount: number;
  conflictResolution: 'skip' | 'overwrite';
  setConflictResolution: (value: 'skip' | 'overwrite') => void;
  selectedSource: string | null;
  enableLastOnlineFilter: boolean;
  setEnableLastOnlineFilter: (value: boolean) => void;
  lastOnlineMaxDays: number;
  setLastOnlineMaxDays: (value: number) => void;
  csvHeaders: string[];
  previewRows: Record<string, string>[];
  columnMappings: ColumnMapping[];
  userMap: Record<string, { id: string; displayName: string; officeLocation?: string } | null>;
  locationMap: Record<string, string | null>;
  conflicts: Record<string, { id: string; assetTag: string; serialNumber: string }>;
  excludedItems: Record<string, string>[];
  onRemoveItem: (index: number) => void;
  onConfirmImport: (importData: any) => void;
  isImporting: boolean;
}

const StepConfirm: React.FC<Props> = ({
  countToImport,
  lastOnlineExcluded,
  conflictCount,
  conflictResolution,
  setConflictResolution,
  selectedSource,
  enableLastOnlineFilter,
  setEnableLastOnlineFilter,
  lastOnlineMaxDays,
  setLastOnlineMaxDays,
  csvHeaders,
  previewRows,
  columnMappings,
  userMap,
  locationMap,
  conflicts,
  excludedItems,
  onRemoveItem,
  onConfirmImport,
  isImporting
}) => {
  const [conflictExpanded, setConflictExpanded] = useState(false);
  const [excludedExpanded, setExcludedExpanded] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImportClick = async () => {
    setImportError(null);
    
    // Generate session ID for progress tracking
    const sessionId = generateSessionId();
    
    // Prepare column mappings for backend (rename 'required' -> 'isRequired')
    const backendMappings = columnMappings.map((m: any) => {
      const { required, ...rest } = m as any;
      return {
        ...rest,
        isRequired: required ?? false,
      } as any;
    });

    // Transform previewRows: replace location strings with resolved IDs (if mapping exists)
    const locationColumn = columnMappings.find(m => m.targetField === 'locationId')?.ninjaColumn;
    const transformedRows = previewRows.map(row => {
      if (locationColumn) {
        const locName = row[locationColumn];
        const locId = locationMap[locName];
        if (locId) {
          return { ...row, [locationColumn]: locId };
        }
      }
      return row;
    });

    // Prepare data for import
    const importData = {
      assets: transformedRows,
      columnMappings: backendMappings,
      conflictResolution,
      source: selectedSource || '',
      sessionId: sessionId,
      resolvedUserMap: userMap,
      resolvedLocationMap: locationMap
    };

    // Pass data to parent to start import process
    onConfirmImport(importData);
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Ready to Import</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Review your import settings and start the import process</p>
          </div>
        </div>

        {/* Import Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">Assets to Import</h4>
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{countToImport}</div>
            <p className="text-sm text-blue-700 dark:text-blue-300">Ready for import</p>
          </div>

          {conflictCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">Conflicts</h4>
              </div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{conflictCount}</div>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Will be {conflictResolution === 'skip' ? 'skipped' : 'overwritten'}
              </p>
            </div>
          )}

          {lastOnlineExcluded > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Excluded</h4>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{lastOnlineExcluded}</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">By last online filter</p>
            </div>
          )}
        </div>

        {/* Conflict Resolution */}
        {conflictCount > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Conflict Resolution</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="conflictResolution"
                  value="skip"
                  checked={conflictResolution === 'skip'}
                  onChange={(e) => setConflictResolution(e.target.value as 'skip' | 'overwrite')}
                  className="w-4 h-4 text-brand-600 border-slate-300 dark:border-slate-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>Skip existing assets</strong> - Don't import assets that already exist
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="conflictResolution"
                  value="overwrite"
                  checked={conflictResolution === 'overwrite'}
                  onChange={(e) => setConflictResolution(e.target.value as 'skip' | 'overwrite')}
                  className="w-4 h-4 text-brand-600 border-slate-300 dark:border-slate-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>Overwrite existing assets</strong> - Update existing assets with new data
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Last Online Filter (NinjaOne only) */}
        {selectedSource === 'ninjaone' && (
          <div className="mt-6">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Last Online Filter
            </h4>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={enableLastOnlineFilter}
                onChange={(e) => setEnableLastOnlineFilter(e.target.checked)}
                className="w-4 h-4 text-brand-600 border-slate-300 dark:border-slate-600 rounded focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Exclude devices offline for more than
              </span>
              <input
                type="number"
                value={lastOnlineMaxDays}
                onChange={(e) => setLastOnlineMaxDays(Math.max(1, parseInt(e.target.value) || 30))}
                min="1"
                max="365"
                className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-slate-100"
                disabled={!enableLastOnlineFilter}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">days</span>
            </label>
            {enableLastOnlineFilter && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Devices last seen more than {lastOnlineMaxDays} days ago will be excluded
              </p>
            )}
          </div>
        )}

        {/* Data Preview */}
        <div className="mt-6">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" /> Data Preview - Ready to Import
          </h4>
          <DataPreviewTable
            csvData={{ headers: csvHeaders, rows: previewRows }}
            mappings={columnMappings}
            sourceType={selectedSource === 'ninjaone' ? 'ninja' : 'bgc'}
            userMap={userMap}
            locationMap={locationMap}
            conflicts={conflicts}
            onRemoveItem={onRemoveItem}
            showRemoveOption={true}
          />
        </div>

        {/* Import Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isImporting ? 'Importing...' : `Import ${countToImport} Asset${countToImport!==1?'s':''}`}
          </button>
        </div>
      </div>

      {/* Excluded Items Section */}
      {excludedItems.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <Collapsible.Root open={excludedExpanded} onOpenChange={setExcludedExpanded}>
            <Collapsible.Trigger className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Excluded Items</h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    {excludedItems.length} items excluded by filters
                  </p>
                </div>
              </div>
              {excludedExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div className="px-6 pb-6">
                <DataPreviewTable
                  csvData={{ headers: csvHeaders, rows: excludedItems.slice(0, 10) }}
                  mappings={columnMappings}
                  sourceType={selectedSource === 'ninjaone' ? 'ninja' : 'bgc'}
                  userMap={userMap}
                  locationMap={locationMap}
                  conflicts={conflicts}
                />
                {excludedItems.length > 10 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
                    ... and {excludedItems.length - 10} more excluded items
                  </p>
                )}
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        </div>
      )}

      {/* Conflicts Detail */}
      {conflictCount > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <Collapsible.Root open={conflictExpanded} onOpenChange={setConflictExpanded}>
            <Collapsible.Trigger className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Conflicts Found</h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    {conflictCount} assets have serial number conflicts
                  </p>
                </div>
              </div>
              {conflictExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  {Object.entries(conflicts).map(([serialNumber, conflict]) => (
                    <div key={serialNumber} className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                            Serial Number: {serialNumber}
                          </h4>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            Already exists as Asset {conflict.assetTag} (ID: {conflict.id})
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        </div>
      )}

      {/* Import Error */}
      {importError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h4 className="font-semibold text-red-900 dark:text-red-100">Import Error</h4>
          </div>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">{importError}</p>
        </div>
      )}
    </div>
  );
};

export default StepConfirm; 