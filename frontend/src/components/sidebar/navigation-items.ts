/**
 * Navigation items configuration for the sidebar.
 */

import { Settings, MessageSquare } from "lucide-react";

export const chatNavItem = {
  titleKey: "nav_chats" as const,
  url: "/search",
  icon: MessageSquare,
};

/** Admin-only navigation item for organization settings */
export const orgSettingsNavItem = {
  id: "org_settings",
  titleKey: "nav_org_settings" as const,
  url: "/org/settings",
  icon: Settings,
};
