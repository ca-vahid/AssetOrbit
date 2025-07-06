import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as Collapsible from '@radix-ui/react-collapsible';
import { 
  Upload, 
  FileSpreadsheet, 
  Server, 
  AlertCircle,
  ChevronDown, 
  ChevronUp, 
  File, 
  Download, 
  Check,
  Monitor,
  Smartphone,
  FileText,
  Zap,
  Clock,
  Loader2,
  AlertTriangle,
  X
} from 'lucide-react';
import StepIndicator from '../components/StepIndicator';
import UploadOptionCard from '../components/UploadOptionCard';
import ColumnMapper from '../components/ColumnMapper';
import DataPreviewTable from '../components/DataPreviewTable';
import { ColumnMapping } from '../utils/ninjaMapping';
import { 
  IMPORT_SOURCES, 
  getImportSource, 
  getAcceptedFileTypes as getSourceFileTypes,
  getMappingsForSource,
  sourceSupports,
  type UploadCategory,
  type UploadSource,
  type ImportSourceConfig
} from '../utils/importSources';
import { applyImportFilter, getFilterKey, getFilterDescription } from '../utils/importFilters';
import { useAssetFields } from '../hooks/useAssetFields';
import { useCustomFields } from '../hooks/useCustomFields';
import { useResolveImport } from '../hooks/useResolveImport';
import { useImportAssets, useImportProgress, generateSessionId, type ImportProgress } from '../hooks/useImportAssets';
import { useQueryClient } from '@tanstack/react-query';

// Types now imported from importSources.ts

