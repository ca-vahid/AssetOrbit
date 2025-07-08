import React, { useState } from 'react';
import { useImportAssets, useImportProgress, generateSessionId } from './useImportAssets';
import type { ColumnMapping } from '../utils/ninjaMapping';
import type { ImportProgress } from './useImportAssets';

interface ImportOptions {
  assets: Record<string, string>[];
  columnMappings: ColumnMapping[];
  conflictResolution: 'skip' | 'overwrite';
  source: string;
  resolvedUserMap: Record<string, any>;
  resolvedLocationMap: Record<string, any>;
}

export function useImportExecutor() {
  const importMutation = useImportAssets();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  // start a timer for elapsed time
  React.useEffect(() => {
    let id: any;
    if (sessionId) {
      const start = Date.now();
      id = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    }
    return () => clearInterval(id);
  }, [sessionId]);

  // SSE progress listener
  useImportProgress(sessionId, p => setProgress(p));

  const startImport = (opts: ImportOptions, onSuccess: (res: any) => void, onError: (err: any) => void) => {
    const id = generateSessionId();
    setSessionId(id);
    setProgress(null);
    setElapsedMs(0);

    importMutation.mutate(
      {
        ...opts,
        sessionId: id,
      },
      { onSuccess, onError }
    );
  };

  return { startImport, progress, elapsedMs, isLoading: importMutation.isLoading };
} 