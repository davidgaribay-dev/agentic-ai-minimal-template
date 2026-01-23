/**
 * Settings-specific sidebar that replaces main sidebar when on settings pages.
 * Shows only the relevant settings section based on current route.
 */

import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  User,
  Bell,
  Palette,
  Globe,
  Brain,
  Image,
  ShieldCheck,
  Building2,
  Users,
  Settings,
  Activity,
  FolderOpen,
  Sparkles,
  Key,
  Plug,
  FileText,
  type LucideIcon,
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useWorkspaceSafe } from "@/lib/workspace";

type SettingsSidebarProps = React.ComponentProps<typeof Sidebar>;

interface NavItem {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  tab: string;
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

// User settings navigation items grouped by section
// Order: Account → AI → Security → Developer → Data (consistent with org/team)
const userSettingsSections: NavSection[] = [
  {
    labelKey: "settings_section_account",
    items: [
      {
        id: "profile",
        titleKey: "settings_profile",
        icon: User,
        tab: "profile",
      },
      {
        id: "preferences",
        titleKey: "settings_preferences",
        icon: Bell,
        tab: "preferences",
      },
      { id: "theme", titleKey: "settings_theme", icon: Palette, tab: "theme" },
      {
        id: "language",
        titleKey: "settings_language",
        icon: Globe,
        tab: "language",
      },
    ],
  },
  {
    labelKey: "settings_section_ai",
    items: [
      {
        id: "system-prompts",
        titleKey: "org_settings_system_prompts",
        icon: Sparkles,
        tab: "system-prompts",
      },
      {
        id: "templates",
        titleKey: "org_settings_templates",
        icon: FileText,
        tab: "templates",
      },
      { id: "memory", titleKey: "settings_memory", icon: Brain, tab: "memory" },
      { id: "mcp", titleKey: "settings_mcp", icon: Plug, tab: "mcp" },
      { id: "rag", titleKey: "settings_docs", icon: FolderOpen, tab: "rag" },
    ],
  },
  {
    labelKey: "settings_section_security",
    items: [
      {
        id: "guardrails",
        titleKey: "settings_guardrails",
        icon: ShieldCheck,
        tab: "guardrails",
      },
    ],
  },
  {
    labelKey: "settings_section_developer",
    items: [
      {
        id: "api-keys",
        titleKey: "settings_api_keys",
        icon: Key,
        tab: "api-keys",
      },
    ],
  },
  {
    labelKey: "settings_section_data",
    items: [
      { id: "media", titleKey: "settings_media", icon: Image, tab: "media" },
    ],
  },
];

// Organization settings navigation items grouped by section
// Order: General/Admin → AI → Security → Developer (consistent mental model)
const orgSettingsSections: NavSection[] = [
  {
    labelKey: "settings_section_general",
    items: [
      {
        id: "general",
        titleKey: "org_settings_workspace",
        icon: Building2,
        tab: "general",
      },
      {
        id: "preferences",
        titleKey: "org_settings_preferences",
        icon: Settings,
        tab: "preferences",
      },
      {
        id: "theme",
        titleKey: "org_settings_theme",
        icon: Palette,
        tab: "theme",
      },
    ],
  },
  {
    labelKey: "settings_section_administration",
    items: [
      {
        id: "people",
        titleKey: "org_settings_members",
        icon: Users,
        tab: "people",
      },
      { id: "teams", titleKey: "org_teams", icon: Users, tab: "teams" },
    ],
  },
  {
    labelKey: "settings_section_ai",
    items: [
      {
        id: "system-prompts",
        titleKey: "org_settings_system_prompts",
        icon: Sparkles,
        tab: "system-prompts",
      },
      {
        id: "templates",
        titleKey: "org_settings_templates",
        icon: FileText,
        tab: "templates",
      },
      {
        id: "llm-models",
        titleKey: "org_settings_llm_models",
        icon: Key,
        tab: "llm-models",
      },
      { id: "memory", titleKey: "settings_memory", icon: Brain, tab: "memory" },
      { id: "mcp", titleKey: "org_settings_mcp", icon: Plug, tab: "mcp" },
      {
        id: "rag",
        titleKey: "org_settings_docs",
        icon: FolderOpen,
        tab: "rag",
      },
    ],
  },
  {
    labelKey: "settings_section_security",
    items: [
      {
        id: "guardrails",
        titleKey: "org_settings_guardrails",
        icon: ShieldCheck,
        tab: "guardrails",
      },
      { id: "audit", titleKey: "audit_title", icon: Activity, tab: "audit" },
    ],
  },
  {
    labelKey: "settings_section_developer",
    items: [
      {
        id: "api-keys",
        titleKey: "org_settings_api_keys",
        icon: Key,
        tab: "api-keys",
      },
    ],
  },
];

// Team settings navigation items grouped by section
// Order: General → Administration → AI → Security → Developer (consistent with org)
const teamSettingsSections: NavSection[] = [
  {
    labelKey: "settings_section_general",
    items: [
      {
        id: "general",
        titleKey: "team_settings_general",
        icon: Building2,
        tab: "general",
      },
      {
        id: "preferences",
        titleKey: "org_settings_preferences",
        icon: Settings,
        tab: "preferences",
      },
      {
        id: "theme",
        titleKey: "org_settings_theme",
        icon: Palette,
        tab: "theme",
      },
    ],
  },
  {
    labelKey: "settings_section_administration",
    items: [
      {
        id: "people",
        titleKey: "org_settings_members",
        icon: Users,
        tab: "people",
      },
    ],
  },
  {
    labelKey: "settings_section_ai",
    items: [
      {
        id: "system-prompts",
        titleKey: "org_settings_system_prompts",
        icon: Sparkles,
        tab: "system-prompts",
      },
      {
        id: "templates",
        titleKey: "org_settings_templates",
        icon: FileText,
        tab: "templates",
      },
      {
        id: "llm-models",
        titleKey: "org_settings_llm_models",
        icon: Key,
        tab: "llm-models",
      },
      { id: "memory", titleKey: "settings_memory", icon: Brain, tab: "memory" },
      { id: "mcp", titleKey: "team_settings_mcp", icon: Plug, tab: "mcp" },
      {
        id: "rag",
        titleKey: "org_settings_docs",
        icon: FolderOpen,
        tab: "rag",
      },
    ],
  },
  {
    labelKey: "settings_section_security",
    items: [
      {
        id: "guardrails",
        titleKey: "org_settings_guardrails",
        icon: ShieldCheck,
        tab: "guardrails",
      },
    ],
  },
  {
    labelKey: "settings_section_developer",
    items: [
      {
        id: "api-keys",
        titleKey: "team_settings_api_keys",
        icon: Key,
        tab: "api-keys",
      },
    ],
  },
];

type SettingsType = "user" | "org" | "team";

interface SettingsContext {
  type: SettingsType;
  teamId?: string;
  /** The active section from path (for org/team) or query param (for user) */
  activeSection?: string;
}

function getSettingsContext(pathname: string): SettingsContext {
  // Match /org/team/:teamId/settings/:section
  const teamMatch = pathname.match(
    /\/org\/team\/([^/]+)\/settings(?:\/([^/]+))?/,
  );
  if (teamMatch) {
    return { type: "team", teamId: teamMatch[1], activeSection: teamMatch[2] };
  }
  // Match /org/settings/:section
  const orgMatch = pathname.match(/\/org\/settings(?:\/([^/]+))?/);
  if (orgMatch) {
    return { type: "org", activeSection: orgMatch[1] };
  }
  // Match /settings/:section (user settings - now path-based)
  const userMatch = pathname.match(/\/settings(?:\/([^/]+))?/);
  if (userMatch) {
    return { type: "user", activeSection: userMatch[1] };
  }
  return { type: "user", activeSection: undefined };
}

function getSettingsSections(type: SettingsType): NavSection[] {
  switch (type) {
    case "user":
      return userSettingsSections;
    case "org":
      return orgSettingsSections;
    case "team":
      return teamSettingsSections;
  }
}

function getDefaultTab(type: SettingsType): string {
  return type === "user" ? "profile" : "general";
}

export function SettingsSidebar({ ...props }: SettingsSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentTeam } = useWorkspaceSafe();

