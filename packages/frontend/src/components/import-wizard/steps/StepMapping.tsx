import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import DataPreviewTable from '../../../components/DataPreviewTable';
import { useImportPreview } from '../../../hooks/useImportPreview';
import ColumnMapper from '../../../components/ColumnMapper';
import type { ColumnMapping } from '../../../utils/ninjaMapping';
import type { AssetFieldMeta } from '../../../services/api';
import type { CustomField } from '@ats/shared';
import { getImportSource } from '../../../utils/importSources';

interface Props {
  csvHeaders: string[];
  sampleRows: Record<string, string>[];
  sourceType: 'ninja' | 'bgc';
  assetFields: AssetFieldMeta[];
  customFields: CustomField[];
  columnMappings: ColumnMapping[];
  onMappingChange: (mappings: ColumnMapping[]) => void;
  onValidationChange: (valid: boolean, errors: string[]) => void;
  mappingValid: boolean;
  filterStats: { total: number; included: number; excluded: number; filterName: string } | null;
  excludedItems: Record<string, string>[];
  resolveError: boolean;
  enableLastOnlineFilter: boolean;
  lastOnlineMaxDays: number;
  getFilterDescription: (key: string, days: number) => string;
}

const StepMapping: React.FC<Props> = ({
  csvHeaders,
  sampleRows,
  sourceType,
  assetFields,
  customFields,
  columnMappings,
  onMappingChange,
  onValidationChange,
  mappingValid,
  filterStats,
  excludedItems,
  resolveError,
  enableLastOnlineFilter,
  lastOnlineMaxDays,
  getFilterDescription,
}) => {
  const [mappingExpanded, setMappingExpanded] = useState(true);
  // Preview has moved to StepConfirm; no expanded state needed here
  // Excluded items section moved to StepConfirm

  const {
    resolvedUserMap,
    resolvedLocationMap,
    conflicts,
  } = useImportPreview({
    rows: sampleRows,
    headers: csvHeaders,
    columnMappings,
    selectedSource: sourceType === 'ninja' ? 'ninjaone' : 'bgc-template',
    selectedCategory: 'endpoints',
    enableLastOnlineFilter,
    lastOnlineMaxDays,
  });

  const selectedSourceConfig = getImportSource('endpoints', sourceType === 'ninja' ? 'ninjaone' : 'bgc-template');
  const requiredOverrides = selectedSourceConfig?.requiredOverrides || [];

  // handleMappingChange no longer needed (handled within ColumnMapper)

  return (
    <div className="space-y-6">
      {/* Column Mapping Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <Collapsible.Root open={mappingExpanded} onOpenChange={setMappingExpanded}>
          <Collapsible.Trigger className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Column Mapping</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Map your CSV columns to asset fields</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!mappingValid && (
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Issues found</span>
                </div>
              )}
              {mappingExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <div className="px-6 pb-6">
              {/* Column Mapper */}
              <ColumnMapper
                csvHeaders={csvHeaders}
                sampleData={sampleRows}
                sourceType={sourceType}
                onMappingChange={onMappingChange}
                onValidationChange={onValidationChange}
                assetFields={assetFields}
                customFields={customFields}
                requiredOverrides={requiredOverrides}
              />
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>

      {/* Preview section and excluded items moved to StepConfirm */}
    </div>
  );
};

export default StepMapping; 