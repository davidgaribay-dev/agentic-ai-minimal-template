/**
 * User navigation menu for the sidebar footer.
 */

import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronUp, LogOut, Settings } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials, isValidImageUrl } from "@/lib/utils";

export function NavUser() {
  const { t } = useTranslation();
  const { state, isMobile } = useSidebar();
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = getInitials(user.full_name, user.email);

  // On mobile, always show expanded state since the drawer is full width
  const isExpanded = isMobile || state === "expanded";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={user.full_name || user.email}
              className={cn(
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                !isExpanded && "!size-8 !p-0 flex items-center justify-center",
              )}
            >
              <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-[10px] font-semibold overflow-hidden">
                {isValidImageUrl(user.profile_image_url) ? (
                  <img
                    src={user.profile_image_url}
                    alt={t("aria_profile_photo", {
                      name: user.full_name || user.email,
                    })}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              {isExpanded && (
                <>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium text-[13px]">
                      {user.full_name || user.email}
                    </span>
                    <span className="truncate text-[11px] text-sidebar-foreground/50">
                      {user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={cn(
              "min-w-56 rounded-lg",
              isMobile
                ? "w-[calc(85vw-1rem)] max-w-[304px]"
                : "w-[--radix-dropdown-menu-trigger-width]",
            )}
            side={isExpanded ? "top" : "right"}
            align={isMobile ? "start" : "end"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-[10px] font-semibold overflow-hidden">
                  {isValidImageUrl(user.profile_image_url) ? (
                    <img
                      src={user.profile_image_url}
                      alt={t("aria_profile_photo", {
                        name: user.full_name || user.email,
                      })}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-[13px]">
                    {user.full_name || user.email}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <Settings className="mr-2 size-4" />
                {t("nav_settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer">
              <LogOut className="mr-2 size-4" />
              {t("nav_log_out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
