import { useState, useEffect, useRef } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Trash2,
  Check,
  X,
  MessageSquare,
  Sparkles,
  Camera,
  Brain,
  Plug,
  Key,
} from "lucide-react";
import { useAuth, authKeys } from "@/lib/auth";
import {
  authApi,
  promptsApi,
  ApiError,
  type OrganizationChatSettings,
  type TeamChatSettings,
  type UserChatSettings,
} from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import {
  useOrgChatSettings,
  useTeamChatSettings,
  useUserChatSettings,
  useUpdateUserChatSettings,
} from "@/lib/queries";
import { ChatSettings } from "@/components/chat-settings";
import { MemorySettings } from "@/components/settings/memory-settings";
import { MemoryViewer } from "@/components/settings/memory-viewer";
import { UserThemeSettings } from "@/components/settings/user-theme-settings";
import { UserRAGSettings } from "@/components/settings/user-rag-settings";
import { UserLLMSettings } from "@/components/settings/user-llm-settings";
import {
  PromptRow,
  CreatePromptDialog,
  MCPSettings,
  MCPServersList,
  MediaLibrary,
  GuardrailSettings,
  SettingsPageLayout,
  SettingsCard,
} from "@/components/settings";
import { LanguageSettings } from "@/components/settings/language-settings";
import { guardrailsApi, type UserGuardrailsUpdate } from "@/lib/api";
import { getInitials, isValidImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { testId } from "@/lib/test-id";

/** Valid user settings sections */
const VALID_SECTIONS = [
  "profile",
  "system-prompts",
  "templates",
  "llm-models",
  "memory",
  "preferences",
  "theme",
  "rag",
  "media",
  "guardrails",
  "language",
  "mcp",
  "api-keys",
] as const;

type UserSettingsSection = (typeof VALID_SECTIONS)[number];

export const Route = createFileRoute("/settings/$section")({
  beforeLoad: ({ context, params }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
    // Validate section parameter
    if (!VALID_SECTIONS.includes(params.section as UserSettingsSection)) {
      throw redirect({
        to: "/settings/$section",
        params: { section: "profile" },
      });
    }
  },
  component: UserSettingsPage,
});

function UserSettingsPage() {
  const { t } = useTranslation();
  const { section } = Route.useParams();

  // Render the content based on the current section
  const renderContent = () => {
    switch (section) {
      case "profile":
        return <ProfileSection />;
      case "system-prompts":
        return <SystemPromptsSection />;
      case "templates":
        return <TemplatesSection />;
      case "memory":
        return <MemorySection />;
      case "preferences":
        return <PreferencesSection />;
      case "theme":
        return (
          <SettingsPageLayout title={t("settings_theme")}>
            <UserThemeSettings />
          </SettingsPageLayout>
        );
      case "rag":
        return (
          <SettingsPageLayout title={t("settings_docs")}>
            <UserRAGSettings />
          </SettingsPageLayout>
        );
      case "llm-models":
        return <UserLLMSettingsSection />;
      case "media":
        return <MediaSection />;
      case "guardrails":
        return <UserGuardrailsSection />;
      case "language":
        return <LanguageSettings />;
      case "mcp":
        return <UserMCPSectionStandalone />;
      case "api-keys":
        return <UserApiKeysSection />;
      default:
        return <ProfileSection />;
    }
  };

  return (
    <div
      {...testId(`page-settings-${section}`)}
      className="bg-background min-h-screen"
    >
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-4 md:py-8">
        {renderContent()}
      </div>
    </div>
  );
}

function ProfileSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEditName(user.full_name || "");
      setEditEmail(user.email || "");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(authKeys.user, updatedUser);
      setProfileError(null);
      setIsEditingName(false);
      setIsEditingEmail(false);
    },
    onError: (err: ApiError) => {
      const detail = (err.body as { detail?: string })?.detail;
      setProfileError(detail || t("profile_failed_update"));
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: authApi.uploadProfileImage,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(authKeys.user, updatedUser);
      setProfileError(null);
    },
    onError: (err: ApiError) => {
      const detail = (err.body as { detail?: string })?.detail;
      setProfileError(detail || t("profile_failed_upload"));
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: authApi.deleteProfileImage,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(authKeys.user, updatedUser);
      setProfileError(null);
    },
    onError: (err: ApiError) => {
      const detail = (err.body as { detail?: string })?.detail;
      setProfileError(detail || t("profile_failed_delete"));
    },
  });

  const handleSaveName = () => {
    setProfileError(null);
    updateProfileMutation.mutate({ full_name: editName || null });
  };

  const handleCancelName = () => {
    setEditName(user?.full_name || "");
    setIsEditingName(false);
    setProfileError(null);
  };

  const handleSaveEmail = () => {
    if (!editEmail.trim()) {
      setProfileError(t("profile_email_required"));
      return;
    }
    setProfileError(null);
    updateProfileMutation.mutate({ email: editEmail });
  };

  const handleCancelEmail = () => {
    setEditEmail(user?.email || "");
    setIsEditingEmail(false);
    setProfileError(null);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setProfileError(t("settings_image_too_large"));
        return;
      }
      if (!file.type.startsWith("image/")) {
        setProfileError(t("settings_select_image"));
        return;
      }
      uploadImageMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = () => {
    deleteImageMutation.mutate();
  };

  const isImageLoading =
    uploadImageMutation.isPending || deleteImageMutation.isPending;

  return (
    <SettingsPageLayout title={t("settings_profile")}>
      {profileError && (
        <p
          {...testId("settings-profile-error")}
          className="text-sm text-destructive mb-4"
        >
          {profileError}
        </p>
      )}

      <SettingsCard>
        <div className="divide-y">
          {/* Profile picture row */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">{t("profile_picture")}</div>
              <div className="text-xs text-muted-foreground">
                {t("profile_picture_desc")}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isImageLoading}
                  className="relative group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                >
                  {user?.profile_image_url &&
                  isValidImageUrl(user.profile_image_url) ? (
                    <img
                      src={user.profile_image_url}
                      alt={user.full_name || t("profile_photo_alt")}
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary">
                      <span className="text-sm font-medium text-primary-foreground">
                        {user ? getInitials(user.full_name, user.email) : "?"}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isImageLoading ? (
                      <Loader2 className="size-4 text-white animate-spin" />
                    ) : (
                      <Camera className="size-4 text-white" />
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleImageClick}>
                  <Camera className="mr-2 size-4" />
                  {user?.profile_image_url
                    ? t("profile_change_photo")
                    : t("profile_upload_photo")}
                </DropdownMenuItem>
                {user?.profile_image_url && (
                  <DropdownMenuItem
                    onClick={handleDeleteImage}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    {t("profile_remove_photo")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Email row */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">{t("com_email")}</div>
              <div className="text-xs text-muted-foreground">
                {t("profile_email_desc")}
              </div>
            </div>
            {isEditingEmail ? (
              <div className="flex items-center gap-2">
                <Input
                  {...testId("settings-profile-email-input")}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder={t("settings_enter_email")}
                  className="h-8 w-56 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEmail();
                    if (e.key === "Escape") handleCancelEmail();
                  }}
                />
                <Button
                  {...testId("settings-profile-email-save")}
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={handleSaveEmail}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5 text-green-600" />
                  )}
                </Button>
                <Button
                  {...testId("settings-profile-email-cancel")}
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={handleCancelEmail}
                  disabled={updateProfileMutation.isPending}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <button
                {...testId("settings-profile-email-edit")}
                onClick={() => setIsEditingEmail(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {user?.email}
              </button>
            )}
          </div>

          {/* Full name row */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">
                {t("profile_full_name")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("profile_full_name_desc")}
              </div>
            </div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  {...testId("settings-profile-name-input")}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("settings_enter_name")}
                  className="h-8 w-56 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") handleCancelName();
                  }}
                />
                <Button
                  {...testId("settings-profile-name-save")}
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={handleSaveName}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5 text-green-600" />
                  )}
                </Button>
                <Button
                  {...testId("settings-profile-name-cancel")}
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={handleCancelName}
                  disabled={updateProfileMutation.isPending}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <button
                {...testId("settings-profile-name-edit")}
                onClick={() => setIsEditingName(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {user?.full_name || t("settings_no_name")}
              </button>
            )}
          </div>
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function SystemPromptsSection() {
  const { t } = useTranslation();
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["user-prompts"],
    queryFn: () => promptsApi.listUserPrompts(),
  });

  const prompts = promptsData?.data ?? [];
  const systemPrompts = prompts.filter((p) => p.prompt_type === "system");

  return (
    <SettingsPageLayout title={t("prompts_system")}>
      <p className="text-sm text-muted-foreground mb-4">
        {t("prompts_system_desc")}
      </p>
      <SettingsCard>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <span className="text-sm font-medium">{t("prompts_system")}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {systemPrompts.length}
              </Badge>
            </div>
            <CreatePromptDialog scope={{ type: "user" }} defaultType="system" />
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : systemPrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("prompts_no_system")}
              </p>
            ) : (
              systemPrompts.map((prompt) => (
                <PromptRow
                  key={prompt.id}
                  prompt={prompt}
                  scope={{ type: "user" }}
                />
              ))
            )}
          </div>
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function TemplatesSection() {
  const { t } = useTranslation();
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["user-prompts"],
    queryFn: () => promptsApi.listUserPrompts(),
  });

  const prompts = promptsData?.data ?? [];
  const templatePrompts = prompts.filter((p) => p.prompt_type === "template");

  return (
    <SettingsPageLayout title={t("prompts_templates")}>
      <p className="text-sm text-muted-foreground mb-4">
        {t("prompts_templates_desc")}
      </p>
      <SettingsCard>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4" />
              <span className="text-sm font-medium">
                {t("prompts_templates")}
              </span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {templatePrompts.length}
              </Badge>
            </div>
            <CreatePromptDialog
              scope={{ type: "user" }}
              defaultType="template"
            />
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : templatePrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("prompts_no_templates")}
              </p>
            ) : (
              templatePrompts.map((prompt) => (
                <PromptRow
                  key={prompt.id}
                  prompt={prompt}
                  scope={{ type: "user" }}
                />
              ))
            )}
          </div>
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function PreferencesSection() {
  const { t } = useTranslation();
  const { currentOrg, currentTeam } = useWorkspace();
  const { data: orgSettings, isLoading: isLoadingOrg } = useOrgChatSettings(
    currentOrg?.id,
  );
  const { data: teamSettings, isLoading: isLoadingTeam } = useTeamChatSettings(
    currentOrg?.id,
    currentTeam?.id,
  );
  const { data: userSettings, isLoading: isLoadingUser } =
    useUserChatSettings();
  const updateMutation = useUpdateUserChatSettings();

  const handleChatEnabledChange = (enabled: boolean) => {
    updateMutation.mutate({ chat_enabled: enabled });
  };

  const handleChatPanelEnabledChange = (enabled: boolean) => {
    updateMutation.mutate({ chat_panel_enabled: enabled });
  };

  const chatDisabledByOrg = orgSettings ? !orgSettings.chat_enabled : false;
  const chatDisabledByTeam = teamSettings ? !teamSettings.chat_enabled : false;
  const chatPanelDisabledByOrg = orgSettings
    ? !orgSettings.chat_panel_enabled
    : false;
  const chatPanelDisabledByTeam = teamSettings
    ? !teamSettings.chat_panel_enabled
    : false;

  return (
    <SettingsPageLayout title={t("settings_preferences")}>
      <SettingsCard>
        <div className="p-4 space-y-6">
          <div>
            <div className="flex items-center gap-2 py-2">
              <MessageSquare className="size-4" />
              <span className="text-sm font-medium">{t("chat_features")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("memory_settings_desc")}
            </p>
            <ChatSettings
              settings={
                userSettings ?? {
                  chat_enabled: true,
                  chat_panel_enabled: true,
                  memory_enabled: true,
                  mcp_enabled: true,
                  disabled_mcp_servers: [],
                  disabled_tools: [],
                }
              }
              onChatEnabledChange={handleChatEnabledChange}
              onChatPanelEnabledChange={handleChatPanelEnabledChange}
              chatDisabledByOrg={chatDisabledByOrg}
              chatDisabledByTeam={chatDisabledByTeam}
              chatPanelDisabledByOrg={chatPanelDisabledByOrg}
              chatPanelDisabledByTeam={chatPanelDisabledByTeam}
              isLoading={
                isLoadingOrg ||
                isLoadingTeam ||
                isLoadingUser ||
                updateMutation.isPending
              }
              level="user"
            />
          </div>

          <div className="border-t pt-4">
            <UserMCPSection
              orgId={currentOrg?.id}
              teamId={currentTeam?.id}
              orgSettings={orgSettings}
              teamSettings={teamSettings}
              userSettings={userSettings}
              updateMutation={updateMutation}
              isLoading={isLoadingOrg || isLoadingTeam || isLoadingUser}
            />
          </div>
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function UserMCPSection({
  orgId,
  teamId,
  orgSettings,
  teamSettings,
  userSettings,
  updateMutation,
  isLoading,
}: {
  orgId: string | undefined;
  teamId: string | undefined;
  orgSettings: OrganizationChatSettings | undefined;
  teamSettings: TeamChatSettings | undefined;
  userSettings: UserChatSettings | undefined;
  updateMutation: ReturnType<typeof useUpdateUserChatSettings>;
  isLoading: boolean;
}) {
  const mcpDisabledByOrg = orgSettings ? !orgSettings.mcp_enabled : false;
  const mcpDisabledByTeam = teamSettings ? !teamSettings.mcp_enabled : false;
  const customServersDisabledByOrg = orgSettings
    ? !orgSettings.mcp_allow_custom_servers
    : false;
  const customServersDisabledByTeam = teamSettings
    ? !teamSettings.mcp_allow_custom_servers
    : false;

  const canAddServers =
    orgId &&
    teamId &&
    !mcpDisabledByOrg &&
    !mcpDisabledByTeam &&
    !customServersDisabledByOrg &&
    !customServersDisabledByTeam;

  // Determine who disabled MCP
  const mcpDisabledBy = mcpDisabledByOrg
    ? "org"
    : mcpDisabledByTeam
      ? "team"
      : null;

  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 py-2">
        <Plug className="size-4" />
        <span className="text-sm font-medium">{t("mcp_integration")}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t("mcp_add_own")}</p>

      <MCPSettings
        mcpEnabled={userSettings?.mcp_enabled ?? true}
        onMCPEnabledChange={(enabled) =>
          updateMutation.mutate({ mcp_enabled: enabled })
        }
        disabledBy={mcpDisabledBy}
        isLoading={isLoading || updateMutation.isPending}
        level="user"
      />

      {canAddServers && (
        <div className="mt-4">
          <MCPServersList scope={{ type: "user", orgId, teamId }} />
        </div>
      )}
    </div>
  );
}

