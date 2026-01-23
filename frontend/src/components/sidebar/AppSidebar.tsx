/**
 * Main sidebar shell component that composes all sidebar sections.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useRouterState, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { useEffectiveSettings } from "@/lib/settings-context";
import { cn } from "@/lib/utils";
import { testId } from "@/lib/test-id";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { orgSettingsNavItem } from "./navigation-items";
import { NavUser } from "./NavUser";
import { useWorkspace } from "@/lib/workspace";
import { CreateTeamDialog } from "@/components/create-team-dialog";
import { organizationsApi } from "@/lib/api";
import { SortableTeamItem } from "./SortableTeamItem";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const effectiveSettings = useEffectiveSettings();
  const { currentTeam, teams, switchTeam, currentOrgRole, currentOrg } =
    useWorkspace();

  // Load section and team expanded states from localStorage on mount
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar-workspace-open");
      return stored !== "false"; // Default to open
    } catch {
      return true;
    }
  });
  const [teamsSectionOpen, setTeamsSectionOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar-teams-open");
      return stored !== "false"; // Default to open
    } catch {
      return true;
    }
  });
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("sidebar-expanded-teams");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {
      // Ignore parsing errors
    }
    return new Set();
  });
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [orderedTeams, setOrderedTeams] = useState(teams);

  const canCreateTeam =
    currentOrgRole === "owner" || currentOrgRole === "admin";

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Update ordered teams when teams change
  useEffect(() => {
    setOrderedTeams(teams);
  }, [teams]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedTeams.findIndex((team) => team.id === active.id);
      const newIndex = orderedTeams.findIndex((team) => team.id === over.id);

      const newOrderedTeams = arrayMove(orderedTeams, oldIndex, newIndex);
      setOrderedTeams(newOrderedTeams);

      // Save to backend
      if (currentOrg) {
        try {
          await organizationsApi.updateTeamOrder(
            currentOrg.id,
            newOrderedTeams.map((t) => t.id),
          );
          // Invalidate membership query to update the stored order
          queryClient.invalidateQueries({
            queryKey: ["workspace", "my-membership", currentOrg.id],
          });
        } catch (error) {
          console.error("Failed to update team order:", error);
          // Revert on error
          setOrderedTeams(teams);
        }
      }
    }
  };

  const toggleWorkspaceSection = () => {
    setWorkspaceSectionOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-workspace-open", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const toggleTeamsSection = () => {
    setTeamsSectionOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-teams-open", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const toggleTeamExpanded = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      // Persist to localStorage
      try {
        localStorage.setItem(
          "sidebar-expanded-teams",
          JSON.stringify([...next]),
        );
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  // Close mobile drawer on navigation
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const chatEnabled = effectiveSettings.chat_enabled;

  return (
    <Sidebar {...testId("app-sidebar-container")} collapsible="icon" {...props}>
      <SidebarHeader
        className={cn(state === "collapsed" && "items-center")}
        {...testId("sidebar-header")}
      >
        <NavUser />
      </SidebarHeader>
      <SidebarContent {...testId("sidebar-content")}>
        {/* Workspace Section - Admin only */}
        {canCreateTeam && (
          <SidebarGroup
            className={cn(state === "collapsed" && "items-center px-0")}
            {...testId("sidebar-section-workspace")}
          >
            {state === "expanded" && (
              <SidebarGroupLabel
                className="flex items-center justify-between px-2 h-6 cursor-pointer hover:bg-sidebar-accent/50 rounded-md"
                onClick={toggleWorkspaceSection}
                {...testId("sidebar-section-workspace-header")}
              >
                <span className="text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
                  {t("nav_workspace")}
                </span>
                <ChevronDown
                  className={cn(
                    "size-3 text-sidebar-foreground/50 transition-transform",
                    !workspaceSectionOpen && "-rotate-90",
                  )}
                />
              </SidebarGroupLabel>
            )}
            {(state === "collapsed" || workspaceSectionOpen) && (
              <SidebarGroupContent>
                <SidebarMenu
                  className={cn(state === "collapsed" && "items-center")}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath.startsWith("/org/settings") ||
                        currentPath.startsWith("/org/api-keys") ||
                        currentPath.startsWith("/org/prompts")
                      }
                      tooltip={t(orgSettingsNavItem.titleKey)}
                      className={cn(
                        state === "collapsed" &&
                          "flex items-center justify-center",
                      )}
                    >
                      <Link
                        {...testId("sidebar-nav-item-org-settings")}
                        to={orgSettingsNavItem.url}
                      >
                        <orgSettingsNavItem.icon />
                        {state === "expanded" && (
                          <span>{t(orgSettingsNavItem.titleKey)}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        {/* Your Teams Section */}
        <SidebarGroup
          className={cn(state === "collapsed" && "items-center px-0")}
          {...testId("sidebar-section-teams")}
        >
          {state === "expanded" && (
            <SidebarGroupLabel
              className="flex items-center justify-between group px-2 h-6"
              {...testId("sidebar-section-teams-header")}
            >
              <button
                onClick={toggleTeamsSection}
                className="flex items-center gap-1 hover:bg-sidebar-accent/50 rounded-md -ml-1 pl-1 pr-2 py-0.5"
                {...testId("sidebar-section-teams-toggle")}
              >
                <ChevronDown
                  className={cn(
                    "size-3 text-sidebar-foreground/50 transition-transform",
                    !teamsSectionOpen && "-rotate-90",
                  )}
                />
                <span className="text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
                  {t("nav_your_teams")}
                </span>
              </button>
              {canCreateTeam && (
                <button
                  {...testId("sidebar-create-team-button")}
                  onClick={() => setCreateTeamOpen(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-sidebar-accent rounded-md"
                  title={t("team_create")}
                >
                  <Plus className="size-3 text-sidebar-foreground/50" />
                </button>
              )}
            </SidebarGroupLabel>
          )}
          {(state === "collapsed" || teamsSectionOpen) && (
            <SidebarGroupContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedTeams.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <SidebarMenu
                    className={cn(state === "collapsed" && "items-center")}
                  >
                    {orderedTeams.map((team) => {
                      const isExpanded = expandedTeams.has(team.id);
                      const isActive = currentTeam?.id === team.id;

                      return (
                        <SortableTeamItem
                          key={team.id}
                          team={team}
                          isExpanded={isExpanded}
                          isActive={isActive}
                          currentPath={currentPath}
                          chatEnabled={chatEnabled}
                          isOrgAdmin={canCreateTeam}
                          onToggleExpanded={toggleTeamExpanded}
                          onSwitchTeam={switchTeam}
                        />
                      );
                    })}
                  </SidebarMenu>
                </SortableContext>
              </DndContext>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <CreateTeamDialog
          open={createTeamOpen}
          onOpenChange={setCreateTeamOpen}
        />
      </SidebarContent>
    </Sidebar>
  );
}