  const context = getSettingsContext(location.pathname);
  const activeTab = context.activeSection || getDefaultTab(context.type);

  const sections = getSettingsSections(context.type);

  const handleBackClick = () => {
    // Get team ID from context (team settings) or workspace (user/org settings)
    const teamId = context.type === "team" ? context.teamId : currentTeam?.id;
    if (teamId) {
      navigate({
        to: "/team/$teamId/chat",
        params: { teamId },
      });
    } else {
      // Fallback to /chat which will redirect to the appropriate team
      navigate({ to: "/chat" });
    }
  };

  const getBackButtonText = () => {
    return t("settings_back_to_app");
  };

  const handleNavClick = (section: string) => {
    if (context.type === "user") {
      // User settings use path-based URLs
      navigate({
        to: "/settings/$section",
        params: { section },
      });
    } else if (context.type === "org") {
      // Org settings use path-based URLs
      navigate({
        to: "/org/settings/$section",
        params: { section },
      });
    } else if (context.type === "team" && context.teamId) {
      // Team settings use path-based URLs
      navigate({
        to: "/org/team/$teamId/settings/$section",
        params: { teamId: context.teamId, section },
      });
    }
  };

  return (
    <Sidebar
      collapsible="none"
      className="border-r"
      {...props}
      {...testId("settings-sidebar")}
    >
      <SidebarHeader className="px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleBackClick}
              className="cursor-pointer"
              {...testId("settings-sidebar-back")}
            >
              <ChevronLeft className="size-4" />
              <span>{getBackButtonText()}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.labelKey}>
            <SidebarGroupLabel className="px-2 h-6">
              <span className="text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
                {t(section.labelKey as never)}
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => handleNavClick(item.tab)}
                        className="cursor-pointer"
                        {...testId(`settings-sidebar-item-${item.tab}`)}
                      >
                        <item.icon className="size-4" />
                        <span>{t(item.titleKey as never)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