const BulkUpload: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<UploadCategory>('endpoints');
  const [selectedSource, setSelectedSource] = useState<UploadSource | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [categoryExpanded, setCategoryExpanded] = useState(true);
  const [sourceExpanded, setSourceExpanded] = useState(true);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [mappingValid, setMappingValid] = useState(false);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [resolvedUserMap, setResolvedUserMap] = useState<Record<string, { id: string; displayName: string; officeLocation?: string } | null>>({});
  const [resolvedLocationMap, setResolvedLocationMap] = useState<Record<string, string | null>>({});
  const [conflicts, setConflicts] = useState<Record<string, { id: string; assetTag: string; serialNumber: string }>>({});
  const [itemsToImport, setItemsToImport] = useState<Record<string, string>[]>([]);
  const [conflictResolution, setConflictResolution] = useState<'skip' | 'overwrite'>('overwrite');
  const [filterStats, setFilterStats] = useState<{
    total: number;
    included: number;
    excluded: number;
    filterName: string;
  } | null>(null);
  const [excludedItems, setExcludedItems] = useState<Record<string, string>[]>([]);
  const [lastOnlineMaxDays, setLastOnlineMaxDays] = useState<number>(30);
  const [enableLastOnlineFilter, setEnableLastOnlineFilter] = useState<boolean>(true);
  const [importResults, setImportResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: Array<{ index: number; error: string; data?: any }>;
    skippedItems: Array<{ index: number; reason: string; data?: any }>;
    created: Array<{ id: string; assetTag: string }>;
    statistics: {
      categorizedAssets: Array<{ assetTag: string; categoryName: string; ruleName: string }>;
      uniqueUsers: string[];
      uniqueLocations: string[];
      assetTypeBreakdown: Record<string, number>;
      statusBreakdown: Record<string, number>;
    };
  } | null>(null);
  const [importTimestamp, setImportTimestamp] = useState<string | null>(null);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const [realTimeProgress, setRealTimeProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<{
    title: string;
    message: string;
    details?: string;
    suggestions: string[];
  } | null>(null);

  // Fetch asset fields and custom fields for dynamic mapping options
  const { data: assetFields = [] } = useAssetFields();
  const { data: customFields = [] } = useCustomFields();

  const resolveMutation = useResolveImport();
  const importMutation = useImportAssets();
  
  // Progress tracking hook
  const { progress: liveProgress } = useImportProgress(importSessionId, (progress) => {
    setRealTimeProgress(progress);
  });

  // Refs for scrolling
  const categorySectionRef = useRef<HTMLDivElement | null>(null);
  const sourceSectionRef = useRef<HTMLDivElement | null>(null);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const columnMappingRef = useRef<HTMLDivElement | null>(null);
  const confirmationRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Scroll to the active section whenever the current step changes
  useEffect(() => {
    const scrollOptions: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' };

    if (currentStep === 1 && categorySectionRef.current) {
      categorySectionRef.current.scrollIntoView(scrollOptions);
    } else if (currentStep === 2 && sourceSectionRef.current) {
      sourceSectionRef.current.scrollIntoView(scrollOptions);
    } else if (currentStep === 3 && columnMappingRef.current) {
      columnMappingRef.current.scrollIntoView(scrollOptions);
    } else if (currentStep === 4 && confirmationRef.current) {
      confirmationRef.current.scrollIntoView(scrollOptions);
    } else if (currentStep === 5 && resultsRef.current) {
      resultsRef.current.scrollIntoView(scrollOptions);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!mappingValid || !csvData || resolveMutation.isLoading || Object.keys(resolvedUserMap).length) return;

    // Determine which CSV columns map to username, location, and serial number
    const usernameColumn = columnMappings.find(m => m.targetField === 'assignedToAadId')?.ninjaColumn;
    const locationColumn = columnMappings.find(m => m.targetField === 'locationId')?.ninjaColumn;
    const serialNumberColumn = columnMappings.find(m => m.targetField === 'serialNumber')?.ninjaColumn;

    if (!usernameColumn && !locationColumn && !serialNumberColumn) return;

    const usernames: string[] = [];
    const locations: string[] = [];
    const serialNumbers: string[] = [];

    csvData.rows.forEach(row => {
      if (usernameColumn) {
        const cell = row[usernameColumn] || '';
        const uname = cell.includes('\\') ? cell.split('\\').pop() : cell;
        if (uname) usernames.push(uname);
      }
      if (locationColumn) {
        const loc = row[locationColumn];
        if (loc) locations.push(loc);
      }
      if (serialNumberColumn) {
        const sn = row[serialNumberColumn];
        if (sn && sn.trim()) serialNumbers.push(sn.trim());
      }
    });

    if (usernames.length || locations.length || serialNumbers.length) {
      resolveMutation.mutate(
        { usernames, locations, serialNumbers },
        { onSuccess: ({ userMap, locationMap, conflicts }) => {
            setResolvedUserMap(userMap);
            
            // DEBUG: Log resolved user map to see office locations
            console.log('📍 Resolved user map:', userMap);
            Object.entries(userMap).forEach(([username, user]) => {
              if (user) {
                console.log(`📍 User ${username}: officeLocation = "${user.officeLocation}"`);
              }
            });
            
            // Collect Azure AD office locations from resolved users
            const azureAdLocations = Object.values(userMap)
              .filter(user => user && user.officeLocation)
              .map(user => user!.officeLocation!);
            
            console.log('📍 Azure AD locations extracted:', azureAdLocations);
            
            // If we have Azure AD locations, resolve them too
            if (azureAdLocations.length > 0) {
              resolveMutation.mutate(
                { usernames: [], locations: azureAdLocations, serialNumbers: [] },
                { onSuccess: ({ locationMap: azureLocationMap }) => {
                    console.log('📍 Azure location map:', azureLocationMap);
                    setResolvedLocationMap({ ...locationMap, ...azureLocationMap });
                  } }
              );
            } else {
              setResolvedLocationMap(locationMap);
            }
            
            setConflicts(conflicts);
          } }
      );
    }
  }, [mappingValid, csvData, columnMappings]);

  // Initialize items to import when we reach step 4
  useEffect(() => {
    if (currentStep === 4 && csvData && !itemsToImport.length) {
      setItemsToImport(csvData.rows);
    }
  }, [currentStep, csvData, itemsToImport.length]);

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

  // Use the extensible import source system
  const uploadSources = IMPORT_SOURCES;

  const onDrop = (acceptedFiles: File[]) => {
    setUploadedFiles(acceptedFiles);
    
    // Parse CSV file if uploaded
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              const headers = Object.keys(results.data[0] as Record<string, string>);
              const allRows = results.data as Record<string, string>[];
              
              // Apply filtering based on selected category and source (but not Last Online filter yet)
              const filterKey = getFilterKey(selectedSource || '', selectedCategory);
              const { filteredData, excludedData, filterStats } = applyImportFilter(
                allRows, 
                filterKey
                // Note: Last Online filter is applied later in the conflict resolution step
              );
              
              setCsvData({ headers, rows: filteredData });
              setExcludedItems(excludedData);
              setFilterStats(filterStats);
              
              // Auto-progress to column mapping step
              setTimeout(() => {
                setCurrentStep(3);
              }, 500); // Small delay to show the file upload success state
            }
          },
          error: (error) => {
            console.error('CSV parsing error:', error);
            alert('Error parsing CSV file. Please check the file format.');
          }
        });
      }
    }
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop,
    accept: selectedSource ? getAcceptedFileTypes(selectedSource) : {},
    multiple: false,
    disabled: !selectedSource
  });

  function getAcceptedFileTypes(source: UploadSource) {
    const sourceConfig = getImportSource(selectedCategory || 'endpoints', source);
    if (!sourceConfig) return {};
    return getSourceFileTypes(sourceConfig);
  }

  const handleNext = () => {
    if (currentStep === 1 && selectedCategory) {
      setCurrentStep(2);
      setSourceExpanded(true);
    } else if (currentStep === 2 && selectedSource) {
      if (uploadedFiles.length === 0) {
        // Smooth-scroll to the drop-zone so the user can add a file
        dropzoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (csvData) {
        setCurrentStep(3);
      } else {
        alert('Please wait for the file to be processed or upload a CSV file.');
      }
    } else if (currentStep === 3 && mappingValid) {
      setCurrentStep(4);
      // Auto-scroll will be handled by useEffect
    } else if (currentStep === 4) {
      // Perform actual import
      const filteredAssets = getFilteredItemsToImport();

      // Transform rows to include resolved user/location IDs and apply NinjaOne field transformations
      const transformedAssets = filteredAssets.map((row) => {
        const newRow: Record<string, string> = { ...row };

        columnMappings.forEach((m) => {
          const rawValue = row[m.ninjaColumn] || '';
          
          // Apply NinjaOne field transformations using the processor if available
          if (m.processor && rawValue) {
            try {
              const transformedValue = m.processor(rawValue);
              if (transformedValue !== null && transformedValue !== undefined) {
                newRow[m.ninjaColumn] = String(transformedValue);
              }
            } catch (error) {
              console.warn(`Failed to transform value for ${m.ninjaColumn}:`, error);
            }
          }

          // Handle user resolution (use the potentially transformed value)
          if (m.targetField === 'assignedToAadId') {
            const currentValue = newRow[m.ninjaColumn] || rawValue;
            
            // Extract the username from domain\username format for Azure AD lookup
            const uname = currentValue.includes('\\') ? currentValue.split('\\').pop() : currentValue;
            
            // Check if we have Azure AD resolution for this user
            const resolved = resolvedUserMap[uname || ''];
            if (resolved && resolved.id) {
              // User was resolved in preview - send the GUID
              newRow[m.ninjaColumn] = resolved.id;
              console.log(`✅ Using resolved GUID for "${currentValue}": ${resolved.id}`);
              
              // Handle Azure AD location assignment
              if (resolved.officeLocation) {
                const locationId = resolvedLocationMap[resolved.officeLocation];
                if (locationId) {
                  newRow['_azureAdLocation'] = locationId;
                  console.log(`📍 Set Azure AD location for ${uname}: ${resolved.officeLocation} → ${locationId}`);
                } else {
                  console.warn(`📍 Location "${resolved.officeLocation}" not found in resolvedLocationMap:`, Object.keys(resolvedLocationMap));
                }
              }
            } else {
              // User was NOT resolved - preserve the FULL original username (including domain)
              newRow[m.ninjaColumn] = currentValue;
              console.log(`👤 Preserving full username (no Azure AD resolution): "${currentValue}"`);
            }
          }
          
          // Handle location resolution (use the potentially transformed value)
          if (m.targetField === 'locationId') {
            const currentValue = newRow[m.ninjaColumn] || rawValue;
            const resolvedLocId = resolvedLocationMap[currentValue];
            if (resolvedLocId) {
              newRow[m.ninjaColumn] = resolvedLocId; // replace with DB location id
            }
          }
        });

        return newRow;
      });

      // Add location mapping if we have Azure AD location data
      const enhancedMappings = [...columnMappings];
      if (transformedAssets.some(row => row['_azureAdLocation'])) {
        enhancedMappings.push({
          ninjaColumn: '_azureAdLocation',
          targetField: 'locationId',
          targetType: 'direct' as const,
          description: 'Location from Azure AD user profile',
          required: false
        });
        console.log(`📍 Added Azure AD location mapping to enhanced mappings`);
      } else {
        console.log(`📍 No Azure AD location data found in transformed assets`);
        
        // Debug: Show which assets have _azureAdLocation
        const assetsWithAzureLocation = transformedAssets.filter(row => row['_azureAdLocation']);
        console.log(`📍 Assets with _azureAdLocation:`, assetsWithAzureLocation.length);
        
        // Debug: Show all keys in first few assets
        if (transformedAssets.length > 0) {
          console.log(`📍 Sample asset keys:`, Object.keys(transformedAssets[0]));
        }
      }

      // Map selected source to backend source enum
      const sourceMapping: Record<string, string> = {
        'ninjaone': 'NINJAONE',
        'bgc-template': 'EXCEL',
        'invoice': 'EXCEL',
        'intune': 'INTUNE',
        'custom-excel': 'EXCEL'
      };

      // Generate session ID and set import start time
      const sessionId = generateSessionId();
      setImportSessionId(sessionId);
      setImportStartTime(Date.now());
      setRealTimeProgress(null);
      
      // Scroll to progress section after a short delay
      setTimeout(() => {
        if (progressRef.current) {
          progressRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      
      importMutation.mutate({
        assets: transformedAssets,
        columnMappings: enhancedMappings,
        conflictResolution: conflictResolution,
        source: sourceMapping[selectedSource || ''] || 'BULK_UPLOAD',
        sessionId: sessionId
      }, {
        onSuccess: (results) => {
          console.log('Import results received:', results);
          console.log('Statistics:', results.statistics);
          setImportResults(results);
          setCurrentStep(5);
          setImportStartTime(null);
          setImportSessionId(null);
          setRealTimeProgress(null);
          // Store import timestamp for filtering
          setImportTimestamp(new Date().toISOString());
          // Small delay to ensure the results section is rendered before scrolling
          setTimeout(() => {
            if (resultsRef.current) {
              resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        },
        onError: (error) => {
          setImportStartTime(null);
          setImportSessionId(null);
          setRealTimeProgress(null);
          const errorInfo = parseImportError(error);
          setImportError(errorInfo);
        }
      });
    }
  };

  const getNextButtonText = () => {
    if (currentStep === 1) return 'Next: Choose Source';
    if (currentStep === 2) {
      if (!selectedSource) return 'Select Import Method';
      if (uploadedFiles.length === 0) return 'Choose File';
      return 'Next: Map Columns';
    }
    if (currentStep === 3) return 'Next: Confirm Import';
    if (currentStep === 4) {
      if (importMutation.isLoading) {
        return 'Importing...';
      }
      const count = getFilteredItemsToImport().length;
      return `Import ${count} Asset${count !== 1 ? 's' : ''}`;
    }
    return 'Next';
  };

  const getNextButtonDisabled = () => {
    if (currentStep === 1) return !selectedCategory;
    if (currentStep === 2) return !selectedSource || (uploadedFiles.length > 0 && !csvData);
    if (currentStep === 3) return !mappingValid;
    if (currentStep === 4) return importMutation.isLoading;
    return false;
  };

  const selectedSourceConfig = selectedSource 
    ? getImportSource(selectedCategory || 'endpoints', selectedSource)
    : null;

  const removeItem = (index: number) => {
    setItemsToImport(prev => prev.filter((_, i) => i !== index));
  };

  // Function to apply Last Online filter to current items
  const applyLastOnlineFilter = (items: Record<string, string>[]) => {
    if (!enableLastOnlineFilter || !selectedSource || selectedSource !== 'ninjaone') {
      return items;
    }

    return items.filter(item => {
      const lastOnline = item['Last Online'];
      if (!lastOnline) return true; // Include items without Last Online data
      
      try {
        const date = new Date(lastOnline);
        if (isNaN(date.getTime())) return true; // Include items with invalid dates
        
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays <= lastOnlineMaxDays;
      } catch (error) {
        return true; // Include items that can't be processed
      }
    });
  };

  // Get filtered items for display (applies Last Online filter to current itemsToImport)
  const getFilteredItemsToImport = () => {
    return applyLastOnlineFilter(itemsToImport);
  };

  // Get excluded items due to Last Online filter
  const getLastOnlineExcludedItems = () => {
    if (!enableLastOnlineFilter || !selectedSource || selectedSource !== 'ninjaone') {
      return [];
    }

    return itemsToImport.filter(item => {
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

  // Function to parse and categorize import errors
  const parseImportError = (error: any) => {
    console.error('Import error details:', error);
    
    // Check for network/request errors
    if (error?.response?.status === 413 || error?.message?.includes('entity too large')) {
      return {
        title: 'File Too Large',
        message: 'The import file or data is too large to process.',
        details: 'The server rejected the request because the payload exceeds the maximum size limit.',
        suggestions: [
          'Try importing fewer assets at once (split into smaller batches)',
          'Remove unnecessary columns from your CSV file',
          'Check if your file contains very large text fields or special characters',
          'Consider using a smaller file format or compressing the data'
        ]
      };
    }
    
    if (error?.response?.status === 400) {
      const errorMessage = error?.response?.data?.error || error?.message || '';
      
      if (errorMessage.includes('validation') || errorMessage.includes('required field')) {
        return {
          title: 'Data Validation Error',
          message: 'Some required fields are missing or contain invalid data.',
          details: errorMessage,
          suggestions: [
            'Check that all required fields are mapped correctly',
            'Ensure asset tags and serial numbers are unique',
            'Verify that dates are in the correct format',
            'Make sure asset types and statuses use valid values'
          ]
        };
      }
      
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        return {
          title: 'Duplicate Data Detected',
          message: 'Some assets already exist in the system.',
          details: errorMessage,
          suggestions: [
            'Choose "Skip existing assets" in conflict resolution',
            'Or choose "Overwrite existing assets" to update them',
            'Check for duplicate asset tags or serial numbers in your file',
            'Remove duplicate entries from your import file'
          ]
        };
      }
    }
    
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return {
        title: 'Access Denied',
        message: 'You do not have permission to import assets.',
        details: 'Your account may not have the required write permissions.',
        suggestions: [
          'Contact your system administrator to request import permissions',
          'Make sure you are logged in with the correct account',
          'Try refreshing the page and logging in again'
        ]
      };
    }
    
    if (error?.response?.status === 500) {
      return {
        title: 'Server Error',
        message: 'The server encountered an internal error while processing the import.',
        details: error?.response?.data?.error || 'An unexpected server error occurred.',
        suggestions: [
          'Try the import again in a few minutes',
          'Check if the file format is supported',
          'Ensure your data doesn\'t contain special characters that might cause issues',
          'If the problem persists, contact technical support'
        ]
      };
    }
    
    if (error?.message?.includes('timeout')) {
      return {
        title: 'Import Timeout',
        message: 'The import operation took too long to complete.',
        details: 'Large imports can take several minutes. The operation may have timed out.',
        suggestions: [
          'Try importing fewer assets at once (split into smaller batches of 50-100 assets)',
          'Remove unnecessary columns from your CSV file to reduce processing time',
          'Check if your file contains very large text fields that might slow processing',
          'Wait a few minutes and try again with a smaller batch size'
        ]
      };
    }

    if (error?.code === 'NETWORK_ERROR' || !error?.response) {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to the server.',
        details: 'This might be a temporary network issue or the server might be unavailable.',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Wait a few minutes and try again',
          'Contact your IT department if the problem persists'
        ]
      };
    }
    
    // Generic error fallback
    return {
      title: 'Import Failed',
      message: 'An unexpected error occurred during the import process.',
      details: error?.response?.data?.error || error?.message || 'Unknown error',
      suggestions: [
        'Try the import again',
        'Check your file format and data',
        'Ensure all required fields are present',
        'Contact support if the issue continues'
      ]
    };
  };

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

  // Function to handle "View Assets" navigation with cache refresh and filtering
  const handleViewAssets = async () => {
    try {
      // Invalidate assets cache to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      
      // Navigate to assets page with date filter to show recently imported assets
      if (importTimestamp) {
        const importDate = new Date(importTimestamp).toISOString().split('T')[0]; // Get YYYY-MM-DD format
        navigate(`/assets?dateFrom=${importDate}&search=`);
      } else {
        navigate('/assets');
      }
    } catch (error) {
      console.error('Error refreshing assets:', error);
      // Navigate anyway even if cache invalidation fails
      navigate('/assets');
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
            if (step <= currentStep) {
              setCurrentStep(step);
            }
          }}
        />
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Step 1: Asset Category Selection */}
        <div ref={categorySectionRef} className="scroll-mt-24">
        <Collapsible.Root open={categoryExpanded} onOpenChange={setCategoryExpanded}>
          <Collapsible.Trigger className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currentStep >= 1 ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'}`}>
                <Monitor className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  What are you uploading?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose the type of assets you want to import
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedCategory && (
                <div className="flex items-center gap-1 px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-xs font-medium">
                  <Check className="w-3 h-3" />
                  {selectedCategory === 'endpoints' ? 'Endpoint Devices' : 'Servers'}
                </div>
              )}
              {categoryExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </Collapsible.Trigger>
          
          <Collapsible.Content className="overflow-hidden">
            <div className="pt-4">
              {/* Compact Category Selection */}
              <div className="flex gap-4 max-w-2xl">
                {/* Endpoint Devices Option */}
                <button
                  onClick={() => setSelectedCategory('endpoints')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedCategory === 'endpoints'
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex-shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                          Endpoint Devices
                        </h4>
                        {selectedCategory === 'endpoints' && (
                          <div className="p-1 bg-brand-500 text-white rounded-full">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Laptops, desktops, tablets, phones
                      </p>
                    </div>
                  </div>
                </button>

                {/* Servers Option */}
                <button
                  onClick={() => setSelectedCategory('servers')}
                  disabled
                  className="flex-1 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-left relative opacity-60 cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg flex items-center justify-center">
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                      <AlertCircle className="w-3 h-3" />
                      Coming Soon
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex-shrink-0">
                      <Server className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                        Servers
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Physical servers, VMs, infrastructure
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
        </div>

        {/* Step 2: Source Selection */}
        {selectedCategory === 'endpoints' && currentStep >= 2 && (
          <div ref={sourceSectionRef} className="scroll-mt-24">
          <Collapsible.Root open={sourceExpanded} onOpenChange={setSourceExpanded}>
            <Collapsible.Trigger className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${currentStep >= 2 ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'}`}>
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Source file / document
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Choose how you want to import your endpoint devices
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedSource && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-xs font-medium">
                    <Check className="w-3 h-3" />
                    {selectedSourceConfig?.title}
                  </div>
                )}
                {sourceExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </Collapsible.Trigger>
            
            <Collapsible.Content className="overflow-hidden">
              <div className="pt-4 space-y-4">
                {/* Upload Source Cards - Compact Layout */}
                <div className="max-w-4xl">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {uploadSources.endpoints.map((source) => (
                      <UploadOptionCard
                        key={source.id}
                        source={source}
                        isSelected={selectedSource === source.id}
                        onSelect={() => setSelectedSource(source.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* File Upload Zone - Compact */}
                {selectedSource && selectedSourceConfig && (
                  <div ref={dropzoneRef} className="mt-6 max-w-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        Upload {selectedSourceConfig.title}
                      </h4>
                      {selectedSourceConfig.sampleFile && (
                        <a
                          href={selectedSourceConfig.sampleFile}
                          download
                          className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          Download Sample
                        </a>
                      )}
                    </div>
                    
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
                        isDragActive
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : uploadedFiles.length > 0
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="space-y-2">
                        {uploadedFiles.length > 0 ? (
                          <>
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg inline-block">
                              <Check className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-300">
                              {uploadedFiles[0].name}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              File uploaded successfully
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="p-2 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded-lg inline-block">
                              <File className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {isDragActive ? 'Drop your file here' : 'Drag & drop your file here, or click to browse'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Supports: {selectedSourceConfig.acceptedFormats.join(', ')}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
          </div>
        )}

        

        {/* Step 3: Column Mapping */}
        {currentStep >= 3 && csvData && (
          <div ref={columnMappingRef} className="scroll-mt-24">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      Column Mapping & Preview
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Review and adjust how your CSV columns map to asset fields. Auto-mapping has been applied based on NinjaOne format.
                    </p>
                    {/* Filter Status */}
                    {filterStats && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                            <Check className="w-3 h-3" />
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-blue-900 dark:text-blue-100">
                              {filterStats.filterName} Applied:
                            </span>
                            <span className="text-blue-700 dark:text-blue-300 ml-1">
                              {filterStats.included} of {filterStats.total} items included
                              {filterStats.excluded > 0 && (
                                <span className="text-blue-600 dark:text-blue-400">
                                  , {filterStats.excluded} excluded
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                                                 {filterStats.excluded > 0 && (
                           <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                             {getFilterDescription(
                               getFilterKey(selectedSource || '', selectedCategory),
                               enableLastOnlineFilter ? lastOnlineMaxDays : undefined
                             )}
                           </p>
                         )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <ColumnMapper
                  csvHeaders={csvData.headers}
                  sampleData={csvData.rows.slice(0, 5)} // Show first 5 rows as samples
                  sourceType={selectedSource === 'ninjaone' ? 'ninja' : 'bgc'}
                  assetFields={assetFields}
                  customFields={customFields}
                  onMappingChange={setColumnMappings}
                  onValidationChange={(isValid, errors) => {
                    setMappingValid(isValid);
                    setMappingErrors(errors);
                  }}
                />
                
                {/* Excluded Items Section */}
                {excludedItems.length > 0 && (
                  <Collapsible.Root>
                    <Collapsible.Trigger className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                      <ChevronDown className="w-4 h-4" />
                      <span>View {excludedItems.length} excluded items</span>
                    </Collapsible.Trigger>
                    <Collapsible.Content className="mt-3">
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                          Excluded Items (Not Imported)
                        </h4>
                                                 <div className="space-y-2 max-h-64 overflow-y-auto">
                           {excludedItems.map((item, index) => {
                             const daysSinceOnline = item['Last Online'] ? 
                               Math.ceil((new Date().getTime() - new Date(item['Last Online']).getTime()) / (1000 * 60 * 60 * 24)) : 
                               null;
                             
                             return (
                               <div key={index} className="flex items-center gap-3 text-xs">
                                 <div className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0"></div>
                                 <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-2">
                                     <span className="text-slate-700 dark:text-slate-300 font-medium">
                                       {item['Display Name'] || item['Asset Tag'] || `Item ${index + 1}`}
                                     </span>
                                     <span className="text-slate-500 dark:text-slate-400">
                                       ({item['Role'] || item['Type'] || 'Unknown type'})
                                     </span>
                                   </div>
                                   {daysSinceOnline !== null && (
                                     <div className="text-slate-500 dark:text-slate-400 mt-1">
                                       Last online: {daysSinceOnline} days ago
                                       {daysSinceOnline > lastOnlineMaxDays && enableLastOnlineFilter && (
                                         <span className="text-amber-600 dark:text-amber-400 ml-1">
                                           (exceeded {lastOnlineMaxDays} day limit)
                                         </span>
                                       )}
                                     </div>
                                   )}
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                      </div>
                    </Collapsible.Content>
                  </Collapsible.Root>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Data Preview & Confirmation */}
        {currentStep >= 4 && csvData && mappingValid && (
          <div ref={confirmationRef} className="scroll-mt-24">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Confirm Import
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Review the processed data before importing to AssetOrbit
                      </p>
                    </div>
                  </div>
                  
                  {/* Import Summary */}
                  <div className="text-right">
                    <div className="text-xl font-bold text-brand-600 dark:text-brand-400">
                      {getFilteredItemsToImport().length}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      assets to import
                    </div>
                    {enableLastOnlineFilter && getLastOnlineExcludedItems().length > 0 && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        {getLastOnlineExcludedItems().length} excluded by filter
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Conflict Resolution Options */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Serial Number Conflicts */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Serial Number Conflicts
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      How should we handle assets with matching serial numbers?
                      {Object.keys(conflicts).length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded text-xs font-medium">
                          {Object.keys(conflicts).length} conflict{Object.keys(conflicts).length !== 1 ? 's' : ''} found
                        </span>
                      )}
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="conflictResolution"
                          value="overwrite"
                          checked={conflictResolution === 'overwrite'}
                          onChange={(e) => setConflictResolution(e.target.value as 'skip' | 'overwrite')}
                          className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Overwrite existing assets
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="conflictResolution"
                          value="skip"
                          checked={conflictResolution === 'skip'}
                          onChange={(e) => setConflictResolution(e.target.value as 'skip' | 'overwrite')}
                          className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Skip existing assets
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Last Online Filter */}
                  {selectedSource === 'ninjaone' && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Last Online Filter
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        Exclude devices that haven't been online recently
                        {enableLastOnlineFilter && getLastOnlineExcludedItems().length > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded text-xs font-medium">
                            {getLastOnlineExcludedItems().length} device{getLastOnlineExcludedItems().length !== 1 ? 's' : ''} excluded
                          </span>
                        )}
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableLastOnlineFilter}
                            onChange={(e) => setEnableLastOnlineFilter(e.target.checked)}
                            className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
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
                            className="w-16 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-brand-500 focus:border-brand-500 dark:bg-slate-700 dark:text-slate-100"
                            disabled={!enableLastOnlineFilter}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">days</span>
                        </label>
                        
                        {enableLastOnlineFilter && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Devices last seen more than {lastOnlineMaxDays} days ago will be excluded from import
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4">
                <DataPreviewTable
                  csvData={{ headers: csvData.headers, rows: getFilteredItemsToImport() }}
                  mappings={columnMappings}
                  sourceType={selectedSource === 'ninjaone' ? 'ninja' : 'bgc'}
                  userMap={resolvedUserMap}
                  locationMap={resolvedLocationMap}
                  conflicts={conflicts}
                  onRemoveItem={removeItem}
                  showRemoveOption={true}
                />
                
                {/* Show excluded items due to Last Online filter */}
                {selectedSource === 'ninjaone' && enableLastOnlineFilter && getLastOnlineExcludedItems().length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-medium text-amber-900 dark:text-amber-100 text-sm">
                        Devices Excluded by Last Online Filter
                      </h4>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                      {getLastOnlineExcludedItems().length} device{getLastOnlineExcludedItems().length !== 1 ? 's' : ''} excluded for being offline more than {lastOnlineMaxDays} days
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {getLastOnlineExcludedItems().map((item, index) => {
                        const daysSinceOnline = item['Last Online'] ? 
                          Math.ceil((new Date().getTime() - new Date(item['Last Online']).getTime()) / (1000 * 60 * 60 * 24)) : 
                          null;
                        
                        return (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <span className="text-amber-800 dark:text-amber-200">
                              {item['Display Name'] || item['Asset Tag'] || `Device ${index + 1}`}
                            </span>
                            {daysSinceOnline && (
                              <span className="text-amber-600 dark:text-amber-400">
                                {daysSinceOnline} days offline
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Import Results */}
        {currentStep >= 5 && importResults && (
          <div ref={resultsRef} className="scroll-mt-24">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="p-6 text-center">
                <div className={`p-3 rounded-full inline-block mb-4 ${
                  importResults.failed > 0 
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                }`}>
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Import {importResults.failed > 0 ? 'Completed with Issues' : 'Complete!'}
                </h3>
                
                {/* Import Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {importResults.successful}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">Successful</div>
                  </div>
                  
                  <Collapsible.Root>
                    <Collapsible.Trigger asChild>
                      <button className={`bg-red-50 dark:bg-red-900/20 p-4 rounded-lg w-full text-left transition-all ${
                        importResults.failed > 0 ? 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30' : 'cursor-default'
                      }`} disabled={importResults.failed === 0}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                              {importResults.failed}
                            </div>
                            <div className="text-sm text-red-700 dark:text-red-300 flex items-center gap-1">
                              Failed
                              {importResults.failed > 0 && (
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </Collapsible.Trigger>
                    
                    {importResults.failed > 0 && (
                      <Collapsible.Content className="mt-2">
                        <div className="bg-red-50/60 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-red-900 dark:text-red-100 text-sm">
                              Failed Items ({importResults.errors.length})
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
                              className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                              title="Copy all errors to clipboard"
                            >
                              Copy All
                            </button>
                          </div>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {importResults.errors.map((error, index) => {
                              // Parse error to make it more readable
                              const isConstraintError = error.error.includes('Unique constraint failed');
                              const isMissingFieldError = error.error.includes('Argument') && error.error.includes('missing');
                              
                              let friendlyError = error.error;
                              if (isConstraintError) {
                                friendlyError = 'Duplicate asset detected - asset with this information already exists';
                              } else if (isMissingFieldError) {
                                const match = error.error.match(/Argument `(\w+)` is missing/);
                                if (match) {
                                  friendlyError = `Missing required field: ${match[1]}`;
                                }
                              }
                              
                              return (
                                <div key={index} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-red-200 dark:border-red-700">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-red-800 dark:text-red-200">
                                          Row {error.index + 1}
                                        </span>
                                        {error.data?.['Display Name'] && (
                                          <span className="text-xs text-slate-600 dark:text-slate-400">
                                            ({error.data['Display Name']})
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                                        {friendlyError}
                                      </p>
                                      {error.error !== friendlyError && (
                                        <details className="text-xs">
                                          <summary className="text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
                                            Technical details
                                          </summary>
                                          <pre className="mt-1 p-2 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                                            {error.error}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const assetName = error.data?.['Display Name'] ? ` (${error.data['Display Name']})` : '';
                                        const errorText = `Row ${error.index + 1}${assetName}: ${error.error}`;
                                        navigator.clipboard.writeText(errorText);
                                      }}
                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                      title="Copy this error"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </Collapsible.Content>
                    )}
                  </Collapsible.Root>
                  
                  <Collapsible.Root>
                    <Collapsible.Trigger asChild>
                      <button className={`bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg w-full text-left transition-all ${
                        importResults.skipped > 0 ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30' : 'cursor-default'
                      }`} disabled={importResults.skipped === 0}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                              {importResults.skipped}
                            </div>
                            <div className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1">
                              Skipped
                              {importResults.skipped > 0 && (
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </Collapsible.Trigger>
                    
                                         {importResults.skipped > 0 && (
                       <Collapsible.Content className="mt-2">
                         <div className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                           <div className="flex items-center justify-between mb-2">
                             <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm">
                               Skipped Items ({importResults.skippedItems?.length || 0})
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
                                 navigator.clipboard.writeText(skippedText || 'No skipped items details available');
                               }}
                               className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                               title="Copy all skipped items to clipboard"
                             >
                               Copy All
                             </button>
                           </div>
                           <div className="space-y-3 max-h-64 overflow-y-auto">
                             {importResults.skippedItems && importResults.skippedItems.length > 0 ? (
                               importResults.skippedItems.map((item, index) => (
                                 <div key={index} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                                   <div className="flex items-start justify-between gap-3">
                                     <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-2 mb-1">
                                         <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                           Row {item.index + 1}
                                         </span>
                                         {item.data?.['Display Name'] && (
                                           <span className="text-xs text-slate-600 dark:text-slate-400">
                                             ({item.data['Display Name']})
                                           </span>
                                         )}
                                       </div>
                                       <p className="text-sm text-amber-700 dark:text-amber-300">
                                         {item.reason}
                                       </p>
                                     </div>
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         const assetName = item.data?.['Display Name'] ? ` (${item.data['Display Name']})` : '';
                                         const skippedText = `Row ${item.index + 1}${assetName}: ${item.reason}`;
                                         navigator.clipboard.writeText(skippedText);
                                       }}
                                       className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                       title="Copy this skipped item"
                                     >
                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                       </svg>
                                     </button>
                                   </div>
                                 </div>
                               ))
                             ) : (
                               <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                                 <p className="text-sm text-amber-700 dark:text-amber-300">
                                   No detailed information available for skipped items.
                                 </p>
                               </div>
                             )}
                           </div>
                         </div>
                       </Collapsible.Content>
                     )}
                  </Collapsible.Root>
                  
                  <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                      {importResults.total}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">Total</div>
                  </div>
                </div>

                {/* Enhanced Statistics Section */}
                {importResults.statistics && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Import Details
                    </h4>
                    
                    {/* Compact Statistics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Auto-Categorized Assets */}
                      {importResults.statistics.categorizedAssets.length > 0 ? (
                        <Collapsible.Root>
                          <Collapsible.Trigger asChild>
                            <button className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg w-full text-left transition-all cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                                    {importResults.statistics.categorizedAssets.length}
                                  </div>
                                  <div className="text-xs text-purple-700 dark:text-purple-300">
                                    Auto-Categorized
                                  </div>
                                </div>
                                <ChevronDown className="w-3 h-3 text-purple-500 dark:text-purple-400 opacity-60" />
                              </div>
                            </button>
                          </Collapsible.Trigger>
                          
                          <Collapsible.Content className="mt-2">
                            <div className="bg-purple-50/60 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-xs font-medium text-purple-900 dark:text-purple-100">
                                  Workload Categories Applied
                                </h5>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const categorizedText = importResults.statistics.categorizedAssets
                                      .map(item => `${item.assetTag}: ${item.categoryName} (${item.ruleName})`)
                                      .join('\n');
                                    navigator.clipboard.writeText(categorizedText);
                                  }}
                                  className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                  title="Copy all categorized assets"
                                >
                                  Copy
                                </button>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {importResults.statistics.categorizedAssets.slice(0, 5).map((item, index) => (
                                  <div key={index} className="text-xs">
                                    <div className="font-medium text-purple-800 dark:text-purple-200">
                                      {item.assetTag} → {item.categoryName}
                                    </div>
                                    <div className="text-purple-600 dark:text-purple-400">
                                      {item.ruleName}
                                    </div>
                                  </div>
                                ))}
                                {importResults.statistics.categorizedAssets.length > 5 && (
                                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                    +{importResults.statistics.categorizedAssets.length - 5} more...
                                  </div>
                                )}
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-lg font-semibold text-slate-400 dark:text-slate-500">0</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Auto-Categorized</div>
                        </div>
                      )}

                      {/* Unique Users */}
                      {importResults.statistics.uniqueUsers.length > 0 ? (
                        <Collapsible.Root>
                          <Collapsible.Trigger asChild>
                            <button className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg w-full text-left transition-all cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                                    {importResults.statistics.uniqueUsers.length}
                                  </div>
                                  <div className="text-xs text-blue-700 dark:text-blue-300">
                                    Unique Users
                                  </div>
                                </div>
                                <ChevronDown className="w-3 h-3 text-blue-500 dark:text-blue-400 opacity-60" />
                              </div>
                            </button>
                          </Collapsible.Trigger>
                          
                          <Collapsible.Content className="mt-2">
                            <div className="bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-xs font-medium text-blue-900 dark:text-blue-100">
                                  Assigned Users
                                </h5>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(importResults.statistics.uniqueUsers.join('\n'));
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                  title="Copy all users"
                                >
                                  Copy
                                </button>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {importResults.statistics.uniqueUsers.slice(0, 8).map((user, index) => (
                                  <div key={index} className="text-xs font-mono text-blue-800 dark:text-blue-200 bg-white dark:bg-slate-800 rounded px-2 py-1">
                                    {user}
                                  </div>
                                ))}
                                {importResults.statistics.uniqueUsers.length > 8 && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    +{importResults.statistics.uniqueUsers.length - 8} more...
                                  </div>
                                )}
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-lg font-semibold text-slate-400 dark:text-slate-500">0</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Unique Users</div>
                        </div>
                      )}

                      {/* Asset Type Breakdown */}
                      {Object.keys(importResults.statistics.assetTypeBreakdown).length > 0 ? (
                        <Collapsible.Root>
                          <Collapsible.Trigger asChild>
                            <button className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg w-full text-left transition-all cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                                    {Object.keys(importResults.statistics.assetTypeBreakdown).length}
                                  </div>
                                  <div className="text-xs text-green-700 dark:text-green-300">
                                    Asset Types
                                  </div>
                                </div>
                                <ChevronDown className="w-3 h-3 text-green-500 dark:text-green-400 opacity-60" />
                              </div>
                            </button>
                          </Collapsible.Trigger>
                          
                          <Collapsible.Content className="mt-2">
                            <div className="bg-green-50/60 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3">
                              <div className="space-y-1">
                                {Object.entries(importResults.statistics.assetTypeBreakdown).map(([type, count]) => (
                                  <div key={type} className="flex justify-between text-xs">
                                    <span className="text-green-700 dark:text-green-300">{type}</span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">{count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-lg font-semibold text-slate-400 dark:text-slate-500">0</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Asset Types</div>
                        </div>
                      )}

                      {/* Status Breakdown */}
                      {Object.keys(importResults.statistics.statusBreakdown).length > 0 ? (
                        <Collapsible.Root>
                          <Collapsible.Trigger asChild>
                            <button className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg w-full text-left transition-all cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                                    {Object.keys(importResults.statistics.statusBreakdown).length}
                                  </div>
                                  <div className="text-xs text-orange-700 dark:text-orange-300">
                                    Status Types
                                  </div>
                                </div>
                                <ChevronDown className="w-3 h-3 text-orange-500 dark:text-orange-400 opacity-60" />
                              </div>
                            </button>
                          </Collapsible.Trigger>
                          
                          <Collapsible.Content className="mt-2">
                            <div className="bg-orange-50/60 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                              <div className="space-y-1">
                                {Object.entries(importResults.statistics.statusBreakdown).map(([status, count]) => (
                                  <div key={status} className="flex justify-between text-xs">
                                    <span className="text-orange-700 dark:text-orange-300">{status}</span>
                                    <span className="text-orange-600 dark:text-orange-400 font-medium">{count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="text-lg font-semibold text-slate-400 dark:text-slate-500">0</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Status Types</div>
                        </div>
                      )}
                    </div>

                    {/* Unique Locations - Full Width */}
                    {importResults.statistics.uniqueLocations.length > 0 && (
                      <Collapsible.Root>
                        <Collapsible.Trigger asChild>
                          <button className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg w-full text-left transition-all cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/30 border border-teal-200 dark:border-teal-800">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div>
                                  <span className="text-lg font-semibold text-teal-600 dark:text-teal-400">
                                    {importResults.statistics.uniqueLocations.length}
                                  </span>
                                  <span className="text-xs text-teal-700 dark:text-teal-300 ml-2">
                                    Unique Locations
                                  </span>
                                </div>
                              </div>
                              <ChevronDown className="w-3 h-3 text-teal-500 dark:text-teal-400 opacity-60" />
                            </div>
                          </button>
                        </Collapsible.Trigger>
                        
                        <Collapsible.Content className="mt-2">
                          <div className="bg-teal-50/60 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-xs font-medium text-teal-900 dark:text-teal-100">
                                Asset Locations
                              </h5>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(importResults.statistics.uniqueLocations.join('\n'));
                                }}
                                className="px-2 py-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors"
                                title="Copy all locations"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-24 overflow-y-auto">
                              {importResults.statistics.uniqueLocations.map((location, index) => (
                                <div key={index} className="text-xs text-teal-800 dark:text-teal-200 bg-white dark:bg-slate-800 rounded px-2 py-1">
                                  {location}
                                </div>
                              ))}
                            </div>
                          </div>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-center pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleViewAssets}
                    className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    View Imported Assets
                  </button>
                  <button
                    onClick={() => {
                      // Reset the wizard
                      setCurrentStep(1);
                      setSelectedCategory('endpoints');
                      setSelectedSource(null);
                      setUploadedFiles([]);
                      setCsvData(null);
                      setColumnMappings([]);
                      setMappingValid(false);
                      setImportResults(null);
                      setItemsToImport([]);
                    }}
                    className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Import More Assets
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Progress Indicator */}
      {importMutation.isLoading && (
        <div ref={progressRef} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 scroll-mt-24">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Importing Assets...
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Processing {getFilteredItemsToImport().length} assets. This may take a few minutes.
                {realTimeProgress && (
                  <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                    ({realTimeProgress.processed} of {realTimeProgress.total} processed)
                  </span>
                )}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ 
                    width: (() => {
                      if (realTimeProgress) {
                        const pct = Math.round((realTimeProgress.processed / realTimeProgress.total) * 100);
                        return `${Math.max(pct, 5)}%`; // always show at least 5% so bar is visible
                      }
                      return '5%';
                    })()
                  }}
                >
                  {!realTimeProgress && (
                    <div className="absolute inset-0 bg-blue-600 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span>
                  {realTimeProgress?.currentItem 
                    ? `Processing: ${realTimeProgress.currentItem}`
                    : 'Processing assets...'
                  }
                </span>
                <span>
                  {realTimeProgress 
                    ? `${Math.round((realTimeProgress.processed / realTimeProgress.total) * 100)}% • ${formatElapsedTime(elapsedTime)}`
                    : elapsedTime > 0 
                      ? `Elapsed: ${formatElapsedTime(elapsedTime)}` 
                      : 'Please wait'
                  }
                </span>
              </div>
              
              {/* Progress Stats */}
              {realTimeProgress && (
                <div className="flex gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-slate-600 dark:text-slate-400">
                      {realTimeProgress.successful} successful
                    </span>
                  </div>
                  {realTimeProgress.failed > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-slate-600 dark:text-slate-400">
                        {realTimeProgress.failed} failed
                      </span>
                    </div>
                  )}
                  {realTimeProgress.skipped && realTimeProgress.skipped > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-slate-600 dark:text-slate-400">
                        {realTimeProgress.skipped} skipped
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Please don't close this page</strong> while the import is in progress. 
                The process will complete automatically and show results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 p-6 z-10">
        <div className="flex justify-between">
          <button
            onClick={() => navigate('/assets')}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            disabled={importMutation.isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleNext}
            disabled={getNextButtonDisabled()}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[140px]"
          >
            {importMutation.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {getNextButtonText()}
          </button>
        </div>
      </div>

      {/* Import Error Modal */}
      {importError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-slate-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
                  {importError.title}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {importError.message}
                </p>
              </div>
              <button
                onClick={() => setImportError(null)}
                className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Error Details */}
              {importError.details && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Error Details
                  </h4>
                  <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {importError.details}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Suggestions */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  What you can try:
                </h4>
                <div className="space-y-3">
                  {importError.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex gap-3 justify-end p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <button
                onClick={() => setImportError(null)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setImportError(null);
                  // Reset to step 4 to allow retry
                  setCurrentStep(4);
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkUpload; 