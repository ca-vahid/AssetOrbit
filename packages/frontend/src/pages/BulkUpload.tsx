import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StepIndicator from '../components/StepIndicator';
import { 
  IMPORT_SOURCES, 
  getImportSource, 
  type UploadCategory,
  type UploadSource,
  type ImportSourceConfig
} from '../utils/importSources';
import { applyImportFilter, getFilterKey, getFilterDescription } from '../utils/importFilters';
import { useAssetFields } from '../hooks/useAssetFields';
import { useCustomFields } from '../hooks/useCustomFields';
import { useQueryClient } from '@tanstack/react-query';
import { useImportAssets, useImportProgress, type ImportProgress } from '../hooks/useImportAssets';
import StepSelectCategory from '../components/import-wizard/steps/StepSelectCategory';
import StepSelectSource from '../components/import-wizard/steps/StepSelectSource';
import StepMapping from '../components/import-wizard/steps/StepMapping';
import StepProgress from '../components/import-wizard/steps/StepProgress';
import StepConfirm from '../components/import-wizard/steps/StepConfirm';
import type { ColumnMapping } from '../utils/ninjaMapping';
// NEW: import resolver hook for usernames / locations / conflicts
import { useResolveImport } from '../hooks/useResolveImport';

const BulkUpload: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<UploadCategory>('endpoints');
  const [selectedSource, setSelectedSource] = useState<UploadSource | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [mappingValid, setMappingValid] = useState(false);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [filterStats, setFilterStats] = useState<{
    total: number;
    included: number;
    excluded: number;
    filterName: string;
  } | null>(null);
  const [excludedItems, setExcludedItems] = useState<Record<string, string>[]>([]);
  const [lastOnlineMaxDays, setLastOnlineMaxDays] = useState<number>(30);
  const [enableLastOnlineFilter, setEnableLastOnlineFilter] = useState<boolean>(true);
  const [importResults, setImportResults] = useState<any>(null);
  const [importTimestamp, setImportTimestamp] = useState<string | null>(null);
  const [conflictResolution, setConflictResolution] = useState<'skip' | 'overwrite'>('overwrite');
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // NEW: resolved data from /import/resolve
  const [resolvedUserMap, setResolvedUserMap] = useState<Record<string, { id: string; displayName: string; officeLocation?: string } | null>>({});
  const [resolvedLocationMap, setResolvedLocationMap] = useState<Record<string, string | null>>({});
  const [conflicts, setConflicts] = useState<Record<string, { id: string; assetTag: string; serialNumber: string }>>({});

  // Hook to call backend resolver
  const resolveImportMutation = useResolveImport();

  // Helper to build resolve payload from current csvData & mappings
  const buildResolvePayload = () => {
    if (!csvData) return { usernames: [], locations: [], serialNumbers: [] };

    const usernameColumn = columnMappings.find(m => m.targetField === 'assignedToAadId')?.ninjaColumn;
    const locationColumn = columnMappings.find(m => m.targetField === 'locationId')?.ninjaColumn;

    const usernames: string[] = [];
    const locations: string[] = [];
    const serialNumbers: string[] = [];

    csvData.rows.forEach(row => {
      if (usernameColumn) {
        const cell = row[usernameColumn] || '';
        const unameRaw = cell.includes('\\') ? cell.split('\\').pop() : cell;
        const uname = unameRaw?.trim();
        if (uname) usernames.push(uname);
      }
      if (locationColumn) {
        const locRaw = row[locationColumn];
        const loc = locRaw?.trim();
        if (loc) locations.push(loc);
      }
      const serial = row['Serial Number'] || row['serialNumber'];
      if (serial) serialNumbers.push(serial);
    });

    return { usernames, locations, serialNumbers };
  };
  
  // Refs for scrolling
  const dropzoneRef = useRef<HTMLDivElement | null>(null);

  // --- MUTATION HOOK ---
  // The import mutation logic now lives in the parent component
  const importMutation = useImportAssets();

  // Fetch asset fields and custom fields for dynamic mapping options
  const { data: assetFields = [] } = useAssetFields();
  const { data: customFields = [] } = useCustomFields();
  
  // Progress tracking hook
  const { progress: realTimeProgress } = useImportProgress(importSessionId);

  // Timer for import progress
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (importStartTime) {
      intervalId = setInterval(() => {
        setElapsedTime(Date.now() - importStartTime);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [importStartTime]);

  const steps = [
    { id: 1, name: 'Select Category', description: 'Choose asset type' },
    { id: 2, name: 'Choose Source', description: 'Select import method' },
    { id: 3, name: 'Preview & Map', description: 'Review data mapping' },
    { id: 4, name: 'Confirm Import', description: 'Validate and import' },
    { id: 5, name: 'Results', description: 'View import results' }
  ];

  const uploadSources = IMPORT_SOURCES;

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedCategory) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedSource || uploadedFiles.length === 0 || !csvData) return;
        setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!mappingValid) return;

      // Trigger backend resolve to fetch usernames, locations & conflicts before moving to confirm step
      const payload = buildResolvePayload();

      // If nothing to resolve, skip API call
      if (payload.usernames.length === 0 && payload.locations.length === 0 && payload.serialNumbers.length === 0) {
        setCurrentStep(4);
            return;
          }
          
      resolveImportMutation.mutate(payload, {
        onSuccess: ({ userMap, locationMap, conflicts }) => {
          setResolvedUserMap(userMap);
          setConflicts(conflicts);

          // Gather unique office locations from resolved Azure AD users
          const azureAdLocations = Object.values(userMap)
            .filter((u): u is { id: string; displayName: string; officeLocation: string } => !!u && !!u.officeLocation)
            .map(u => u.officeLocation!);

          const uniqueAzureLocations = Array.from(new Set(azureAdLocations));

          // If we have additional locations to resolve, make a second call; otherwise, finish
          if (uniqueAzureLocations.length > 0) {
            resolveImportMutation.mutate({ usernames: [], locations: uniqueAzureLocations, serialNumbers: [] }, {
              onSuccess: ({ locationMap: azureLocMap }) => {
                setResolvedLocationMap({ ...locationMap, ...azureLocMap });
                setCurrentStep(4);
              },
              onError: () => {
                // Fallback to original locationMap on error
                setResolvedLocationMap(locationMap);
                setCurrentStep(4);
              }
          });
      } else {
            setResolvedLocationMap(locationMap);
            setCurrentStep(4);
          }
        },
        onError: (err) => {
          console.error('Failed to resolve import payload:', err);
          // Still allow user to continue but with empty maps
          setCurrentStep(4);
        }
      });
    } else if (currentStep === 4) {
      // Import is handled by StepConfirm component
      setCurrentStep(5);
    } else if (currentStep === 5) {
      handleViewAssets();
    }

    // Scroll to top when changing steps
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  const getNextButtonText = () => {
    if (currentStep === 1) return 'Next: Choose Source';
    if (currentStep === 2) {
      if (!selectedSource) return 'Select Import Method';
      if (uploadedFiles.length === 0) return 'Choose File';
      return 'Next: Map Columns';
    }
    if (currentStep === 3) return 'Next: Confirm Import';
    if (currentStep === 4) return 'Import Assets';
    return 'Next';
  };

  const getNextButtonDisabled = () => {
    if (currentStep === 1) return !selectedCategory;
    if (currentStep === 2) return !selectedSource || (uploadedFiles.length > 0 && !csvData);
    if (currentStep === 3) return !mappingValid || resolveImportMutation.isLoading;
    if (currentStep === 4) return importMutation.isLoading;
    return false;
  };

  const selectedSourceConfig = selectedSource 
    ? getImportSource(selectedCategory || 'endpoints', selectedSource)
    : null;

  const handleFileUploaded = (data: { headers: string[]; rows: Record<string, string>[] }) => {
    // Apply filtering based on selected category and source
    const filterKey = getFilterKey(selectedSource || '', selectedCategory);
    const { filteredData, excludedData, filterStats } = applyImportFilter(
      data.rows, 
      filterKey
    );
    
    setCsvData({ headers: data.headers, rows: filteredData });
    setExcludedItems(excludedData);
    setFilterStats(filterStats);
  };

  const removeItem = (index: number) => {
    if (!csvData) return;
    const newRows = csvData.rows.filter((_, i) => i !== index);
    setCsvData({ ...csvData, rows: newRows });
  };

  // Function to apply Last Online filter to current items
  const applyLastOnlineFilter = (items: Record<string, string>[]) => {
    if (!enableLastOnlineFilter || !selectedSource || selectedSource !== 'ninjaone') {
      return items;
    }

    return items.filter(item => {
      const lastOnline = item['Last Online'];
      if (!lastOnline) return true;
      
      try {
        const date = new Date(lastOnline);
        if (isNaN(date.getTime())) return true;
        
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays <= lastOnlineMaxDays;
      } catch (error) {
        return true;
      }
    });
  };

  // Get filtered items for display
  const getFilteredItemsToImport = () => {
    if (!csvData) return [];
    return applyLastOnlineFilter(csvData.rows);
  };

  // Get excluded items due to Last Online filter
  const getLastOnlineExcludedItems = () => {
    if (!enableLastOnlineFilter || !selectedSource || selectedSource !== 'ninjaone' || !csvData) {
      return [];
    }

    return csvData.rows.filter(item => {
      const lastOnline = item['Last Online'];
      if (!lastOnline) return false;
      
      try {
        const date = new Date(lastOnline);
        if (isNaN(date.getTime())) return false;
        
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays > lastOnlineMaxDays;
      } catch (error) {
        return false;
      }
    });
  };

  // Function to handle "View Assets" navigation with cache refresh and filtering
  const handleViewAssets = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      await queryClient.invalidateQueries({ queryKey: ['assets-stats'] });
      
      if (importTimestamp) {
        const importDate = new Date(importTimestamp).toISOString().split('T')[0];
        navigate(`/assets?dateFrom=${importDate}&search=`);
      } else {
        navigate('/assets');
      }
    } catch (error) {
      console.error('Error refreshing assets:', error);
      navigate('/assets');
    }
  };

  // Helper to reset the wizard after a finished import
  const resetWizard = () => {
    setCurrentStep(1);
    setSelectedCategory('endpoints');
    setSelectedSource(null);
    setUploadedFiles([]);
    setCsvData(null);
    setColumnMappings([]);
    setMappingValid(false);
    setImportResults(null);
    setImportSessionId(null);
    setImportStartTime(null);
    setElapsedTime(0);
    setResolvedUserMap({});
    setResolvedLocationMap({});
    setConflicts({});
    importMutation.reset();
  };

  const handleStartImport = (sessionId: string) => {
    setImportTimestamp(new Date().toISOString());
    setImportSessionId(sessionId);
    setImportStartTime(Date.now());
    setCurrentStep(5);
  };

  const handleImportComplete = useCallback((results: any) => {
    setImportResults(results);
    // Clear session ID to stop progress tracking
    setImportSessionId(null);
    setImportStartTime(null);
  }, []);

  const confirmAndStartImport = (importData: any) => {
    importMutation.mutate(importData);
    handleStartImport(importData.sessionId);
  };

  // Watch for mutation to complete
  useEffect(() => {
    if (importMutation.isSuccess && importMutation.data) {
      handleImportComplete(importMutation.data);
    } else if (importMutation.isError) {
      // You can set an error state here to show in the progress screen
      console.error('Import mutation failed:', importMutation.error);
      handleImportComplete(importMutation.error);
    }
  }, [
    importMutation.isSuccess, 
    importMutation.isError, 
    importMutation.data, 
    importMutation.error, 
    handleImportComplete
  ]);

  // Function to format elapsed time
  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Bulk Upload Assets
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Import multiple assets from various sources
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={(step: number) => {
            if (step <= currentStep && !importMutation.isLoading) {
              setCurrentStep(step);
            }
          }}
        />
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Step 1: Asset Category Selection */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <StepSelectCategory
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            </motion.div>
          )}

        {/* Step 2: Source Selection */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <StepSelectSource
              category={selectedCategory}
              selectedSource={selectedSource}
              onSelectSource={setSelectedSource}
              uploadSources={uploadSources}
              selectedSourceConfig={selectedSourceConfig}
              onFileUploaded={handleFileUploaded}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              dropzoneRef={dropzoneRef}
            />
            </motion.div>
          )}

        {/* Step 3: Column Mapping */}
        {currentStep === 3 && csvData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            <StepMapping
                  csvHeaders={csvData.headers}
              sampleRows={csvData.rows.slice(0, 5)}
                  sourceType={selectedSource === 'ninjaone' ? 'ninja' : 'bgc'}
                  assetFields={assetFields}
                  customFields={customFields}
              columnMappings={columnMappings}
                  onMappingChange={setColumnMappings}
              onValidationChange={(valid, errors) => {
                setMappingValid(valid);
                    setMappingErrors(errors);
                  }}
              mappingValid={mappingValid}
              filterStats={filterStats}
              excludedItems={excludedItems}
              resolveError={false}
              enableLastOnlineFilter={enableLastOnlineFilter}
              lastOnlineMaxDays={lastOnlineMaxDays}
              getFilterDescription={(key, days) => getFilterDescription(key, days)}
            />
            </motion.div>
          )}

        {/* Step 4: Confirm Import */}
        {currentStep === 4 && csvData && mappingValid && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            <StepConfirm
              countToImport={getFilteredItemsToImport().length}
              lastOnlineExcluded={getLastOnlineExcludedItems().length}
              conflictCount={Object.keys(conflicts).length}
              conflictResolution={conflictResolution}
              setConflictResolution={setConflictResolution}
              selectedSource={selectedSource}
              enableLastOnlineFilter={enableLastOnlineFilter}
              setEnableLastOnlineFilter={setEnableLastOnlineFilter}
              lastOnlineMaxDays={lastOnlineMaxDays}
              setLastOnlineMaxDays={setLastOnlineMaxDays}
              csvHeaders={csvData.headers}
              previewRows={getFilteredItemsToImport()}
              columnMappings={columnMappings}
                  userMap={resolvedUserMap}
                  locationMap={resolvedLocationMap}
                  conflicts={conflicts}
              excludedItems={excludedItems}
                  onRemoveItem={removeItem}
              onConfirmImport={confirmAndStartImport}
              isImporting={importMutation.isLoading}
            />
            </motion.div>
          )}

        {/* Step 5: Import Progress & Results */}
        {currentStep === 5 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            {/* consider EventSource still running */}
            <StepProgress
              isLoading={importMutation.isLoading || (realTimeProgress ? (realTimeProgress.processed < realTimeProgress.total) : false)}
              progress={realTimeProgress}
              elapsedTime={elapsedTime}
              totalToImport={getFilteredItemsToImport().length}
              formatElapsed={formatElapsedTime}
              importResults={importResults}
              onViewAssets={handleViewAssets}
              onImportMore={resetWizard}
            />
                    </motion.div>
        )}
      </div>
              
      {/* Footer */}
      {currentStep < 5 && (
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 mt-6">
        <div className="flex justify-between">
          <button
            onClick={() => navigate('/assets')}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            disabled={importMutation.isLoading}
          >
            Cancel
          </button>
            {currentStep < 4 && (
          <button
            onClick={handleNext}
            disabled={getNextButtonDisabled()}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[140px]"
          >
            {getNextButtonText()}
          </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkUpload; 