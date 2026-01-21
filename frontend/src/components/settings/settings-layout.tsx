/**
 * Reusable layout components for settings pages.
 * Provides consistent styling similar to Linear's settings UI.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface SettingsPageLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Main settings page container with title and optional description.
 */
export function SettingsPageLayout({
  title,
  description,
  children,
}: SettingsPageLayoutProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

interface SettingsSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A section within settings page, with optional title and description.
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div>
          {title && <h2 className="text-base font-medium">{title}</h2>}
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Card container for settings items with consistent border and padding.
 */
export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>{children}</div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A single row within a settings card.
 * Label and description on the left, control on the right.
 */
export function SettingsRow({
  label,
  description,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn("flex items-center justify-between px-4 py-3", className)}
    >
      <div className="space-y-0.5 pr-4">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface SettingsDividerProps {
  className?: string;
}

/**
 * Horizontal divider between settings rows.
 */
export function SettingsDivider({ className }: SettingsDividerProps) {
  return <div className={cn("border-t", className)} />;
}
