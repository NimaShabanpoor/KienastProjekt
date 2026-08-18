// Zustand-Store für UI-State
// Sidebar (Desktop eingeklappt, Mobile-Drawer)

import { create } from 'zustand';

const STORAGE_KEY = 'schuladmin.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  isLoading: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarCollapsed: readCollapsed(),
  mobileNavOpen: false,
  isLoading: false,

  setSidebarCollapsed: (collapsed) => {
    writeCollapsed(collapsed);
    set({ sidebarCollapsed: collapsed });
  },
  toggleSidebar: () =>
    set((state) => {
      const sidebarCollapsed = !state.sidebarCollapsed;
      writeCollapsed(sidebarCollapsed);
      return { sidebarCollapsed };
    }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
