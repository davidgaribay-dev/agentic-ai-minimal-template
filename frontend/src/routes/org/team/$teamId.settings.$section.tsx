import { useState, useEffect, useMemo } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Loader2,
  Shield,
  User,
  Eye,
  UserMinus,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Plug,
  AlertTriangle,
  Key,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace, useOrganizationMembers } from "@/lib/workspace";
import {
  teamsApi,
  promptsApi,
  type TeamRole,
  type TeamMember,
  type OrganizationChatSettings,
  type TeamChatSettings,
  ApiError,
} from "@/lib/api";
import {
  useOrgChatSettings,
  useTeamChatSettings,
  useUpdateTeamChatSettings,
} from "@/lib/queries";
import { ChatSettings } from "@/components/chat-settings";
import { MemorySettings } from "@/components/settings/memory-settings";
import {
  PromptRow,
  CreatePromptDialog,
  TeamDangerZone,
  TeamDetailsSection,
  MCPSettings,
  MCPServersList,
  GuardrailSettings,
  SettingsPageLayout,
  SettingsCard,
} from "@/components/settings";
import { guardrailsApi, type TeamGuardrailsUpdate } from "@/lib/api";
import { TeamThemeSettings } from "@/components/settings/team-theme-settings";
import { TeamRAGSettings } from "@/components/settings/team-rag-settings";
import { TeamLLMSettings } from "@/components/settings/team-llm-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { isValidImageUrl, getInitials } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { testId } from "@/lib/test-id";

const VALID_SECTIONS = [
  "general",
  "people",
  "system-prompts",
  "templates",
  "llm-models",
  "memory",
  "preferences",
  "theme",
  "rag",
  "guardrails",
  "mcp",
  "api-keys",
] as const;

type TeamSettingsSection = (typeof VALID_SECTIONS)[number];

export const Route = createFileRoute("/org/team/$teamId/settings/$section")({
  beforeLoad: ({ context, params }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
    // Validate section parameter
    if (!VALID_SECTIONS.includes(params.section as TeamSettingsSection)) {
      throw redirect({
        to: "/org/team/$teamId/settings/$section",
        params: { teamId: params.teamId, section: "general" },
      });
    }
  },
  component: TeamSettingsPage,
});

function TeamSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { teamId, section } = Route.useParams();

  const currentSection = section as TeamSettingsSection;

  const { currentOrg, currentOrgRole, teams, switchTeam, refresh } =
    useWorkspace();

  const team = teams.find((t) => t.id === teamId);

  useEffect(() => {
    if (currentOrg && teams.length > 0 && !team) {
      navigate({
        to: "/org/settings/$section",
        params: { section: "general" },
      });
    }
  }, [currentOrg, teams, team, navigate]);

  useEffect(() => {
    if (team) {
      switchTeam(team.id);
    }
  }, [team, switchTeam]);

  const { data: teamMembersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["team-members", currentOrg?.id, teamId],
    queryFn: () => teamsApi.getMembers(currentOrg!.id, teamId),
    enabled: !!currentOrg && !!teamId,
  });
  const teamMembers = teamMembersData?.data ?? [];

  const { user } = useAuth();
  const currentUserMember = teamMembers.find((m) => m.user_id === user?.id);
  const currentTeamRole = currentUserMember?.role;

  const isOrgAdmin = currentOrgRole === "owner" || currentOrgRole === "admin";
  const isTeamAdmin = currentTeamRole === "admin";
  const canManageTeam = isOrgAdmin || isTeamAdmin;

  if (!currentOrg || !team) {
    return (
      <div className="bg-background min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Render the content based on the current section
  const renderContent = () => {
    switch (currentSection) {
      case "general":
        return (
          <SettingsPageLayout title={t("team_settings_general" as never)}>
            {canManageTeam && (
              <SettingsCard>
                <div
                  {...testId("team-settings-section-general")}
                  className="p-4"
                >
                  <TeamDetailsSection
                    orgId={currentOrg.id}
                    team={team}
                    onUpdate={refresh}
                  />
                </div>
              </SettingsCard>
            )}
            <TeamDangerZone
              orgId={currentOrg.id}
              teamId={team.id}
              teamName={team.name}
              canDelete={canManageTeam}
              memberCount={teamMembers.length}
              onLeave={() => {
                switchTeam(null);
                navigate({ to: "/" });
              }}
              onDelete={() => {
                switchTeam(null);
                navigate({
                  to: "/org/settings/$section",
                  params: { section: "general" },
                });
              }}
            />
          </SettingsPageLayout>
        );
      case "people":
        return (
          <SettingsPageLayout title={t("org_settings_people" as never)}>
            <div {...testId("team-settings-section-people")}>
              <MembersSection
                orgId={currentOrg.id}
                teamId={team.id}
                members={teamMembers}
                isLoading={isLoadingMembers}
                canManage={canManageTeam}
                isOrgAdmin={isOrgAdmin}
                currentUserId={user?.id}
                onUpdate={refresh}
              />
            </div>
          </SettingsPageLayout>
        );
      case "system-prompts":
        return canManageTeam ? (
          <SettingsPageLayout title={t("org_settings_system_prompts" as never)}>
            <p className="text-sm text-muted-foreground mb-4">
              {t("prompts_system_desc" as never)}
            </p>
            <TeamSystemPromptsSection orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "templates":
        return canManageTeam ? (
          <SettingsPageLayout title={t("org_settings_templates" as never)}>
            <p className="text-sm text-muted-foreground mb-4">
              {t("prompts_templates_desc" as never)}
            </p>
            <TeamTemplatesSection orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "llm-models":
        return canManageTeam ? (
          <SettingsPageLayout title={t("llm_settings")}>
            <TeamLLMSettings orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "memory":
        return canManageTeam ? (
          <SettingsPageLayout title={t("settings_memory" as never)}>
            <p className="text-sm text-muted-foreground mb-4">
              {t("team_memory_disable_desc" as never)}
            </p>
            <TeamMemorySection orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "preferences":
        return canManageTeam ? (
          <SettingsPageLayout title={t("org_settings_preferences" as never)}>
            <ChatFeaturesSection orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "theme":
        return canManageTeam ? (
          <SettingsPageLayout title={t("org_settings_theme" as never)}>
            <TeamThemeSettings orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "rag":
        return canManageTeam ? (
          <SettingsPageLayout title={t("org_settings_docs" as never)}>
            <TeamRAGSettings orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "guardrails":
        return canManageTeam ? (
          <SettingsPageLayout title={t("org_settings_guardrails" as never)}>
            <TeamGuardrailsSection orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "mcp":
        return canManageTeam ? (
          <SettingsPageLayout title={t("team_settings_mcp" as never)}>
            <p className="text-sm text-muted-foreground mb-4">
              {t("team_mcp_configure_desc" as never)}
            </p>
            <TeamMCPSectionStandalone orgId={currentOrg.id} teamId={team.id} />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      case "api-keys":
        return canManageTeam ? (
          <SettingsPageLayout title={t("team_settings_api_keys" as never)}>
            <TeamDeveloperApiKeysSection />
          </SettingsPageLayout>
        ) : (
          <AccessDeniedSection />
        );
      default:
        return (
          <SettingsPageLayout title={t("team_settings_general" as never)}>
            {canManageTeam && (
              <SettingsCard>
                <div className="p-4">
                  <TeamDetailsSection
                    orgId={currentOrg.id}
                    team={team}
                    onUpdate={refresh}
                  />
                </div>
              </SettingsCard>
            )}
            <TeamDangerZone
              orgId={currentOrg.id}
              teamId={team.id}
              teamName={team.name}
              canDelete={canManageTeam}
              memberCount={teamMembers.length}
              onLeave={() => {
                switchTeam(null);
                navigate({ to: "/" });
              }}
              onDelete={() => {
                switchTeam(null);
                navigate({
                  to: "/org/settings/$section",
                  params: { section: "general" },
                });
              }}
            />
          </SettingsPageLayout>
        );
    }
  };

  return (
    <div
      {...testId("team-settings-page")}
      className="bg-background min-h-screen"
    >
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-4 md:py-8">
        {renderContent()}
      </div>
    </div>
  );
}

type TeamMemberRow = {
  id: string;
  user_id: string;
  role: TeamRole;
  org_role: string;
  user_email: string;
  user_full_name: string | null;
  user_profile_image_url: string | null;
};

interface MembersSectionProps {
  orgId: string;
  teamId: string;
  members: TeamMember[];
  isLoading: boolean;
  canManage: boolean;
  isOrgAdmin: boolean;
  currentUserId?: string;
  onUpdate: () => void;
}

function MembersSection({
  orgId,
  teamId,
  members,
  isLoading,
  canManage,
  isOrgAdmin,
  currentUserId,
  onUpdate,
}: MembersSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TeamRole>("member");
  const [error, setError] = useState<string | null>(null);

  const { data: orgMembersData } = useOrganizationMembers(orgId);
  const orgMembers = orgMembersData?.data ?? [];

  const teamUserIds = new Set(members.map((m) => m.user_id));
  const availableOrgMembers = orgMembers.filter(
    (m) => !teamUserIds.has(m.user_id),
  );

  const addMemberMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      teamsApi.addMember(orgId, teamId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["team-members", orgId, teamId],
      });
      onUpdate();
      resetAddDialog();
    },
    onError: (err: ApiError) => {
      const detail = (err.body as { detail?: string })?.detail;
      setError(detail || t("team_failed_add_member"));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: TeamRole }) =>
      teamsApi.updateMemberRole(orgId, teamId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["team-members", orgId, teamId],
      });
      onUpdate();
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      teamsApi.removeMember(orgId, teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["team-members", orgId, teamId],
      });
      onUpdate();
    },
  });

  const [passwordResetSuccess, setPasswordResetSuccess] = useState<
    string | null
  >(null);

  const sendPasswordResetMutation = useMutation({
    mutationFn: (memberId: string) =>
      teamsApi.sendMemberPasswordReset(orgId, teamId, memberId),
    onSuccess: (_, memberId) => {
      const member = members.find((m) => m.id === memberId);
      setPasswordResetSuccess(member?.user_email || null);
      setTimeout(() => setPasswordResetSuccess(null), 5000);
    },
  });

  const handleAddMember = () => {
    if (!selectedUserId) return;
    setError(null);
    addMemberMutation.mutate({ userId: selectedUserId, role: selectedRole });
  };

  const resetAddDialog = () => {
    setSelectedUserId("");
    setSelectedRole("member");
    setError(null);
    setAddMemberOpen(false);
  };

  const getRoleBadge = (role: TeamRole) => {
    switch (role) {
      case "admin":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-0 text-xs h-5"
          >
            <Shield className="mr-1 size-2.5" />
            {t("org_role_admin")}
          </Badge>
        );
      case "member":
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground text-xs h-5"
          >
            <User className="mr-1 size-2.5" />
            {t("org_role_member")}
          </Badge>
        );
      case "viewer":
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground text-xs h-5"
          >
            <Eye className="mr-1 size-2.5" />
            {t("team_role_viewer")}
          </Badge>
        );
    }
  };

  const memberColumns: ColumnDef<TeamMemberRow>[] = useMemo(
    () => [
      {
        accessorKey: "user_full_name",
        header: t("org_role_member"),
        cell: ({ row }) => {
          const member = row.original;
          const isCurrentUser = member.user_id === currentUserId;
          return (
            <div className="flex items-center gap-2.5">
              {isValidImageUrl(member.user_profile_image_url) ? (
                <img
                  src={member.user_profile_image_url}
                  alt={member.user_full_name || member.user_email}
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary">
                  <span className="text-xs font-medium text-primary-foreground">
                    {getInitials(member.user_full_name, member.user_email)}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-1">
                  {member.user_full_name || member.user_email}
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground">
                      ({t("com_you")})
                    </span>
                  )}
                </div>
                {member.user_full_name && (
                  <div className="text-xs text-muted-foreground truncate">
                    {member.user_email}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: t("com_role"),
        cell: ({ row }) => getRoleBadge(row.original.role),
      },
      {
        id: "actions",
        header: () => <div className="text-right">{t("com_actions")}</div>,
        cell: ({ row }) => {
          const member = row.original;
          const isCurrentUser = member.user_id === currentUserId;
          const canManageMember = canManage && !isCurrentUser;
          const canChangeRole =
            canManageMember && (isOrgAdmin || member.role !== "admin");

          if (!canManageMember) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    {...testId(`team-member-actions-${member.id}`)}
                    variant="ghost"
                    size="icon"
                    className="size-7"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {canChangeRole && (
                    <>
                      <DropdownMenuItem
                        onClick={() =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: "admin",
                          })
                        }
                        disabled={member.role === "admin"}
                      >
                        <Shield className="mr-2 size-3.5" />
                        {t("org_role_admin")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: "member",
                          })
                        }
                        disabled={member.role === "member"}
                      >
                        <User className="mr-2 size-3.5" />
                        {t("org_role_member")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: "viewer",
                          })
                        }
                        disabled={member.role === "viewer"}
                      >
                        <Eye className="mr-2 size-3.5" />
                        {t("team_role_viewer")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        disabled={sendPasswordResetMutation.isPending}
                      >
                        {sendPasswordResetMutation.isPending ? (
                          <Loader2 className="mr-2 size-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="mr-2 size-3.5" />
                        )}
                        {t("org_send_password_reset")}
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("org_send_password_reset_title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("org_send_password_reset_confirm", {
                            email: member.user_email,
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("com_cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            sendPasswordResetMutation.mutate(member.id)
                          }
                        >
                          {t("org_send_password_reset")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-destructive focus:text-destructive"
                      >
                        <UserMinus className="mr-2 size-3.5" />
                        {t("com_remove")}
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("team_remove_member_title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("team_remove_member_confirm", {
                            name: member.user_full_name || member.user_email,
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("com_cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMemberMutation.mutate(member.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t("com_remove")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      currentUserId,
      canManage,
      isOrgAdmin,
      updateRoleMutation,
      removeMemberMutation,
      sendPasswordResetMutation,
      t,
      getRoleBadge,
    ],
  );

  const memberData: TeamMemberRow[] = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        org_role: m.org_role,
        user_email: m.user_email,
        user_full_name: m.user_full_name,
        user_profile_image_url: m.user_profile_image_url,
      })),
    [members],
  );

  return (
    <SettingsCard {...testId("team-members-section")}>
      <div className="p-4 space-y-4">
        {passwordResetSuccess && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            {t("org_password_reset_sent_success", {
              email: passwordResetSuccess,
            })}
          </div>
        )}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" />
            {t("org_members")}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {members.length}
            </Badge>
          </div>
          {canManage && availableOrgMembers.length > 0 && (
            <Dialog
              open={addMemberOpen}
              onOpenChange={(open) =>
                open ? setAddMemberOpen(true) : resetAddDialog()
              }
            >
              <DialogTrigger asChild>
                <Button
                  {...testId("add-team-member-trigger")}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                >
                  <Plus className="size-3 mr-1" />
                  {t("team_add_member")}
                </Button>
              </DialogTrigger>
              <DialogContent
                {...testId("add-team-member-dialog")}
                className="sm:max-w-md"
              >
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {t("team_add_member")}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {t("team_add_member_desc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("org_role_member")}</Label>
                    <Select
                      value={selectedUserId}
                      onValueChange={setSelectedUserId}
                    >
                      <SelectTrigger
                        {...testId("member-select-trigger")}
                        className="h-8 text-sm"
                      >
                        <SelectValue placeholder={t("team_choose_member")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrgMembers.map((member) => (
                          <SelectItem
                            key={member.user_id}
                            value={member.user_id}
                          >
                            {member.user_full_name || member.user_email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("com_role")}</Label>
                    <Select
                      value={selectedRole}
                      onValueChange={(v) => setSelectedRole(v as TeamRole)}
                    >
                      <SelectTrigger
                        {...testId("role-select-trigger")}
                        className="h-8 text-sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          {t("team_role_viewer")}
                        </SelectItem>
                        <SelectItem value="member">
                          {t("org_role_member")}
                        </SelectItem>
                        <SelectItem value="admin">
                          {t("org_role_admin")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                  <Button variant="ghost" size="sm" onClick={resetAddDialog}>
                    {t("com_cancel")}
                  </Button>
                  <Button
                    {...testId("add-member-submit")}
                    size="sm"
                    onClick={handleAddMember}
                    disabled={!selectedUserId || addMemberMutation.isPending}
                  >
                    {addMemberMutation.isPending && (
                      <Loader2 className="mr-1.5 size-3 animate-spin" />
                    )}
                    {t("team_add_member")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("team_no_members")}
          </p>
        ) : (
          <DataTable
            columns={memberColumns}
            data={memberData}
            searchKey="user_full_name"
            searchPlaceholder={t("team_search_members")}
          />
        )}
      </div>
    </SettingsCard>
  );
}

function TeamSystemPromptsSection({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["team-prompts", orgId, teamId],
    queryFn: () => promptsApi.listTeamPrompts(orgId, teamId),
  });

  const prompts = promptsData?.data ?? [];
  const systemPrompts = prompts.filter((p) => p.prompt_type === "system");

  const scope = { type: "team" as const, orgId, teamId };

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("prompts_system_desc")}
          </p>
          <CreatePromptDialog scope={scope} defaultType="system" compact />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : systemPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("prompts_no_system")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {systemPrompts.map((prompt) => (
              <PromptRow key={prompt.id} prompt={prompt} scope={scope} />
            ))}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

function TeamTemplatesSection({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["team-prompts", orgId, teamId],
    queryFn: () => promptsApi.listTeamPrompts(orgId, teamId),
  });

  const prompts = promptsData?.data ?? [];
  const templatePrompts = prompts.filter((p) => p.prompt_type === "template");

  const scope = { type: "team" as const, orgId, teamId };

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("prompts_templates_desc")}
          </p>
          <CreatePromptDialog scope={scope} defaultType="template" compact />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : templatePrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("prompts_no_templates")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {templatePrompts.map((prompt) => (
              <PromptRow key={prompt.id} prompt={prompt} scope={scope} />
            ))}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

function ChatFeaturesSection({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const { data: orgSettings, isLoading: isLoadingOrg } =
    useOrgChatSettings(orgId);
  const { data: teamSettings, isLoading: isLoadingTeam } = useTeamChatSettings(
    orgId,
    teamId,
  );
  const updateMutation = useUpdateTeamChatSettings(orgId, teamId);

  const chatDisabledByOrg = orgSettings ? !orgSettings.chat_enabled : false;
  const chatPanelDisabledByOrg = orgSettings
    ? !orgSettings.chat_panel_enabled
    : false;

  return (
    <SettingsCard>
      <div className="p-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 py-2">
            <MessageSquare className="size-4" />
            <span className="text-sm font-medium">{t("chat_features")}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {t("team_org_settings_precedence")}
          </p>
          <ChatSettings
            settings={
              teamSettings ?? {
                chat_enabled: true,
                chat_panel_enabled: true,
                memory_enabled: true,
                mcp_enabled: true,
                disabled_mcp_servers: [],
                disabled_tools: [],
              }
            }
            onChatEnabledChange={(enabled) =>
              updateMutation.mutate({ chat_enabled: enabled })
            }
            onChatPanelEnabledChange={(enabled) =>
              updateMutation.mutate({ chat_panel_enabled: enabled })
            }
            chatDisabledByOrg={chatDisabledByOrg}
            chatPanelDisabledByOrg={chatPanelDisabledByOrg}
            isLoading={
              isLoadingOrg || isLoadingTeam || updateMutation.isPending
            }
            level="team"
          />
        </div>

        <div className="border-t pt-4">
          <TeamMCPSection
            orgId={orgId}
            teamId={teamId}
            orgSettings={orgSettings}
            teamSettings={teamSettings}
            updateMutation={updateMutation}
            isLoading={isLoadingOrg || isLoadingTeam}
          />
        </div>
      </div>
    </SettingsCard>
  );
}

function TeamMemorySection({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const { data: orgSettings, isLoading: isLoadingOrg } =
    useOrgChatSettings(orgId);
  const { data: teamSettings, isLoading: isLoadingTeam } = useTeamChatSettings(
    orgId,
    teamId,
  );
  const updateMutation = useUpdateTeamChatSettings(orgId, teamId);

  const memoryDisabledByOrg = orgSettings ? !orgSettings.memory_enabled : false;

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("team_memory_disable_desc")}
        </p>
        <MemorySettings
          memoryEnabled={teamSettings?.memory_enabled ?? true}
          onMemoryEnabledChange={(enabled) =>
            updateMutation.mutate({ memory_enabled: enabled })
          }
          memoryDisabledByOrg={memoryDisabledByOrg}
          isLoading={isLoadingOrg || isLoadingTeam || updateMutation.isPending}
          level="team"
        />
      </div>
    </SettingsCard>
  );
}

function TeamMCPSection({
  orgId,
  teamId,
  orgSettings,
  teamSettings,
  updateMutation,
  isLoading,
}: {
  orgId: string;
  teamId: string;
  orgSettings: OrganizationChatSettings | undefined;
  teamSettings: TeamChatSettings | undefined;
  updateMutation: ReturnType<typeof useUpdateTeamChatSettings>;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const mcpDisabledByOrg = orgSettings ? !orgSettings.mcp_enabled : false;
  const customServersDisabledByOrg = orgSettings
    ? !orgSettings.mcp_allow_custom_servers
    : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 py-2">
        <Plug className="size-4" />
        <span className="text-sm font-medium">{t("mcp_integration")}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("team_mcp_configure_desc")}
      </p>

      <MCPSettings
        mcpEnabled={teamSettings?.mcp_enabled ?? true}
        mcpAllowCustomServers={teamSettings?.mcp_allow_custom_servers ?? true}
        onMCPEnabledChange={(enabled) =>
          updateMutation.mutate({ mcp_enabled: enabled })
        }
        onMCPAllowCustomServersChange={(allowed) =>
          updateMutation.mutate({ mcp_allow_custom_servers: allowed })
        }
        disabledBy={mcpDisabledByOrg ? "org" : null}
        customServersDisabledBy={customServersDisabledByOrg ? "org" : null}
        isLoading={isLoading || updateMutation.isPending}
        level="team"
      />

      {!mcpDisabledByOrg && !customServersDisabledByOrg && (
        <div className="mt-4">
          <MCPServersList scope={{ type: "team", orgId, teamId }} />
        </div>
      )}
    </div>
  );
}

function AccessDeniedSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      {...testId("access-denied-section")}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold mb-2">
        {t("error_access_denied" as never)}
      </h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {t("error_no_permission_team_settings" as never)}
      </p>
      <Button
        {...testId("access-denied-go-home")}
        size="sm"
        onClick={() => navigate({ to: "/" })}
      >
        {t("error_go_home" as never)}
      </Button>
    </div>
  );
}

function TeamMCPSectionStandalone({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string;
}) {
  const { data: orgSettings, isLoading: isLoadingOrg } =
    useOrgChatSettings(orgId);
  const { data: teamSettings, isLoading: isLoadingTeam } = useTeamChatSettings(
    orgId,
    teamId,
  );
  const updateMutation = useUpdateTeamChatSettings(orgId, teamId);

  const mcpDisabledByOrg = orgSettings ? !orgSettings.mcp_enabled : false;
  const customServersDisabledByOrg = orgSettings
    ? !orgSettings.mcp_allow_custom_servers
    : false;

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <MCPSettings
          mcpEnabled={teamSettings?.mcp_enabled ?? true}
          mcpAllowCustomServers={teamSettings?.mcp_allow_custom_servers ?? true}
          onMCPEnabledChange={(enabled) =>
            updateMutation.mutate({ mcp_enabled: enabled })
          }
          onMCPAllowCustomServersChange={(allowed) =>
            updateMutation.mutate({ mcp_allow_custom_servers: allowed })
          }
          disabledBy={mcpDisabledByOrg ? "org" : null}
          customServersDisabledBy={customServersDisabledByOrg ? "org" : null}
          isLoading={isLoadingOrg || isLoadingTeam || updateMutation.isPending}
          level="team"
        />

        {!mcpDisabledByOrg && !customServersDisabledByOrg && (
          <div className="mt-4">
            <MCPServersList scope={{ type: "team", orgId, teamId }} />
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

function TeamDeveloperApiKeysSection() {
  const { t } = useTranslation();

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("developer_api_keys_description" as never)}
        </p>

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
  );
}

function TeamGuardrailsSection({
  orgId,
  teamId,
}: {
  orgId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: orgGuardrails, isLoading: isLoadingOrg } = useQuery({
    queryKey: ["org-guardrails", orgId],
    queryFn: () => guardrailsApi.getOrgGuardrails(orgId),
  });

  const { data: teamGuardrails, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["team-guardrails", orgId, teamId],
    queryFn: () => guardrailsApi.getTeamGuardrails(orgId, teamId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: TeamGuardrailsUpdate) =>
      guardrailsApi.updateTeamGuardrails(orgId, teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["team-guardrails", orgId, teamId],
      });
    },
  });

  const isLoading = isLoadingOrg || isLoadingTeam;

  if (isLoading || !teamGuardrails) {
    return (
      <SettingsCard>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  // Check if guardrails are disabled by org
  const disabledByOrg = orgGuardrails && !orgGuardrails.allow_team_override;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("team_guardrails_desc")}
        {disabledByOrg && ` ${t("team_guardrails_disabled_by_org")}`}
      </p>
      <GuardrailSettings
        level="team"
        orgId={orgId}
        teamId={teamId}
        guardrailsEnabled={teamGuardrails.guardrails_enabled}
        inputBlockedKeywords={teamGuardrails.input_blocked_keywords}
        inputBlockedPatterns={teamGuardrails.input_blocked_patterns}
        inputAction={teamGuardrails.input_action}
        outputBlockedKeywords={teamGuardrails.output_blocked_keywords}
        outputBlockedPatterns={teamGuardrails.output_blocked_patterns}
        outputAction={teamGuardrails.output_action}
        piiDetectionEnabled={teamGuardrails.pii_detection_enabled}
        piiTypes={teamGuardrails.pii_types}
        piiAction={teamGuardrails.pii_action}
        isLoading={updateMutation.isPending}
        disabledBy={disabledByOrg ? "org" : null}
        onUpdate={(data) => updateMutation.mutate(data)}
      />
    </div>
  );
}
