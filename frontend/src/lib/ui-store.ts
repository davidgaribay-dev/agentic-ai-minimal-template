/**
 * UI Store
 *
 * Persistent UI preferences (sidebar state, panel state, widths).
 * Uses localStorage persistence via zustand/persist middleware.
 *
 * Design decisions:
 * 1. Separate from chat-store because:
 *    - UI preferences should survive page refresh (persisted)
 *    - Changes infrequently (only on user interactions)
 *    - Small payload suitable for localStorage
 *
 * 2. Granular selectors provided to prevent unnecessary re-renders:
 *    - useSidebarState(): Only sidebar-related state
 *    - useSidePanelState(): Only side panel-related state
 *    - Atomic selectors (useSidebarOpen, useSidePanelOpen, etc.)
 *
 * 3. Side panel width is clamped to min/max from design tokens
 *
 * Usage:
 *   // Full state (rarely needed)
 *   const { sidebarOpen, toggleSidebar } = useUIStore();
 *
 *   // Preferred: Use granular selectors
 *   const { sidebarOpen, toggleSidebar } = useSidebarState();
 *   const sidePanelOpen = useSidePanelOpen();
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

import { LAYOUT } from "@/lib/design-tokens";

const DEFAULT_SIDE_PANEL_WIDTH = LAYOUT.sidePanel.default;
const MIN_SIDE_PANEL_WIDTH = LAYOUT.sidePanel.min;
const MAX_SIDE_PANEL_WIDTH = LAYOUT.sidePanel.max;

interface UIState {
  sidebarOpen: boolean;
  sidePanelOpen: boolean;
  sidePanelWidth: number;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidePanelOpen: (open: boolean) => void;
  toggleSidePanel: () => void;
  setSidePanelWidth: (width: number) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidePanelOpen: false,
      sidePanelWidth: DEFAULT_SIDE_PANEL_WIDTH,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
      toggleSidePanel: () =>
        set((state) => ({ sidePanelOpen: !state.sidePanelOpen })),
      setSidePanelWidth: (width) =>
        set({
          sidePanelWidth: Math.min(
            Math.max(width, MIN_SIDE_PANEL_WIDTH),
            MAX_SIDE_PANEL_WIDTH,
          ),
        }),
    }),
    {
      name: "ui-storage",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidePanelOpen: state.sidePanelOpen,
        sidePanelWidth: state.sidePanelWidth,
      }),
    },
  ),
);

export { MIN_SIDE_PANEL_WIDTH, MAX_SIDE_PANEL_WIDTH, DEFAULT_SIDE_PANEL_WIDTH };

/** Selector for sidebar state only - prevents re-renders when other state changes */
export const useSidebarState = () =>
  useUIStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      toggleSidebar: state.toggleSidebar,
    })),
  );

/** Selector for side panel state only - prevents re-renders when other state changes */
export const useSidePanelState = () =>
  useUIStore(
    useShallow((state) => ({
      sidePanelOpen: state.sidePanelOpen,
      sidePanelWidth: state.sidePanelWidth,
      setSidePanelOpen: state.setSidePanelOpen,
      toggleSidePanel: state.toggleSidePanel,
      setSidePanelWidth: state.setSidePanelWidth,
    })),
  );

export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen);
export const useSidePanelOpen = () =>
  useUIStore((state) => state.sidePanelOpen);
export const useSidePanelWidth = () =>
  useUIStore((state) => state.sidePanelWidth);
