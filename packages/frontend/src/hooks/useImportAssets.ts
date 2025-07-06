import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { ColumnMapping } from '../utils/ninjaMapping';
import React from 'react';

interface ImportPayload {
  assets: Record<string, string>[];
  columnMappings: ColumnMapping[];
  conflictResolution: 'skip' | 'overwrite';
  source?: string;
  sessionId?: string;
}

interface ImportResponse {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ index: number; error: string; data?: any }>;
  skippedItems: Array<{ index: number; reason: string; data?: any }>;
  created: Array<{ id: string; assetTag: string }>;
  sessionId: string;
  statistics: {
    categorizedAssets: Array<{ assetTag: string; categoryName: string; ruleName: string }>;
    uniqueUsers: string[];
    uniqueLocations: string[];
    assetTypeBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  };
}

export interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped?: number;
  currentItem?: string;
  errors: Array<{ index: number; error: string; data?: any }>;
  // Enhanced statistics
  categorizedAssets?: Array<{ assetTag: string; categoryName: string; ruleName: string }>;
  uniqueUsers?: string[];
  uniqueLocations?: string[];
  assetTypeBreakdown?: Record<string, number>;
  statusBreakdown?: Record<string, number>;
}

// Generate a unique session ID for progress tracking
export function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper to build SSE URL using same base URL the axios client uses
function buildSseUrl(sessionId: string) {
  const base = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
  return `${base}/import/progress/${sessionId}`;
}

// Hook for tracking import progress via Server-Sent Events
export function useImportProgress(sessionId: string | null, onProgress?: (progress: ImportProgress) => void) {
  const [progress, setProgress] = React.useState<ImportProgress | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    if (!sessionId) return;

    console.log('Setting up EventSource for session:', sessionId);

    const connect = () => {
      console.log('Connecting to SSE');
      const es = new EventSource(buildSseUrl(sessionId));

      es.onopen = () => {
        console.log('EventSource connected');
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          // console.debug('Progress data', event.data);
          const progressData: ImportProgress = JSON.parse(event.data);
          setProgress(progressData);
          onProgress?.(progressData);
        } catch (err) {
          console.error('Error parsing progress data', err);
        }
      };

      es.onerror = () => {
        console.error('EventSource error – attempting reconnect in 3s');
        es.close();
        setIsConnected(false);
        setTimeout(connect, 3000);
      };

      // Store reference so we can close on cleanup
      eventSourceRef.current = es;
    };

    connect();

    return () => {
      console.log('Cleaning up EventSource');
      eventSourceRef.current?.close();
      setIsConnected(false);
    };
  }, [sessionId, onProgress]);

  return { progress, isConnected };
}

export const useImportAssets = () => {
  return useMutation<ImportResponse, unknown, ImportPayload>({
    mutationFn: async (payload) => {
      // Set a timeout for large imports (5 minutes)
      const timeoutMs = 5 * 60 * 1000; // 5 minutes
      const controller = new AbortController();
      
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const response = await api.post('/import/assets', payload, {
          signal: controller.signal,
          timeout: timeoutMs,
        });
        
        clearTimeout(timeoutId);
        return response.data;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (controller.signal.aborted) {
          throw new Error('Import timeout - the operation took too long to complete. Please try importing fewer assets at once.');
        }
        
        throw error;
      }
    },
    // Increase retry delay for large imports
    retry: (failureCount, error) => {
      // Don't retry on timeout or client errors
      if (error instanceof Error && error.message.includes('timeout')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}; 