function MemorySection() {
  const { t } = useTranslation();
  const { currentOrg, currentTeam } = useWorkspace();
  const { data: orgSettings, isLoading: isLoadingOrg } = useOrgChatSettings(
    currentOrg?.id,
  );
  const { data: teamSettings, isLoading: isLoadingTeam } = useTeamChatSettings(
    currentOrg?.id,
    currentTeam?.id,
  );
  const { data: userSettings, isLoading: isLoadingUser } =
    useUserChatSettings();
  const updateMutation = useUpdateUserChatSettings();

  const handleMemoryEnabledChange = (enabled: boolean) => {
    updateMutation.mutate({ memory_enabled: enabled });
  };

  const memoryEnabled = userSettings?.memory_enabled ?? true;
  const memoryDisabledByOrg = orgSettings ? !orgSettings.memory_enabled : false;
  const memoryDisabledByTeam = teamSettings
    ? !teamSettings.memory_enabled
    : false;

  return (
    <SettingsPageLayout title={t("settings_memory")}>
      <SettingsCard>
        <div className="p-4 space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("memory_settings_desc")}
            </p>
            <MemorySettings
              memoryEnabled={memoryEnabled}
              onMemoryEnabledChange={handleMemoryEnabledChange}
              memoryDisabledByOrg={memoryDisabledByOrg}
              memoryDisabledByTeam={memoryDisabledByTeam}
              isLoading={
                isLoadingOrg ||
                isLoadingTeam ||
                isLoadingUser ||
                updateMutation.isPending
              }
              level="user"
            />
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="size-4" />
              <span className="text-sm font-medium">
                {t("memory_your_memories")}
              </span>
            </div>
            <MemoryViewer />
          </div>
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function MediaSection() {
  const { t } = useTranslation();
  const { currentOrg, currentTeam } = useWorkspace();

  if (!currentOrg?.id) {
    return (
      <SettingsPageLayout title={t("settings_media")}>
        <SettingsCard>
          <div className="p-4 text-sm text-muted-foreground py-8 text-center">
            {t("media_select_org")}
          </div>
        </SettingsCard>
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout title={t("settings_media")}>
      <SettingsCard>
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            {t("media_desc")}
          </p>
          <MediaLibrary
            organizationId={currentOrg.id}
            teamId={currentTeam?.id}
          />
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function UserGuardrailsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: guardrails, isLoading } = useQuery({
    queryKey: ["user-guardrails"],
    queryFn: () => guardrailsApi.getUserGuardrails(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UserGuardrailsUpdate) =>
      guardrailsApi.updateUserGuardrails(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-guardrails"] });
    },
  });

  if (isLoading) {
    return (
      <SettingsPageLayout title={t("settings_guardrails")}>
        <SettingsCard>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </SettingsCard>
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout title={t("settings_guardrails")}>
      <p className="text-sm text-muted-foreground mb-4">
        {t("guardrails_content_desc")}
      </p>
      <GuardrailSettings
        level="user"
        guardrailsEnabled={guardrails?.guardrails_enabled ?? true}
        inputBlockedKeywords={guardrails?.input_blocked_keywords ?? []}
        inputBlockedPatterns={guardrails?.input_blocked_patterns ?? []}
        inputAction={guardrails?.input_action ?? "block"}
        outputBlockedKeywords={guardrails?.output_blocked_keywords ?? []}
        outputBlockedPatterns={guardrails?.output_blocked_patterns ?? []}
        outputAction={guardrails?.output_action ?? "redact"}
        piiDetectionEnabled={guardrails?.pii_detection_enabled ?? false}
        piiTypes={guardrails?.pii_types ?? []}
        piiAction={guardrails?.pii_action ?? "redact"}
        isLoading={updateMutation.isPending}
        onUpdate={(data) => updateMutation.mutate(data)}
      />
    </SettingsPageLayout>
  );
}

function UserMCPSectionStandalone() {
  const { t } = useTranslation();
  const { currentOrg, currentTeam } = useWorkspace();
  const { data: orgSettings, isLoading: isLoadingOrg } = useOrgChatSettings(
    currentOrg?.id,
  );
  const { data: teamSettings, isLoading: isLoadingTeam } = useTeamChatSettings(
    currentOrg?.id,
    currentTeam?.id,
  );
  const { data: userSettings, isLoading: isLoadingUser } =
    useUserChatSettings();
  const updateMutation = useUpdateUserChatSettings();

  const mcpDisabledByOrg = orgSettings ? !orgSettings.mcp_enabled : false;
  const mcpDisabledByTeam = teamSettings ? !teamSettings.mcp_enabled : false;
  const customServersDisabledByOrg = orgSettings
    ? !orgSettings.mcp_allow_custom_servers
    : false;
  const customServersDisabledByTeam = teamSettings
    ? !teamSettings.mcp_allow_custom_servers
    : false;

  const canAddServers =
    currentOrg?.id &&
    currentTeam?.id &&
    !mcpDisabledByOrg &&
    !mcpDisabledByTeam &&
    !customServersDisabledByOrg &&
    !customServersDisabledByTeam;

  const mcpDisabledBy = mcpDisabledByOrg
    ? "org"
    : mcpDisabledByTeam
      ? "team"
      : null;

  const isLoading = isLoadingOrg || isLoadingTeam || isLoadingUser;

  return (
    <SettingsPageLayout title={t("settings_mcp" as never)}>
      <p className="text-sm text-muted-foreground mb-4">
        {t("mcp_add_own" as never)}
      </p>
      <SettingsCard>
        <div className="p-4 space-y-4">
          <MCPSettings
            mcpEnabled={userSettings?.mcp_enabled ?? true}
            onMCPEnabledChange={(enabled) =>
              updateMutation.mutate({ mcp_enabled: enabled })
            }
            disabledBy={mcpDisabledBy}
            isLoading={isLoading || updateMutation.isPending}
            level="user"
          />

          {canAddServers && (
            <div className="mt-4">
              <MCPServersList
                scope={{
                  type: "user",
                  orgId: currentOrg.id,
                  teamId: currentTeam.id,
                }}
              />
            </div>
          )}
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function UserApiKeysSection() {
  const { t } = useTranslation();

  return (
    <SettingsPageLayout title={t("settings_api_keys" as never)}>
      <p className="text-sm text-muted-foreground mb-4">
        {t("developer_api_keys_description" as never)}
      </p>
      <SettingsCard>
        <div className="p-4 space-y-4">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Key className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium mb-1">
              {t("developer_api_keys_coming_soon" as never)}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t("developer_api_keys_coming_soon_desc" as never)}
            </p>
          </div>
        </div>
      </SettingsCard>
    </SettingsPageLayout>
  );
}

function UserLLMSettingsSection() {
  const { t } = useTranslation();
  const { currentOrg, currentTeam } = useWorkspace();

  if (!currentOrg?.id) {
    return (
      <SettingsPageLayout title={t("llm_settings")}>
        <SettingsCard>
          <div className="p-4 text-sm text-muted-foreground py-8 text-center">
            {t("settings_select_org_first")}
          </div>
        </SettingsCard>
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout title={t("llm_settings")}>
      <UserLLMSettings orgId={currentOrg.id} teamId={currentTeam?.id} />
    </SettingsPageLayout>
  );
}
