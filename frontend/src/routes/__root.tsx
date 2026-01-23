import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  SidePanelProvider,
  SidePanel,
  useSidePanel,
} from "@/components/side-panel";
import { WorkspaceProvider } from "@/lib/workspace";
import { SettingsProvider, useEffectiveSettings } from "@/lib/settings-context";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { SettingsSidebar } from "@/components/sidebar/SettingsSidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { PanelRight, PanelLeft } from "lucide-react";
import { useIsMobile } from "@/hooks";
import type { RouterContext } from "@/lib/router-context";
import { testId } from "@/lib/test-id";

/** Check if current path is a settings page */
function isSettingsPage(pathname: string): boolean {
  return (
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/org/settings" ||
    pathname.startsWith("/org/settings/") ||
    (pathname.includes("/team/") && pathname.includes("/settings"))
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function ChatToggleButton() {
  const { t } = useTranslation();
  const { toggle, isOpen } = useSidePanel();
  const effectiveSettings = useEffectiveSettings();
  const isMobile = useIsMobile();

  // Hide on mobile - side panel not supported
  if (isMobile) return null;
  if (isOpen) return null;

  // Hide the toggle button entirely if chat panel is disabled
  if (!effectiveSettings.chat_panel_enabled) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      className="fixed top-3 right-4 z-50 flex size-8 items-center justify-center rounded-md hover:bg-muted"
      aria-label={t("aria_open_panel")}
    >
      <PanelRight className="size-4" />
    </button>
  );
}

function DesktopLayout() {
  const location = useLocation();
  const { open: sidebarOpen } = useSidebar();
  const { isOpen: panelOpen, width: panelWidth } = useSidePanel();
  const effectiveSettings = useEffectiveSettings();

  const onSettingsPage = isSettingsPage(location.pathname);
  const sidebarWidth = sidebarOpen ? "16rem" : "3rem";
  const chatPanelEnabled = effectiveSettings.chat_panel_enabled;
  const rightPanelWidth =
    panelOpen && chatPanelEnabled && !onSettingsPage
      ? `${panelWidth}px`
      : "0px";

  return (
    <div
      {...testId("app-root-desktop")}
      className="hidden md:grid h-screen w-screen overflow-hidden"
      style={{
        gridTemplateColumns: `${sidebarWidth} 1fr ${rightPanelWidth}`,
        gridTemplateRows: "1fr",
        transition: "grid-template-columns 200ms ease-linear",
      }}
    >
      {onSettingsPage ? <SettingsSidebar /> : <AppSidebar />}

      <main
        {...testId("root-outlet-desktop")}
        className="overflow-auto bg-background border-0"
      >
        <Outlet />
      </main>

      {/* Right panel area - only render if chat panel is enabled and not on settings */}
      {panelOpen && chatPanelEnabled && !onSettingsPage && <SidePanel />}

      {!onSettingsPage && <ChatToggleButton />}
    </div>
  );
}

function MobileSidebarToggle() {
  const { t } = useTranslation();
  const { toggleSidebar, openMobile } = useSidebar();

  // Hide when drawer is open
  if (openMobile) return null;

  return (
    <button
      onClick={toggleSidebar}
      className="fixed top-3 left-3 z-50 flex size-9 items-center justify-center rounded-md bg-background/60 backdrop-blur-sm hover:bg-background/80 active:bg-background/90 md:hidden"
      aria-label={t("aria_open_menu")}
    >
      <PanelLeft className="size-4" />
    </button>
  );
}

function MobileLayout() {
  const location = useLocation();
  const onSettingsPage = isSettingsPage(location.pathname);

  return (
    <div
      {...testId("app-root-mobile")}
      className="flex flex-col h-screen w-screen overflow-hidden md:hidden"
    >
      {/* Mobile sidebar (off-canvas drawer) */}
      {onSettingsPage ? <SettingsSidebar /> : <AppSidebar />}

      {/* Floating sidebar toggle */}
      <MobileSidebarToggle />

      {/* Main content area - pt-14 reserves space for floating toggle */}
      <main
        {...testId("root-outlet-mobile")}
        className="flex-1 overflow-auto bg-background pt-14"
      >
        <Outlet />
      </main>
    </div>
  );
}

function MainLayout() {
  return (
    <>
      <DesktopLayout />
      <MobileLayout />
    </>
  );
}

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <MainLayout />
    </SidebarProvider>
  );
}

function UnauthenticatedLayout() {
  return (
    <main className="h-screen w-screen overflow-y-auto">
      <Outlet />
    </main>
  );
}

function RootComponent() {
  // Use useAuth directly instead of router context to ensure reactivity
  // Router context doesn't re-render components when it changes
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <ThemeProvider defaultTheme="system" storageKey="ui-theme">
          <SettingsProvider>
            <SidePanelProvider>
              {isAuthenticated || isLoading ? (
                <AuthenticatedLayout />
              ) : (
                <UnauthenticatedLayout />
              )}
            </SidePanelProvider>
          </SettingsProvider>
        </ThemeProvider>
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div
      {...testId("not-found-page")}
      className="flex min-h-screen flex-col items-center justify-center gap-4"
    >
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">{t("page_not_found")}</p>
      <Link to="/" className="text-primary hover:underline">
        {t("page_go_home")}
      </Link>
    </div>
  );
}
