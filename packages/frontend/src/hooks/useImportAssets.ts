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
  isFullSnapshot?: boolean;
}

interface ImportResponse {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ index: number; error: string; data?: any }>;
  skippedItems: Array<{ index: number; reason: string; data?: any }>;
  created: Array<{ id: string; assetTag: string }>;
  updated?: Array<{ id: string; assetTag: string }>;
  reactivated?: Array<{ id: string; assetTag: string }>;
  retired?: Array<{ id: string; assetTag: string }>;
  sessionId: string;
  statistics: {
    categorizedAssets: Array<{ assetTag: string; categoryName: string; ruleName: string }>;
    uniqueUsers: string[];
    uniqueLocations: string[];
    assetTypeBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  };
  syncRunId?: string;
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
  const isCompleteRef = React.useRef(false);

  React.useEffect(() => {
    if (!sessionId) {
      // Clean up if no session ID
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      setProgress(null);
      isCompleteRef.current = false;
      return;
    }

    // Don't reconnect if import is already complete
    if (isCompleteRef.current) {
      console.log('Import already complete, not reconnecting');
      return;
    }

    console.log('Setting up EventSource for session:', sessionId);

    const es = new EventSource(buildSseUrl(sessionId));
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('Connecting to SSE');
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const progressData: ImportProgress = JSON.parse(event.data);
        console.log('📈 Progress update:', {
          processed: progressData.processed,
          total: progressData.total,
          percentage: progressData.total > 0 ? Math.round((progressData.processed / progressData.total) * 100) : 0,
          successful: progressData.successful,
          failed: progressData.failed,
          skipped: progressData.skipped
        });
        
          setProgress(progressData);
          onProgress?.(progressData);
        
        // Auto-close when import is complete (but only if we actually have work to do)
        if (progressData.total > 0 && progressData.processed >= progressData.total) {
          console.log('🏁 Import complete, closing EventSource');
          isCompleteRef.current = true;
          es.close();
          eventSourceRef.current = null;
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Error parsing progress data:', error);
        }
      };

    es.onerror = (error) => {
      console.error('EventSource error:', error);
        setIsConnected(false);
      
      // Don't attempt to reconnect if import is complete
      if (isCompleteRef.current) {
        console.log('Import complete, not attempting to reconnect');
        return;
      }

      // Only attempt to reconnect if we haven't completed yet
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    // Cleanup function
    return () => {
      console.log('Cleaning up EventSource');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, onProgress]);

  return { progress, isConnected };
}

export const useImportAssets = () => {
  return useMutation<ImportResponse, unknown, ImportPayload>({
    mutationFn: async (payload) => {
      console.log('🚀 useImportAssets mutationFn called with payload:', payload);
      
      // Set a timeout for large imports (5 minutes)
      const timeoutMs = 5 * 60 * 1000; // 5 minutes
      const controller = new AbortController();
      
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        console.log('📡 Making API call to /import/assets...');
        const response = await api.post('/import/assets', payload, {
          signal: controller.signal,
          timeout: timeoutMs,
        });
        
        clearTimeout(timeoutId);
        console.log('✅ API call successful, response:', response.data);
        return response.data;
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ API call failed:', error);
        
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