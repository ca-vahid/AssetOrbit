import { useState, useEffect } from 'react';
import { ColumnMapping } from '../utils/ninjaMapping';
import { getFilterKey, applyImportFilter } from '../utils/importFilters';
import { useResolveImport } from './useResolveImport';

interface PreviewParams {
  rows: Record<string, string>[];
  headers: string[];
  columnMappings: ColumnMapping[];
  selectedSource: string | null;
  selectedCategory: string;
  enableLastOnlineFilter: boolean;
  lastOnlineMaxDays: number;
}

export function useImportPreview(params: PreviewParams) {
  const [mappingValid, setMappingValid] = useState(false);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [filterStats, setFilterStats] = useState<any>(null);
  const [excludedItems, setExcludedItems] = useState<Record<string, string>[]>([]);
  const [resolvedUserMap, setResolvedUserMap] = useState<Record<string, any>>({});
  const [resolvedLocationMap, setResolvedLocationMap] = useState<Record<string, any>>({});
  const [conflicts, setConflicts] = useState<Record<string, any>>({});

  const resolveMutation = useResolveImport();

  // Run filter stats when rows change
  useEffect(() => {
    if (!params.rows.length) return;
    const filterKey = getFilterKey(params.selectedSource || '', params.selectedCategory);
    const { filteredData, excludedData, filterStats } = applyImportFilter(params.rows, filterKey);
    setExcludedItems(excludedData);
    setFilterStats(filterStats);
  }, [params.rows, params.selectedSource, params.selectedCategory]);

  // Resolve usernames / locations when mapping valid
  useEffect(() => {
    if (!mappingValid) return;
    const usernameColumn = params.columnMappings.find(m => m.targetField === 'assignedToAadId')?.ninjaColumn;
    const locationColumn = params.columnMappings.find(m => m.targetField === 'locationId')?.ninjaColumn;

    if (!usernameColumn && !locationColumn) return;

    const usernames: string[] = [];
    const locations: string[] = [];
    params.rows.forEach(row => {
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
    });

    if (usernames.length || locations.length) {
      resolveMutation.mutate(
        { usernames, locations, serialNumbers: [] },
        {
          onSuccess: ({ userMap, locationMap }) => {
            setResolvedUserMap(userMap);
            setResolvedLocationMap(locationMap);
          }
        }
      );
    }
  }, [mappingValid, params.columnMappings, params.rows]);

  return {
    mappingValid,
    setMappingValid,
    mappingErrors,
    setMappingErrors,
    filterStats,
    excludedItems,
    resolvedUserMap,
    resolvedLocationMap,
    conflicts,
  };
} 