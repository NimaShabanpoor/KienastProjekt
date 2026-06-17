// Zustand-Store für UI-State
// Sidebar, Loading-States

import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  isLoading: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: true,
  isLoading: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
