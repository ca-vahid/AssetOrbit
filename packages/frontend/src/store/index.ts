import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../services/api';

interface AppState {
  // User state
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  
  // UI preferences
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  tableColumnVisibility: Record<string, Record<string, boolean>>;
  setTableColumnVisibility: (tableName: string, columns: Record<string, boolean>) => void;
  
  // Filters
  assetFilters: {
    status?: string;
    condition?: string;
    assetType?: string;
    departmentId?: string;
    locationId?: string;
    assignedToId?: string;
  };
  setAssetFilters: (filters: AppState['assetFilters']) => void;
  clearAssetFilters: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // User state
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      
      // Theme
      theme: 'light',
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        // Update document class
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { theme: newTheme };
      }),
      
      // UI preferences
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      tableColumnVisibility: {},
      setTableColumnVisibility: (tableName, columns) =>
        set((state) => ({
          tableColumnVisibility: {
            ...state.tableColumnVisibility,
            [tableName]: columns,
          },
        })),
      
      // Filters
      assetFilters: {},
      setAssetFilters: (filters) => set({ assetFilters: filters }),
      clearAssetFilters: () => set({ assetFilters: {} }),
    }),
    {
      name: 'asset-tracking-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        tableColumnVisibility: state.tableColumnVisibility,
        assetFilters: state.assetFilters,
      }),
    }
  )
);

// Initialize theme on load
if (typeof window !== 'undefined') {
  const store = useStore.getState();
  if (store.theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
} 