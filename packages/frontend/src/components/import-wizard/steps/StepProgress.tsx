import React from 'react';
import { Loader2, AlertCircle, Check, ChevronDown, AlertTriangle, Zap, User, Monitor, MapPin, Upload } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import type { ImportProgress } from '../../../hooks/useImportAssets';

// Match the full structure of the import result from the backend
interface ImportResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ index: number; error: string; data?: any }>;
  skippedItems: Array<{ index: number; reason: string; data?: any }>;
  created: Array<{ id: string; assetTag: string }>;
  statistics?: {
    categorizedAssets: Array<{ assetTag: string; categoryName: string; ruleName: string }>;
    uniqueUsers: string[];
    uniqueLocations: string[];
    assetTypeBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  };
}

interface Props {
  isLoading: boolean;
  progress: ImportProgress | null;
  elapsedTime: number;
  totalToImport: number;
  formatElapsed: (ms: number) => string;
  importResults: ImportResult | null;
  onViewAssets: () => void;
  onImportMore: () => void;
}

const StepProgress: React.FC<Props> = ({
  isLoading,
  progress,
  elapsedTime,
  totalToImport,
  formatElapsed,
  importResults,
  onViewAssets,
  onImportMore,
}) => {
  // --- Loading State ---
  if (isLoading) {
    const pct = progress ? Math.round((progress.processed / progress.total) * 100) : 5;

    return (
      <div className="space-y-6">
        {/* Main Progress Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Importing Assets...</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Processing {totalToImport} assets. This may take a few minutes.
                {progress && (
                  <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                    ({progress.processed} of {progress.total} processed)
                  </span>
                )}
              </p>
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(pct, 5)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span>
                  {progress?.currentItem ? `Processing: ${progress.currentItem}` : 'Processing assets...'}
                </span>
                <span>
                  {progress
                    ? `${pct}% • ${formatElapsed(elapsedTime)}`
                    : elapsedTime > 0
                    ? `Elapsed: ${formatElapsed(elapsedTime)}`
                    : 'Please wait'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Please don't close this page while the import is in progress.
          </div>
        </div>

        {/* Real-time Statistics */}
        {progress && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Live Import Statistics</h3>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Successful */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {progress.successful || 0}
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-300">
                      Successful
                    </div>
                  </div>
                </div>
                <div className="text-sm text-emerald-600 dark:text-emerald-400">
                  Assets imported
                </div>
              </div>

              {/* Failed */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-md">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">
                      {progress.failed || 0}
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-300">
                      Failed
                    </div>
                  </div>
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  Import errors
                </div>
              </div>

              {/* Skipped */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {progress.skipped || 0}
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      Skipped
                    </div>
                  </div>
                </div>
                <div className="text-sm text-amber-600 dark:text-amber-400">
                  Bypassed items
                </div>
              </div>

              {/* Auto-Categorized */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                    <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {progress.categorizedAssets?.length || 0}
                    </div>
                    <div className="text-xs text-purple-700 dark:text-purple-300">
                      Categorized
                    </div>
                  </div>
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  Workload detected
                </div>
              </div>
            </div>

            {/* Live Asset Type Breakdown */}
            {progress.assetTypeBreakdown && Object.keys(progress.assetTypeBreakdown).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Asset Types Being Processed</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(progress.assetTypeBreakdown).map(([type, count]) => (
                    <div key={type} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{type}</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live User Assignments */}
            {progress.uniqueUsers && progress.uniqueUsers.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Users Assigned: {progress.uniqueUsers.length}
                </h4>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                  <div className="flex flex-wrap gap-2">
                    {progress.uniqueUsers.slice(0, 10).map((user, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        {user}
                      </span>
                    ))}
                    {progress.uniqueUsers.length > 10 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 px-2 py-1">
                        +{progress.uniqueUsers.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Workload Categorizations */}
            {progress.categorizedAssets && progress.categorizedAssets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Recent Workload Categorizations
                </h4>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800 max-h-32 overflow-y-auto">
                  <div className="space-y-2">
                    {progress.categorizedAssets.slice(-5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-purple-800 dark:text-purple-200">{item.assetTag}</span>
                        <span className="text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded text-xs">
                          {item.categoryName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Empty State ---
  if (!importResults) return null;

  // --- Results State ---
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-blue-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md">
        <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))]" />
        <div className="relative px-6 py-6 text-center">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 shadow-md ${
            importResults.failed > 0 
              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
              : 'bg-gradient-to-br from-emerald-400 to-green-500 text-white'
          }`}>
            <Check className="w-6 h-6" />
          </div>
          
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent mb-2">
            Import {importResults.failed > 0 ? 'Completed with Issues' : 'Successfully Completed'}
          </h1>
          
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            {importResults.failed > 0 
              ? `${importResults.successful} assets imported successfully with ${importResults.failed} issues to review`
              : `All ${importResults.successful} assets have been successfully imported into your system`
            }
          </p>
          
          {/* Success Rate Bar */}
          <div className="mt-4 max-w-sm mx-auto">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
              <span>Success Rate</span>
              <span>{Math.round((importResults.successful / importResults.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${(importResults.successful / importResults.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Successful */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {importResults.successful}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Successful
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Assets imported without issues
          </div>
        </div>

        {/* Failed */}
        <Collapsible.Root>
          <Collapsible.Trigger asChild>
            <button className={`w-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-all text-left ${
              importResults.failed > 0 ? 'hover:shadow-md hover:border-red-300 dark:hover:border-red-700 cursor-pointer' : 'cursor-default'
            }`} disabled={importResults.failed === 0}>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-md">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                    {importResults.failed}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Failed
                    {importResults.failed > 0 && <ChevronDown className="w-3 h-3" />}
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Assets with import errors
              </div>
            </button>
          </Collapsible.Trigger>
          
          {importResults.failed > 0 && (
            <Collapsible.Content className="mt-4">
              <div className="bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-red-900 dark:text-red-100 text-sm">
                    Error Details ({importResults.errors.length})
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const errorText = importResults.errors
                        .map(error => {
                          const assetName = error.data?.['Display Name'] ? ` (${error.data['Display Name']})` : '';
                          return `Row ${error.index + 1}${assetName}: ${error.error}`;
                        })
                        .join('\n');
                      navigator.clipboard.writeText(errorText);
                    }}
                    className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    Copy All
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importResults.errors.map((error, index) => (
                    <div key={index} className="bg-white dark:bg-slate-800 rounded p-2 border border-red-200 dark:border-red-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-red-800 dark:text-red-200">
                              Row {error.index + 1}
                            </span>
                            {error.data?.['Display Name'] && (
                              <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                {error.data['Display Name']}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-red-700 dark:text-red-300">
                            {error.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Collapsible.Content>
          )}
        </Collapsible.Root>

        {/* Skipped */}
        <Collapsible.Root>
          <Collapsible.Trigger asChild>
            <button className={`w-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-all text-left ${
              importResults.skipped > 0 ? 'hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 cursor-pointer' : 'cursor-default'
            }`} disabled={importResults.skipped === 0}>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {importResults.skipped}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Skipped
                    {importResults.skipped > 0 && <ChevronDown className="w-3 h-3" />}
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Assets bypassed by filters
              </div>
            </button>
          </Collapsible.Trigger>
          
          {importResults.skipped > 0 && (
            <Collapsible.Content className="mt-4">
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm">
                    Skipped Details ({importResults.skippedItems?.length || 0})
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const skippedText = (importResults.skippedItems || [])
                        .map(item => {
                          const assetName = item.data?.['Display Name'] ? ` (${item.data['Display Name']})` : '';
                          return `Row ${item.index + 1}${assetName}: ${item.reason}`;
                        })
                        .join('\n');
                      navigator.clipboard.writeText(skippedText);
                    }}
                    className="px-3 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                  >
                    Copy All
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importResults.skippedItems?.map((item, index) => (
                    <div key={index} className="bg-white dark:bg-slate-800 rounded p-2 border border-amber-200 dark:border-amber-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              Row {item.index + 1}
                            </span>
                            {item.data?.['Display Name'] && (
                              <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                {item.data['Display Name']}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            {item.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Collapsible.Content>
          )}
        </Collapsible.Root>

        {/* Total */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-md">
              <Loader2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-slate-600 dark:text-slate-400">
                {importResults.total}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Processed
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Assets in import batch
          </div>
        </div>
      </div>

      {/* Intelligence Insights */}
      {importResults.statistics && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Intelligence Insights
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Automated analysis and categorization results
            </p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Auto-Categorized */}
              {importResults.statistics?.categorizedAssets.length > 0 ? (
                <Collapsible.Root>
                  <Collapsible.Trigger asChild>
                    <button className="group w-full bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4 text-left hover:shadow-md transition-all duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 bg-purple-500 rounded-md shadow-sm">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <ChevronDown className="w-3 h-3 text-purple-600 dark:text-purple-400 group-hover:transform group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-lg font-bold text-purple-700 dark:text-purple-300 mb-1">
                        {importResults.statistics.categorizedAssets.length}
                      </div>
                      <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                        Auto-Categorized
                      </div>
                      <div className="text-xs text-purple-500 dark:text-purple-500">
                        AI workload detection
                      </div>
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content className="mt-4">
                    <div className="bg-purple-50/80 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-purple-900 dark:text-purple-100">
                          Workload Categories Applied
                        </h5>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const categorizedText = importResults.statistics?.categorizedAssets
                              ?.map(item => `${item.assetTag}: ${item.categoryName} (${item.ruleName})`)
                              .join('\n') || '';
                            navigator.clipboard.writeText(categorizedText);
                          }}
                          className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importResults.statistics?.categorizedAssets.map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded">
                            <span className="text-xs font-mono text-purple-800 dark:text-purple-200">{c.assetTag}</span>
                            <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded text-xs">{c.categoryName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Collapsible.Content>
                </Collapsible.Root>
              ) : (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 text-center opacity-60">
                  <div className="p-1.5 bg-slate-300 dark:bg-slate-600 rounded-md mx-auto mb-2 w-fit">
                    <Zap className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-lg font-bold text-slate-400 mb-1">0</div>
                  <div className="text-sm text-slate-500">Auto-Categorized</div>
                </div>
              )}

              {/* Unique Users */}
              {importResults.statistics?.uniqueUsers.length > 0 ? (
                <Collapsible.Root>
                  <Collapsible.Trigger asChild>
                    <button className="group w-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 text-left hover:shadow-md transition-all duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 bg-blue-500 rounded-md shadow-sm">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400 group-hover:transform group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-300 mb-1">
                        {importResults.statistics?.uniqueUsers.length}
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        Unique Users
                      </div>
                      <div className="text-xs text-blue-500 dark:text-blue-500">
                        Asset assignments
                      </div>
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content className="mt-4">
                    <div className="bg-blue-50/80 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Assigned Users
                        </h5>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(importResults.statistics?.uniqueUsers.join('\n') || '');
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                        {importResults.statistics?.uniqueUsers.map((u, idx) => (
                          <div key={idx} className="text-xs font-mono text-blue-800 dark:text-blue-200 bg-white dark:bg-slate-800 rounded px-2 py-1 border border-blue-200 dark:border-blue-700">
                            {u}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Collapsible.Content>
                </Collapsible.Root>
              ) : (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 text-center opacity-60">
                  <div className="p-1.5 bg-slate-300 dark:bg-slate-600 rounded-md mx-auto mb-2 w-fit">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-lg font-bold text-slate-400 mb-1">0</div>
                  <div className="text-sm text-slate-500">Unique Users</div>
                </div>
              )}

              {/* Asset Types */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-emerald-500 rounded-md shadow-sm">
                    <Monitor className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                  {Object.keys(importResults.statistics?.assetTypeBreakdown || {}).length}
                </div>
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-2">
                  Asset Types
                </div>
                <div className="space-y-0.5">
                  {Object.entries(importResults.statistics?.assetTypeBreakdown || {}).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-xs">
                      <span className="text-emerald-700 dark:text-emerald-300">{type}</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Types */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg border border-orange-200 dark:border-orange-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-orange-500 rounded-md shadow-sm">
                    <AlertCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300 mb-1">
                  {Object.keys(importResults.statistics?.statusBreakdown || {}).length}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-2">
                  Status Types
                </div>
                <div className="space-y-0.5">
                  {Object.entries(importResults.statistics?.statusBreakdown || {}).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-xs">
                      <span className="text-orange-700 dark:text-orange-300">{status}</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Unique Locations */}
            {importResults.statistics?.uniqueLocations.length > 0 && (
              <Collapsible.Root>
                <Collapsible.Trigger asChild>
                  <button className="group w-full bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg border border-teal-200 dark:border-teal-800 p-4 text-left hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-500 rounded-md shadow-sm">
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-teal-700 dark:text-teal-300">
                            {importResults.statistics?.uniqueLocations.length}
                          </div>
                          <div className="text-sm text-teal-600 dark:text-teal-400 font-medium">
                            Unique Locations
                          </div>
                          <div className="text-xs text-teal-500 dark:text-teal-500 hidden sm:block">
                            Geographic distribution
                          </div>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:transform group-hover:scale-110 transition-transform" />
                    </div>
                  </button>
                </Collapsible.Trigger>
                <Collapsible.Content className="mt-4">
                  <div className="bg-teal-50/80 dark:bg-teal-900/10 rounded-lg border border-teal-200 dark:border-teal-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium text-teal-900 dark:text-teal-100">
                        Asset Locations
                      </h5>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(importResults.statistics?.uniqueLocations.join('\n') || '');
                        }}
                        className="px-3 py-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-md hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors"
                      >
                        Copy All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {importResults.statistics?.uniqueLocations.map((location, idx) => (
                        <div key={idx} className="text-xs text-teal-800 dark:text-teal-200 bg-white dark:bg-slate-800 rounded px-2 py-1 border border-teal-200 dark:border-teal-700 font-medium">
                          {location}
                        </div>
                      ))}
                    </div>
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            )}
          </div>
        </div>
      )}

      {/* Action Center */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 text-center">
            Next Steps
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onViewAssets}
              className="px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-lg hover:from-brand-700 hover:to-brand-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              View Imported Assets
            </button>
            <button
              onClick={onImportMore}
              className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import More Assets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepProgress; 