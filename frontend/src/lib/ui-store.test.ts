/**
 * Tests for ui-store.ts
 *
 * Tests for the UI store that manages persistent UI preferences:
 * - Sidebar state (open/closed)
 * - Side panel state (open/closed, width)
 * - Width clamping to min/max boundaries
 */

import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import {
  useUIStore,
  MIN_SIDE_PANEL_WIDTH,
  MAX_SIDE_PANEL_WIDTH,
  DEFAULT_SIDE_PANEL_WIDTH,
} from "./ui-store";

describe("useUIStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      sidebarOpen: true,
      sidePanelOpen: false,
      sidePanelWidth: DEFAULT_SIDE_PANEL_WIDTH,
    });
  });

  describe("initial state", () => {
    it("has correct default values", () => {
      const state = useUIStore.getState();

      expect(state.sidebarOpen).toBe(true);
      expect(state.sidePanelOpen).toBe(false);
      expect(state.sidePanelWidth).toBe(DEFAULT_SIDE_PANEL_WIDTH);
    });
  });

  describe("sidebar state", () => {
    it("setSidebarOpen sets sidebar state", () => {
      act(() => {
        useUIStore.getState().setSidebarOpen(false);
      });

      expect(useUIStore.getState().sidebarOpen).toBe(false);

      act(() => {
        useUIStore.getState().setSidebarOpen(true);
      });

      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it("toggleSidebar toggles sidebar state", () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);

      act(() => {
        useUIStore.getState().toggleSidebar();
      });

      expect(useUIStore.getState().sidebarOpen).toBe(false);

      act(() => {
        useUIStore.getState().toggleSidebar();
      });

      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe("side panel state", () => {
    it("setSidePanelOpen sets side panel state", () => {
      act(() => {
        useUIStore.getState().setSidePanelOpen(true);
      });

      expect(useUIStore.getState().sidePanelOpen).toBe(true);

      act(() => {
        useUIStore.getState().setSidePanelOpen(false);
      });

      expect(useUIStore.getState().sidePanelOpen).toBe(false);
    });

    it("toggleSidePanel toggles side panel state", () => {
      expect(useUIStore.getState().sidePanelOpen).toBe(false);

      act(() => {
        useUIStore.getState().toggleSidePanel();
      });

      expect(useUIStore.getState().sidePanelOpen).toBe(true);

      act(() => {
        useUIStore.getState().toggleSidePanel();
      });

      expect(useUIStore.getState().sidePanelOpen).toBe(false);
    });
  });

  describe("side panel width", () => {
    it("setSidePanelWidth sets width within bounds", () => {
      act(() => {
        useUIStore.getState().setSidePanelWidth(500);
      });

      expect(useUIStore.getState().sidePanelWidth).toBe(500);
    });

    it("clamps width to minimum", () => {
      act(() => {
        useUIStore.getState().setSidePanelWidth(100); // Below minimum
      });

      expect(useUIStore.getState().sidePanelWidth).toBe(MIN_SIDE_PANEL_WIDTH);
    });

    it("clamps width to maximum", () => {
      act(() => {
        useUIStore.getState().setSidePanelWidth(1000); // Above maximum
      });

      expect(useUIStore.getState().sidePanelWidth).toBe(MAX_SIDE_PANEL_WIDTH);
    });

    it("accepts width at exact minimum boundary", () => {
      act(() => {
        useUIStore.getState().setSidePanelWidth(MIN_SIDE_PANEL_WIDTH);
      });

      expect(useUIStore.getState().sidePanelWidth).toBe(MIN_SIDE_PANEL_WIDTH);
    });

    it("accepts width at exact maximum boundary", () => {
      act(() => {
        useUIStore.getState().setSidePanelWidth(MAX_SIDE_PANEL_WIDTH);
      });

      expect(useUIStore.getState().sidePanelWidth).toBe(MAX_SIDE_PANEL_WIDTH);
    });

    it("handles zero width by clamping to minimum", () => {
      act(() => {
        useUIStore.getState().setSidePanelWidth(0);
      });

      expect(useUIStore.getState().sidePanelWidth).toBe(MIN_SIDE_PANEL_WIDTH);
    });

    it("handles negative width by clamping to minimum", () => {
      act(() => {
        useUIStore.getState().setSidePanelWidth(-100);
      });

      expect(useUIStore.getState().sidePanelWidth).toBe(MIN_SIDE_PANEL_WIDTH);
    });
  });

  describe("state independence", () => {
    it("sidebar state does not affect side panel state", () => {
      act(() => {
        useUIStore.getState().setSidePanelOpen(true);
        useUIStore.getState().toggleSidebar();
      });

      expect(useUIStore.getState().sidebarOpen).toBe(false);
      expect(useUIStore.getState().sidePanelOpen).toBe(true);
    });

    it("side panel state does not affect sidebar state", () => {
      act(() => {
        useUIStore.getState().setSidebarOpen(false);
        useUIStore.getState().toggleSidePanel();
      });

      expect(useUIStore.getState().sidebarOpen).toBe(false);
      expect(useUIStore.getState().sidePanelOpen).toBe(true);
    });
  });
});

describe("design token constants", () => {
  it("MIN_SIDE_PANEL_WIDTH is 450", () => {
    expect(MIN_SIDE_PANEL_WIDTH).toBe(450);
  });

  it("MAX_SIDE_PANEL_WIDTH is 600", () => {
    expect(MAX_SIDE_PANEL_WIDTH).toBe(600);
  });

  it("DEFAULT_SIDE_PANEL_WIDTH is 500", () => {
    expect(DEFAULT_SIDE_PANEL_WIDTH).toBe(500);
  });

  it("DEFAULT_SIDE_PANEL_WIDTH is within min/max bounds", () => {
    expect(DEFAULT_SIDE_PANEL_WIDTH).toBeGreaterThanOrEqual(
      MIN_SIDE_PANEL_WIDTH,
    );
    expect(DEFAULT_SIDE_PANEL_WIDTH).toBeLessThanOrEqual(MAX_SIDE_PANEL_WIDTH);
  });
});
