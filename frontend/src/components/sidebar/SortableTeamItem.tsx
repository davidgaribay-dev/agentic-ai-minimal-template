import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  GripVertical,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn, isValidImageUrl } from "@/lib/utils";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TeamRole } from "@/lib/api";

interface Team {
  id: string;
  name: string;
  logo_url?: string | null;
  my_role: TeamRole;
}

interface SortableTeamItemProps {
  team: Team;
  isExpanded: boolean;
  isActive: boolean;
  currentPath: string;
  chatEnabled: boolean;
  isOrgAdmin: boolean;
  onToggleExpanded: (teamId: string) => void;
  onSwitchTeam: (teamId: string) => void;
}

export function SortableTeamItem({
  team,
  isExpanded,
  isActive,
  currentPath,
  chatEnabled,
  isOrgAdmin,
  onToggleExpanded,
  onSwitchTeam,
}: SortableTeamItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useSidebar();

  // User can access team settings if they're a team admin or org admin
  const canAccessTeamSettings = team.my_role === "admin" || isOrgAdmin;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50")}
    >
      <SidebarMenuItem>
        <div className="flex items-center w-full group/team">
          {/* Drag Handle - visible on hover */}
          {state === "expanded" && (
            <button
              {...attributes}
              {...listeners}
              className="p-0.5 hover:bg-sidebar-accent rounded-sm opacity-0 group-hover/team:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1"
              aria-label={t("aria_drag_to_reorder")}
            >
              <GripVertical className="size-3.5 text-sidebar-foreground/50" />
            </button>
          )}

          <SidebarMenuButton
            onClick={() => {
              onToggleExpanded(team.id);
              onSwitchTeam(team.id);
            }}
            isActive={false}
            tooltip={state === "collapsed" ? team.name : undefined}
            className={cn(
              "flex-1 h-7 hover:bg-transparent active:bg-transparent pr-1",
              state === "collapsed" && "flex items-center justify-center",
              isActive && !isExpanded && "font-medium",
            )}
          >
            {isValidImageUrl(team.logo_url) ? (
              <img
                src={team.logo_url}
                alt={team.name}
                className="size-5 rounded object-cover"
              />
            ) : (
              <div className="flex size-5 items-center justify-center rounded bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 text-sidebar-primary-foreground text-[10px] font-semibold">
                {team.name.charAt(0).toUpperCase()}
              </div>
            )}
            {state === "expanded" && (
              <>
                <span className="flex-1 truncate text-[13px] font-medium">
                  {team.name}
                </span>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-sidebar-foreground/50 transition-transform shrink-0 -rotate-90",
                    isExpanded && "rotate-0",
                  )}
                />
              </>
            )}
          </SidebarMenuButton>
          {state === "expanded" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-0.5 hover:bg-sidebar-accent rounded-sm opacity-0 group-hover/team:opacity-100 transition-opacity">
                  <MoreHorizontal className="size-3.5 text-sidebar-foreground/50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="w-48">
                {canAccessTeamSettings && (
                  <DropdownMenuItem asChild>
                    <Link
                      to="/org/team/$teamId/settings"
                      params={{ teamId: team.id }}
                      className="cursor-pointer"
                    >
                      <Settings className="size-4 mr-2" />
                      {t("team_settings")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    const url = `${window.location.origin}/team/${team.id}/chat`;
                    navigator.clipboard.writeText(url);
                  }}
                >
                  <Link2 className="size-4 mr-2" />
                  {t("com_copy_link")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarMenuItem>

      {state === "expanded" && isExpanded && (
        <div className="ml-4 pl-4 border-l-2 border-sidebar-border">
          {/* New Chat button for team */}
          {chatEnabled && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  onSwitchTeam(team.id);
                  navigate({
                    to: "/team/$teamId/chat",
                    params: { teamId: team.id },
                  });
                }}
                isActive={currentPath === `/team/${team.id}/chat` && isActive}
                className="h-7 pl-3"
              >
                <Plus className="size-4" />
                <span className="text-[12px]">{t("nav_new_chat")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Chats button - navigates to team search/chats page */}
          {chatEnabled && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={currentPath === `/team/${team.id}/search` && isActive}
                className="h-7 pl-3"
              >
                <Link
                  to="/team/$teamId/search"
                  params={{ teamId: team.id }}
                  onClick={() => onSwitchTeam(team.id)}
                >
                  <MessageSquare className="size-4" />
                  <span className="text-[12px]">{t("nav_chats")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </div>
      )}
    </div>
  );
}
