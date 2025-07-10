import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { staffApi } from '../services/api';

interface PhotoState {
  url: string | null;
  isLoading: boolean;
  error: string | null;
  hasAttempted: boolean;
}

interface PhotoBatchContextType {
  getPhotoState: (azureAdId: string) => PhotoState;
  requestPhoto: (azureAdId: string) => void;
  preloadPhotos: (azureAdIds: string[]) => void;
  clearPhotoState: (azureAdId: string) => void;
  resetAllPhotos: () => void;
}

const PhotoBatchContext = createContext<PhotoBatchContextType | undefined>(undefined);

export function usePhotoBatch() {
  const context = useContext(PhotoBatchContext);
  if (!context) {
    throw new Error('usePhotoBatch must be used within a PhotoBatchProvider');
  }
  return context;
}

interface PhotoBatchProviderProps {
  children: React.ReactNode;
  batchSize?: number;
  batchDelay?: number;
}

export function PhotoBatchProvider({ 
  children, 
  batchSize = 50, 
  batchDelay = 100 
}: PhotoBatchProviderProps) {
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoState>>({});
  const pendingRequests = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedBatches = useRef<Set<string>>(new Set());

  const getPhotoState = useCallback((azureAdId: string): PhotoState => {
    return photoStates[azureAdId] || {
      url: null,
      isLoading: false,
      error: null,
      hasAttempted: false
    };
  }, [photoStates]);

  const processBatch = useCallback(async () => {
    if (pendingRequests.current.size === 0) return;

    const batch = Array.from(pendingRequests.current).slice(0, batchSize);
    
    // Clear the processed items from pending requests
    batch.forEach(azureAdId => pendingRequests.current.delete(azureAdId));

    // Set loading state for all items in the batch
    setPhotoStates(prev => {
      const newStates = { ...prev };
      batch.forEach(azureAdId => {
        newStates[azureAdId] = {
          ...newStates[azureAdId],
          isLoading: true,
          hasAttempted: true
        };
      });
      return newStates;
    });

    // Process the batch in parallel
    const results = await Promise.allSettled(
      batch.map(async (azureAdId) => {
        try {
          const photoBlob = await staffApi.getProfilePhoto(azureAdId);
          const url = URL.createObjectURL(photoBlob);
          return { azureAdId, url, error: null };
        } catch (err: any) {
          if (err.response?.status === 404) {
            // No photo available - this is normal
            return { azureAdId, url: null, error: null };
          } else {
            return { azureAdId, url: null, error: 'Failed to load photo' };
          }
        }
      })
    );

    // Update states with results
    setPhotoStates(prev => {
      const newStates = { ...prev };
      results.forEach((result, index) => {
        const azureAdId = batch[index];
        if (result.status === 'fulfilled') {
          // Clean up old URL if it exists
          const oldState = newStates[azureAdId];
          if (oldState?.url) {
            URL.revokeObjectURL(oldState.url);
          }
          
          newStates[azureAdId] = {
            url: result.value.url,
            isLoading: false,
            error: result.value.error,
            hasAttempted: true
          };
        } else {
          newStates[azureAdId] = {
            url: null,
            isLoading: false,
            error: 'Failed to load photo',
            hasAttempted: true
          };
        }
      });
      return newStates;
    });

    // Mark this batch as processed
    batch.forEach(azureAdId => processedBatches.current.add(azureAdId));

    // If there are more pending requests, schedule another batch
    if (pendingRequests.current.size > 0) {
      batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
    }
  }, [batchSize, batchDelay]);

  const requestPhoto = useCallback((azureAdId: string) => {
    const currentState = getPhotoState(azureAdId);
    
    // Don't request if already loading, has been attempted, or is already processed
    if (currentState.isLoading || currentState.hasAttempted || processedBatches.current.has(azureAdId)) {
      return;
    }

    // Add to pending requests
    pendingRequests.current.add(azureAdId);

    // Clear existing timeout and schedule new batch processing
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
  }, [getPhotoState, processBatch, batchDelay]);

  const preloadPhotos = useCallback((azureAdIds: string[]) => {
    const newRequests = azureAdIds.filter(azureAdId => {
      const currentState = getPhotoState(azureAdId);
      return !currentState.isLoading && !currentState.hasAttempted && !processedBatches.current.has(azureAdId);
    });

    if (newRequests.length === 0) return;

    // Add all to pending requests
    newRequests.forEach(azureAdId => {
      pendingRequests.current.add(azureAdId);
    });

    // Clear existing timeout and schedule batch processing
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
  }, [getPhotoState, processBatch, batchDelay]);

  const clearPhotoState = useCallback((azureAdId: string) => {
    setPhotoStates(prev => {
      const newStates = { ...prev };
      const state = newStates[azureAdId];
      if (state?.url) {
        URL.revokeObjectURL(state.url);
      }
      delete newStates[azureAdId];
      return newStates;
    });
    
    // Remove from processed batches so it can be requested again
    processedBatches.current.delete(azureAdId);
    pendingRequests.current.delete(azureAdId);
  }, []);

  const resetAllPhotos = useCallback(() => {
    // Clean up all URLs
    Object.values(photoStates).forEach(state => {
      if (state.url) {
        URL.revokeObjectURL(state.url);
      }
    });
    
    // Reset all state
    setPhotoStates({});
    processedBatches.current.clear();
    pendingRequests.current.clear();
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, [photoStates]);

  // Cleanup URLs when component unmounts
  useEffect(() => {
    return () => {
      Object.values(photoStates).forEach(state => {
        if (state.url) {
          URL.revokeObjectURL(state.url);
        }
      });
      
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  const contextValue: PhotoBatchContextType = {
    getPhotoState,
    requestPhoto,
    preloadPhotos,
    clearPhotoState,
    resetAllPhotos
  };

  return (
    <PhotoBatchContext.Provider value={contextValue}>
      {children}
    </PhotoBatchContext.Provider>
  );
}

// Hook for individual photo usage
export function usePhoto(azureAdId: string | undefined) {
  const { getPhotoState, requestPhoto } = usePhotoBatch();
  
  const photoState = azureAdId ? getPhotoState(azureAdId) : {
    url: null,
    isLoading: false,
    error: null,
    hasAttempted: false
  };

  useEffect(() => {
    if (azureAdId && !photoState.hasAttempted && !photoState.isLoading) {
      requestPhoto(azureAdId);
    }
  }, [azureAdId, photoState.hasAttempted, photoState.isLoading, requestPhoto]);

  return photoState;
} 