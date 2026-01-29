
import { create } from 'zustand';

interface LayoutState {
  isZenMode: boolean;
  toggleZenMode: () => void;
  setZenMode: (value: boolean) => void;
  
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isZenMode: false,
  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
  setZenMode: (value) => set({ isZenMode: value }),
  
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (value) => set({ isSidebarCollapsed: value }),
}));
