import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  formatDistanceToNow,
  isPast,
} from "date-fns";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Trash2,
  Plus,
  Loader2,
  Copy,
  Check,
  Crown,
  Shield,
  User,
  UserMinus,
  AlertTriangle,
  Settings2,
  Key,
  MessageSquare,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  Download,
  RefreshCw,
  X,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  RotateCw,
  Mail,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useWorkspace,
  useOrganizationMembers,
  workspaceKeys,
} from "@/lib/workspace";
import {
  teamsApi,
  promptsApi,
  invitationsApi,
  organizationsApi,
  auditApi,
  type TeamCreate,
  type OrgRole,
  type AuditEvent,
  type AuditLogQuery,
  ApiError,
} from "@/lib/api";
import {
  useOrgChatSettings,
  useUpdateOrgChatSettings,
  useOrganizationInvitations,
  useCancelInvitation,
  useResendInvitation,
} from "@/lib/queries";
import { ChatSettings } from "@/components/chat-settings";
import { MemorySettings } from "@/components/settings/memory-settings";
import {
  PromptRow,
  CreatePromptDialog,
  OrgDangerZone,
  OrgDetailsSection,
  MCPSettings,
  MCPServersList,
  GuardrailSettings,
  SettingsPageLayout,
  SettingsCard,
} from "@/components/settings";
import { guardrailsApi, type OrganizationGuardrailsUpdate } from "@/lib/api";
import { OrgThemeSettings } from "@/components/settings/org-theme-settings";
import { OrgRAGSettings } from "@/components/settings/org-rag-settings";
import { OrgLLMSettings } from "@/components/settings/org-llm-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isValidImageUrl, getInitials } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";

const PAGE_SIZES = [25, 50, 100] as const;

const VALID_SECTIONS = [
  "general",
  "people",
  "teams",
  "system-prompts",
  "templates",
  "preferences",
  "theme",
  "memory",
  "rag",
  "guardrails",
  "audit",
  "api-keys",
  "mcp",
  "llm-models",
] as const;

type OrgSettingsSection = (typeof VALID_SECTIONS)[number];

export const Route = createFileRoute("/org/settings/$section")({
  beforeLoad: ({ context, params }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
    // Validate section parameter
    if (!VALID_SECTIONS.includes(params.section as OrgSettingsSection)) {
      throw redirect({
        to: "/org/settings/$section",
        params: { section: "general" },
      });
    }
  },
  component: OrgSettingsPage,
});

function OrgSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section } = Route.useParams();
  const { currentOrg, currentOrgRole, teams, refresh, isLoadingTeams } =
    useWorkspace();
  const { data: membersData, isLoading: isLoadingMembers } =
    useOrganizationMembers(currentOrg?.id);
  const members = membersData?.data ?? [];

  const currentSection = section as OrgSettingsSection;
  const isOwner = currentOrgRole === "owner";
  const isAdmin = currentOrgRole === "owner" || currentOrgRole === "admin";

  if (!currentOrg || currentOrgRole === null) {
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

  if (!isAdmin) {
    return (
      <div className="bg-background min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="size-7 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold mb-2">
              {t("error_access_denied")}
            </h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {t("error_no_permission_org_settings")}
            </p>
            <Button size="sm" onClick={() => navigate({ to: "/" })}>
              {t("error_go_home")}
            </Button>
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
          <SettingsPageLayout title={t("org_settings_workspace")}>
            <SettingsCard>
              <div className="p-4">
                <OrgDetailsSection org={currentOrg} onUpdate={refresh} />
              </div>
            </SettingsCard>
            <OrgDangerZone
              orgId={currentOrg.id}
              orgName={currentOrg.name}
              isOwner={isOwner}
              memberCount={members.length}
              onLeave={() => navigate({ to: "/" })}
              onDelete={() => navigate({ to: "/" })}
            />
          </SettingsPageLayout>
        );
      case "people":
        return (
          <SettingsPageLayout title={t("org_members")}>
            <MembersSection
              orgId={currentOrg.id}
              orgName={currentOrg.name}
              members={members}
              teams={teams}
              isLoading={isLoadingMembers}
              isAdmin={isAdmin}
              isOwner={isOwner}
              onUpdate={refresh}
            />
          </SettingsPageLayout>
        );
      case "teams":
        return (
          <SettingsPageLayout title={t("org_teams")}>
            <TeamsSection
              orgId={currentOrg.id}
              teams={teams}
              isLoading={isLoadingTeams}
              isAdmin={isAdmin}
              onUpdate={refresh}
            />
          </SettingsPageLayout>
        );
      case "system-prompts":
        return (
          <SettingsPageLayout title={t("org_settings_system_prompts")}>
            <OrgSystemPromptsSection orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "templates":
        return (
          <SettingsPageLayout title={t("org_settings_templates")}>
            <OrgTemplatesSection orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "llm-models":
        return (
          <SettingsPageLayout title={t("llm_settings")}>
            <OrgLLMSettings orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "memory":
        return (
          <SettingsPageLayout title={t("settings_memory")}>
            <OrgMemorySection orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "api-keys":
        return (
          <SettingsPageLayout title={t("org_settings_api_keys")}>
            <OrgDeveloperApiKeysSection />
          </SettingsPageLayout>
        );
      case "mcp":
        return (
          <SettingsPageLayout title={t("org_settings_mcp")}>
            <OrgMCPSection orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "preferences":
        return (
          <SettingsPageLayout title={t("org_settings_preferences")}>
            <ChatFeaturesSection orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "theme":
        return (
          <SettingsPageLayout title={t("org_settings_theme")}>
            <OrgThemeSettings orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "rag":
        return (
          <SettingsPageLayout title={t("org_settings_docs")}>
            <OrgRAGSettings orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "guardrails":
        return (
          <SettingsPageLayout title={t("org_settings_guardrails")}>
            <OrgGuardrailsSection orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      case "audit":
        return (
          <SettingsPageLayout title={t("audit_title")}>
            <AuditLogsSection orgId={currentOrg.id} />
          </SettingsPageLayout>
        );
      default:
        return (
          <SettingsPageLayout title={t("org_settings_workspace")}>
            <SettingsCard>
              <div className="p-4">
                <OrgDetailsSection org={currentOrg} onUpdate={refresh} />
              </div>
            </SettingsCard>
            <OrgDangerZone
              orgId={currentOrg.id}
              orgName={currentOrg.name}
              isOwner={isOwner}
              memberCount={members.length}
              onLeave={() => navigate({ to: "/" })}
              onDelete={() => navigate({ to: "/" })}
            />
          </SettingsPageLayout>
        );
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-4 md:py-8">
        {renderContent()}
      </div>
    </div>
  );
}

type OrgMember = {
  id: string;
  user_id: string;
  role: OrgRole;
  user_email: string;
  user_full_name: string | null;
  user_profile_image_url: string | null;
};

type Team = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
};

interface MembersSectionProps {
  orgId: string;
  orgName: string;
  members: OrgMember[];
  teams: Team[];
  isLoading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  onUpdate: () => void;
}

function MembersSection({
  orgId,
  orgName,
  members,
  teams,
  isLoading,
  isAdmin,
  isOwner,
  onUpdate,
}: MembersSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SettingsCard>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="size-4" />
              {t("org_members")}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {members.length}
              </Badge>
            </div>
            {isAdmin && (
              <InviteMemberDialog
                orgId={orgId}
                isOwner={isOwner}
                teams={teams}
                orgName={orgName}
              />
            )}
          </div>
          <MembersTable
            orgId={orgId}
            members={members}
            isLoading={isLoading}
            isAdmin={isAdmin}
            isOwner={isOwner}
            onUpdate={onUpdate}
          />
        </div>
      </SettingsCard>
      <PendingInvitationsSection orgId={orgId} isAdmin={isAdmin} />
    </div>
  );
}

interface TeamsSectionProps {
  orgId: string;
  teams: Team[];
  isLoading: boolean;
  isAdmin: boolean;
  onUpdate: () => void;
}

function TeamsSection({
  orgId,
  teams,
  isLoading,
  isAdmin,
  onUpdate,
}: TeamsSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" />
            {t("org_teams")}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {teams.length}
            </Badge>
          </div>
          {isAdmin && <CreateTeamDialog orgId={orgId} onUpdate={onUpdate} />}
        </div>
        <TeamsTable
          orgId={orgId}
          teams={teams}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onUpdate={onUpdate}
        />
      </div>
    </SettingsCard>
  );
}

function InviteMemberDialog({
  orgId,
  isOwner,
  teams,
  orgName,
}: {
  orgId: string;
  isOwner: boolean;
  teams: Team[];
  orgName: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamsDropdownOpen, setTeamsDropdownOpen] = useState(false);
  const teamsDropdownRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<{
    total_sent: number;
    total_failed: number;
    results: Array<{
      email: string;
      success: boolean;
      token?: string | null;
      error?: string | null;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        teamsDropdownRef.current &&
        !teamsDropdownRef.current.contains(event.target as Node)
      ) {
        setTeamsDropdownOpen(false);
      }
    };

    if (teamsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [teamsDropdownOpen]);

  const bulkInviteMutation = useMutation({
    mutationFn: (data: {
      emails: string[];
      team_ids?: string[];
      org_role: OrgRole;
    }) => invitationsApi.createBulkInvitations(orgId, data),
    onSuccess: (data) => {
      setResults(data);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["org-invitations", orgId] });
    },
    onError: (err: ApiError) => {
      const detail = (err.body as { detail?: string })?.detail;
      setError(detail || t("error_failed_to_save"));
    },
  });

  const handleInvite = () => {
    setResults(null);
    // Parse emails - split by comma, newline, or space
    const emailList = emails
      .split(/[,\n\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"));

    if (emailList.length === 0) {
      setError(t("org_invite_no_valid_emails"));
      return;
    }

    bulkInviteMutation.mutate({
      emails: emailList,
      team_ids: selectedTeamIds.length > 0 ? selectedTeamIds : undefined,
      org_role: role,
    });
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId],
    );
  };

  const resetDialog = () => {
    setEmails("");
    setRole("member");
    setSelectedTeamIds([]);
    setResults(null);
    setError(null);
    setOpen(false);
  };

  const getDialogInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : resetDialog())}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          <Plus className="size-3 mr-1" />
          {t("org_invite")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex size-6 items-center justify-center rounded bg-amber-600 text-[10px] font-medium text-white">
              {getDialogInitials(orgName)}
            </span>
            {t("org_invite_to_workspace")}
          </DialogTitle>
        </DialogHeader>

        {results ? (
          <div className="space-y-4 py-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">
                {results.total_sent > 0
                  ? t("org_invite_sent_count", { count: results.total_sent })
                  : t("org_invite_none_sent")}
              </p>
              {results.total_failed > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t("org_invite_failed_count", {
                    count: results.total_failed,
                  })}
                </p>
              )}
              {results.results.some((r) => r.success && r.token) && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t("org_invite_links")}:
                  </p>
                  {results.results
                    .filter((r) => r.success && r.token)
                    .map((r) => (
                      <div key={r.email} className="flex items-center gap-2">
                        <span className="text-xs truncate flex-1">
                          {r.email}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/invite?token=${r.token}`,
                            );
                          }}
                        >
                          <Copy className="size-3 mr-1" />
                          {t("com_copy")}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <Button size="sm" className="w-full" onClick={resetDialog}>
              {t("com_done")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="invite-emails" className="text-sm font-medium">
                {t("com_email")}
              </Label>
              <Textarea
                id="invite-emails"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder={t("org_invite_emails_placeholder")}
                className="min-h-[80px] text-sm resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("com_role")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("org_role_member")}</SelectItem>
                  <SelectItem value="admin">{t("org_role_admin")}</SelectItem>
                  {isOwner && (
                    <SelectItem value="owner">{t("org_role_owner")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {teams.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("org_invite_add_to_team")}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({t("com_optional")})
                  </span>
                </Label>
                <div className="relative" ref={teamsDropdownRef}>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-9 text-sm font-normal"
                    onClick={() => setTeamsDropdownOpen(!teamsDropdownOpen)}
                  >
                    {selectedTeamIds.length > 0
                      ? t("org_invite_teams_selected", {
                          count: selectedTeamIds.length,
                        })
                      : t("org_invite_select_teams")}
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                  {teamsDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md">
                      <div className="p-1">
                        {teams.map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                            onClick={() => toggleTeam(team.id)}
                          >
                            <div className="flex size-5 items-center justify-center rounded bg-pink-100 text-pink-600">
                              <Users className="size-3" />
                            </div>
                            <span className="flex-1">{team.name}</span>
                            {selectedTeamIds.includes(team.id) && (
                              <Check className="size-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={handleInvite}
                disabled={!emails.trim() || bulkInviteMutation.isPending}
              >
                {bulkInviteMutation.isPending && (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                )}
                {t("org_send_invites")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PendingInvitationsSection({
  orgId,
  isAdmin,
}: {
  orgId: string;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const { data: invitationsData, isLoading } = useOrganizationInvitations(
    orgId,
    "pending",
  );
  const cancelMutation = useCancelInvitation(orgId);
  const resendMutation = useResendInvitation(orgId);

  const pendingInvitations = invitationsData?.data ?? [];

  const getExpiryText = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    if (isPast(expiryDate)) {
      return (
        <span className="text-destructive">{t("org_invitation_expired")}</span>
      );
    }
    return formatDistanceToNow(expiryDate, { addSuffix: true });
  };

  const getRoleBadge = (role: OrgRole) => {
    switch (role) {
      case "owner":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-xs h-5"
          >
            {t("org_role_owner")}
          </Badge>
        );
      case "admin":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-0 text-xs h-5"
          >
            {t("org_role_admin")}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground text-xs h-5"
          >
            {t("org_role_member")}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <SettingsCard>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  if (pendingInvitations.length === 0) {
    return null; // Don't show section if no pending invitations
  }

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="size-4" />
            {t("org_pending_invitations")}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {pendingInvitations.length}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          {pendingInvitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {invitation.email}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{getExpiryText(invitation.expires_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getRoleBadge(invitation.org_role)}
                {isAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => resendMutation.mutate(invitation.id)}
                      disabled={resendMutation.isPending}
                      title={t("org_invitation_resend")}
                    >
                      {resendMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => cancelMutation.mutate(invitation.id)}
                      disabled={cancelMutation.isPending}
                      title={t("org_invitation_cancel")}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}

function MembersTable({
  orgId,
  members,
  isLoading,
  isAdmin,
  isOwner,
  onUpdate,
}: {
  orgId: string;
  members: OrgMember[];
  isLoading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      organizationsApi.updateMemberRole(orgId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.membership(orgId),
      });
      onUpdate();
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      organizationsApi.removeMember(orgId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.membership(orgId),
      });
      onUpdate();
    },
  });

  const getRoleBadge = (role: OrgRole) => {
    switch (role) {
      case "owner":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-xs h-5"
          >
            <Crown className="mr-1 size-2.5" />
            {t("org_role_owner")}
          </Badge>
        );
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
      default:
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground text-xs h-5"
          >
            <User className="mr-1 size-2.5" />
            {t("org_role_member")}
          </Badge>
        );
    }
  };

  const columns: ColumnDef<OrgMember>[] = useMemo(
    () => [
      {
        accessorKey: "user_full_name",
        header: t("org_role_member"),
        cell: ({ row }) => {
          const member = row.original;
          const isCurrentUser = member.user_id === user?.id;
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
          const isCurrentUser = member.user_id === user?.id;
          const canManage =
            isAdmin && !isCurrentUser && member.role !== "owner";

          if (!canManage) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
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
                        role: "admin",
                      })
                    }
                    disabled={member.role === "admin"}
                  >
                    <Shield className="mr-2 size-3.5" />
                    {t("org_role_admin")}
                  </DropdownMenuItem>
                  {isOwner && (
                    <DropdownMenuItem
                      onClick={() =>
                        updateRoleMutation.mutate({
                          memberId: member.id,
                          role: "owner",
                        })
                      }
                      disabled={member.role === "owner"}
                    >
                      <Crown className="mr-2 size-3.5" />
                      {t("org_role_owner")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <UserMinus className="mr-2 size-3.5" />
                        {t("org_remove_member")}
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("org_remove_member_title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("org_remove_member_confirm", {
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
                          {t("org_remove_member")}
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
      user?.id,
      isAdmin,
      isOwner,
      updateRoleMutation,
      removeMemberMutation,
      t,
      getRoleBadge,
    ],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("org_no_members")}
      </p>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={members}
      searchKey="user_full_name"
      searchPlaceholder={t("org_search_members")}
    />
  );
}

function CreateTeamDialog({
  orgId,
  onUpdate,
}: {
  orgId: string;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: TeamCreate) => teamsApi.createTeam(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.teams(orgId) });
      onUpdate();
      resetDialog();
    },
    onError: (err: ApiError) => {
      const detail = (err.body as { detail?: string })?.detail;
      setError(detail || t("error_failed_to_save"));
    },
  });

  const resetDialog = () => {
    setName("");
    setDescription("");
    setError(null);
    setOpen(false);
  };

  const handleCreate = () => {
    createMutation.mutate({ name, description: description || null });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : resetDialog())}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          <Plus className="size-3 mr-1" />
          {t("com_create")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t("team_create")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("team_create_desc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-3">
          <div className="space-y-1.5">
            <Label htmlFor="team-name" className="text-xs">
              {t("com_name")}
            </Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("team_name_placeholder")}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-description" className="text-xs">
              {t("com_description")}
            </Label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("team_description_placeholder")}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={resetDialog}>
            {t("com_cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name || createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-1.5 size-3 animate-spin" />
            )}
            {t("com_create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamsTable({
  orgId,
  teams,
  isLoading,
  isAdmin,
  onUpdate,
}: {
  orgId: string;
  teams: Team[];
  isLoading: boolean;
  isAdmin: boolean;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => teamsApi.deleteTeam(orgId, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.teams(orgId) });
      onUpdate();
    },
  });

  const columns: ColumnDef<Team>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("org_teams"),
        cell: ({ row }) => {
          const team = row.original;
          return (
            <div className="flex items-center gap-2.5">
              {isValidImageUrl(team.logo_url) ? (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="size-7 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-md bg-muted">
                  <Users className="size-3.5 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm font-medium">{team.name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: t("com_description"),
        cell: ({ row }) => {
          const description = row.getValue("description") as string | null;
          return description ? (
            <span className="text-xs text-muted-foreground line-clamp-1">
              {description}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">
              {t("com_no_description")}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">{t("com_actions")}</div>,
        cell: ({ row }) => {
          const team = row.original;
          return (
            <div className="flex justify-end gap-1">
              {isAdmin && (
                <Button variant="ghost" size="icon" className="size-7" asChild>
                  <Link
                    to="/org/team/$teamId/settings/$section"
                    params={{ teamId: team.id, section: "general" }}
                  >
                    <Settings2 className="size-3.5" />
                  </Link>
                </Button>
              )}
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("team_delete")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("team_delete_confirm", { teamName: team.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("com_cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(team.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("com_delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          );
        },
      },
    ],
    [isAdmin, deleteMutation, t],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("team_no_teams")}
      </p>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={teams}
      searchKey="name"
      searchPlaceholder={t("team_search")}
    />
  );
}

function OrgSystemPromptsSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["org-prompts", orgId],
    queryFn: () => promptsApi.listOrgPrompts(orgId),
  });

  const prompts = promptsData?.data ?? [];
  const systemPrompts = prompts.filter((p) => p.prompt_type === "system");

  const scope = { type: "org" as const, orgId };

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

function OrgTemplatesSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["org-prompts", orgId],
    queryFn: () => promptsApi.listOrgPrompts(orgId),
  });

  const prompts = promptsData?.data ?? [];
  const templatePrompts = prompts.filter((p) => p.prompt_type === "template");

  const scope = { type: "org" as const, orgId };

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

function ChatFeaturesSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useOrgChatSettings(orgId);
  const updateMutation = useUpdateOrgChatSettings(orgId);

  return (
    <SettingsCard>
      <div className="p-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 py-2">
            <MessageSquare className="size-4" />
            <span className="text-sm font-medium">{t("chat_features")}</span>
          </div>
          <ChatSettings
            settings={
              settings ?? {
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
            isLoading={isLoading || updateMutation.isPending}
            level="org"
          />
        </div>
      </div>
    </SettingsCard>
  );
}

function OrgMemorySection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useOrgChatSettings(orgId);
  const updateMutation = useUpdateOrgChatSettings(orgId);

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("memory_when_disabled_org")}
        </p>
        <MemorySettings
          memoryEnabled={settings?.memory_enabled ?? true}
          onMemoryEnabledChange={(enabled) =>
            updateMutation.mutate({ memory_enabled: enabled })
          }
          isLoading={isLoading || updateMutation.isPending}
          level="org"
        />
      </div>
    </SettingsCard>
  );
}

function OrgDeveloperApiKeysSection() {
  const { t } = useTranslation();

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("developer_api_keys_description")}
        </p>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Key className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium mb-1">
            {t("developer_api_keys_coming_soon")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {t("developer_api_keys_coming_soon_desc")}
          </p>
        </div>
      </div>
    </SettingsCard>
  );
}

function OrgMCPSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useOrgChatSettings(orgId);
  const updateMutation = useUpdateOrgChatSettings(orgId);

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("mcp_configure_desc")}
        </p>

        <MCPSettings
          mcpEnabled={settings?.mcp_enabled ?? true}
          mcpAllowCustomServers={settings?.mcp_allow_custom_servers ?? true}
          onMCPEnabledChange={(enabled) =>
            updateMutation.mutate({ mcp_enabled: enabled })
          }
          onMCPAllowCustomServersChange={(allowed) =>
            updateMutation.mutate({ mcp_allow_custom_servers: allowed })
          }
          isLoading={isLoading || updateMutation.isPending}
          level="org"
        />

        <div className="mt-4">
          <MCPServersList scope={{ type: "org", orgId }} />
        </div>
      </div>
    </SettingsCard>
  );
}

function OrgGuardrailsSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: guardrails, isLoading } = useQuery({
    queryKey: ["org-guardrails", orgId],
    queryFn: () => guardrailsApi.getOrgGuardrails(orgId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: OrganizationGuardrailsUpdate) =>
      guardrailsApi.updateOrgGuardrails(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-guardrails", orgId] });
    },
  });

  if (isLoading || !guardrails) {
    return (
      <SettingsCard>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("guardrails_ai_desc")}</p>
      <GuardrailSettings
        level="org"
        orgId={orgId}
        guardrailsEnabled={guardrails.guardrails_enabled}
        inputBlockedKeywords={guardrails.input_blocked_keywords}
        inputBlockedPatterns={guardrails.input_blocked_patterns}
        inputAction={guardrails.input_action}
        outputBlockedKeywords={guardrails.output_blocked_keywords}
        outputBlockedPatterns={guardrails.output_blocked_patterns}
        outputAction={guardrails.output_action}
        piiDetectionEnabled={guardrails.pii_detection_enabled}
        piiTypes={guardrails.pii_types}
        piiAction={guardrails.pii_action}
        allowTeamOverride={guardrails.allow_team_override}
        allowUserOverride={guardrails.allow_user_override}
        isLoading={updateMutation.isPending}
        onUpdate={(data) => updateMutation.mutate(data)}
      />
    </div>
  );
}

function AuditLogsSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();

  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Local filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [actionFilter, setActionFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 7), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Build query params
  const queryParams = useMemo<AuditLogQuery>(() => {
    const params: AuditLogQuery = {
      skip: (page - 1) * limit,
      limit,
      sort_field: "timestamp",
      sort_order: "desc",
    };

    if (startDate) {
      params.start_time = startOfDay(new Date(startDate)).toISOString();
    }
    if (endDate) {
      params.end_time = endOfDay(new Date(endDate)).toISOString();
    }
    if (actionFilter) {
      params.actions = [actionFilter];
    }
    if (outcomeFilter) {
      params.outcome = outcomeFilter;
    }
    if (searchQuery) {
      params.query = searchQuery;
    }

    return params;
  }, [
    page,
    limit,
    startDate,
    endDate,
    actionFilter,
    outcomeFilter,
    searchQuery,
  ]);

  // Fetch audit logs
  const {
    data: logsData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["audit-logs", orgId, queryParams],
    queryFn: () => auditApi.listLogs(orgId, queryParams),
    enabled: !!orgId,
  });

  // Fetch available actions
  const { data: availableActions } = useQuery({
    queryKey: ["audit-actions", orgId],
    queryFn: () => auditApi.getActions(orgId),
    enabled: !!orgId,
  });

  const totalPages = useMemo(() => {
    if (!logsData?.total) return 1;
    return Math.ceil(logsData.total / limit);
  }, [logsData?.total, limit]);

  const updateFilters = useCallback(
    (updates: {
      page?: number;
      limit?: number;
      action?: string;
      outcome?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      if (updates.page !== undefined) setPage(updates.page);
      if (updates.limit !== undefined)
        setLimit(updates.limit as (typeof PAGE_SIZES)[number]);
      if (updates.action !== undefined) setActionFilter(updates.action);
      if (updates.outcome !== undefined) setOutcomeFilter(updates.outcome);
      if (updates.search !== undefined) setSearchQuery(updates.search);
      if (updates.startDate !== undefined) setStartDate(updates.startDate);
      if (updates.endDate !== undefined) setEndDate(updates.endDate);
    },
    [],
  );

  const handleExport = async () => {
    if (!orgId || !startDate || !endDate) return;

    setIsExporting(true);
    try {
      const blob = await auditApi.exportLogs(orgId, {
        start_time: startOfDay(new Date(startDate)).toISOString(),
        end_time: endOfDay(new Date(endDate)).toISOString(),
        actions: actionFilter ? [actionFilter] : undefined,
        outcome: outcomeFilter || undefined,
      });

      // Download the blob
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${orgId}-${startDate}-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      // Error handled silently
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 py-2">
        <FileText className="size-4" />
        <span className="text-sm font-medium">{t("audit_title")}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t("audit_description")}</p>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Calendar className="size-3.5" />
                {startDate && endDate
                  ? `${format(new Date(startDate), "MMM d")} - ${format(new Date(endDate), "MMM d")}`
                  : t("audit_date_range")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("audit_start_date")}</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) =>
                        updateFilters({ startDate: e.target.value, page: 1 })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("audit_end_date")}</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) =>
                        updateFilters({ endDate: e.target.value, page: 1 })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      updateFilters({
                        startDate: format(new Date(), "yyyy-MM-dd"),
                        endDate: format(new Date(), "yyyy-MM-dd"),
                        page: 1,
                      })
                    }
                  >
                    {t("audit_today")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      updateFilters({
                        startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                        endDate: format(new Date(), "yyyy-MM-dd"),
                        page: 1,
                      })
                    }
                  >
                    {t("audit_last_7_days")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      updateFilters({
                        startDate: format(
                          subDays(new Date(), 30),
                          "yyyy-MM-dd",
                        ),
                        endDate: format(new Date(), "yyyy-MM-dd"),
                        page: 1,
                      })
                    }
                  >
                    {t("audit_last_30_days")}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Action filter */}
        <Select
          value={actionFilter || "all"}
          onValueChange={(v) =>
            updateFilters({ action: v === "all" ? "" : v, page: 1 })
          }
        >
          <SelectTrigger className="h-8 w-[180px] text-sm">
            <Filter className="size-3.5 mr-1.5" />
            <SelectValue placeholder={t("audit_filter_action")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit_all_actions")}</SelectItem>
            {availableActions?.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Outcome filter */}
        <Select
          value={outcomeFilter || "all"}
          onValueChange={(v) =>
            updateFilters({ outcome: v === "all" ? "" : v, page: 1 })
          }
        >
          <SelectTrigger className="h-8 w-[130px] text-sm">
            <SelectValue placeholder={t("audit_filter_outcome")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit_all_outcomes")}</SelectItem>
            <SelectItem value="success">
              {t("audit_outcome_success")}
            </SelectItem>
            <SelectItem value="failure">
              {t("audit_outcome_failure")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="flex-1 max-w-xs">
          <Input
            type="text"
            placeholder={t("audit_search_placeholder")}
            value={searchQuery}
            onChange={(e) => updateFilters({ search: e.target.value, page: 1 })}
            className="h-8 text-sm"
          />
        </div>

        {/* Clear filters */}
        {(actionFilter || outcomeFilter || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() =>
              updateFilters({
                action: "",
                outcome: "",
                search: "",
                page: 1,
              })
            }
          >
            <X className="size-3.5 mr-1" />
            {t("audit_clear_filters")}
          </Button>
        )}

        <div className="flex-1" />

        {/* Refresh and Export */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`size-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`}
            />
            {t("audit_refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleExport}
            disabled={isExporting || !logsData?.events.length}
          >
            {isExporting ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="size-3.5 mr-1.5" />
            )}
            {t("audit_export")}
          </Button>
        </div>
      </div>

      {/* Results count */}
      {logsData && (
        <div className="text-sm text-muted-foreground">
          {t("audit_showing_results", {
            from: (page - 1) * limit + 1,
            to: Math.min(page * limit, logsData.total),
            total: logsData.total,
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">
                {t("audit_col_timestamp")}
              </TableHead>
              <TableHead>{t("audit_col_action")}</TableHead>
              <TableHead>{t("audit_col_actor")}</TableHead>
              <TableHead className="w-[100px]">
                {t("audit_col_outcome")}
              </TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("audit_failed_load")}
                </TableCell>
              </TableRow>
            ) : logsData?.events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("audit_no_results")}
                </TableCell>
              </TableRow>
            ) : (
              logsData?.events.map((event) => (
                <TableRow
                  key={event.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedEvent(event)}
                >
                  <TableCell className="font-mono text-xs">
                    {format(new Date(event.timestamp), "MMM d, yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {event.action}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.actor.email || t("audit_system")}
                  </TableCell>
                  <TableCell>
                    <AuditOutcomeBadge outcome={event.outcome} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {logsData && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("audit_rows_per_page")}
            </span>
            <Select
              value={limit.toString()}
              onValueChange={(v) =>
                updateFilters({ limit: parseInt(v), page: 1 })
              }
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("audit_page_of", { current: page, total: totalPages })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => updateFilters({ page: page - 1 })}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages}
                onClick={() => updateFilters({ page: page + 1 })}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <AuditEventDialog
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

function AuditOutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "success") {
    return (
      <Badge
        variant="secondary"
        className="bg-green-500/15 text-green-600 dark:text-green-400 border-0"
      >
        <CheckCircle className="size-3 mr-1" />
        Success
      </Badge>
    );
  }
  if (outcome === "failure") {
    return (
      <Badge
        variant="secondary"
        className="bg-red-500/15 text-red-600 dark:text-red-400 border-0"
      >
        <XCircle className="size-3 mr-1" />
        Failure
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {outcome}
    </Badge>
  );
}

function AuditEventDialog({
  event,
  onClose,
}: {
  event: AuditEvent | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (!event) return null;

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            {t("audit_detail_title")}
          </DialogTitle>
          <DialogDescription>
            {format(new Date(event.timestamp), "MMMM d, yyyy 'at' HH:mm:ss")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action and Outcome */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("audit_detail_action")}
              </Label>
              <code className="block mt-1 text-sm bg-muted px-2 py-1 rounded">
                {event.action}
              </code>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("audit_detail_outcome")}
              </Label>
              <div className="mt-1">
                <AuditOutcomeBadge outcome={event.outcome} />
              </div>
            </div>
          </div>

          {/* Actor */}
          <div>
            <Label className="text-xs text-muted-foreground">
              {t("audit_detail_actor")}
            </Label>
            <div className="mt-1 text-sm space-y-1">
              {event.actor.email && (
                <div>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {event.actor.email}
                </div>
              )}
              {event.actor.ip_address && (
                <div>
                  <span className="text-muted-foreground">IP:</span>{" "}
                  {event.actor.ip_address}
                </div>
              )}
              {event.actor.user_agent && (
                <div
                  className="text-xs text-muted-foreground truncate"
                  title={event.actor.user_agent}
                >
                  {event.actor.user_agent}
                </div>
              )}
            </div>
          </div>

          {/* Targets */}
          {event.targets.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("audit_detail_targets")}
              </Label>
              <div className="mt-1 space-y-1">
                {event.targets.map((target, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {target.type}
                    </Badge>
                    {target.name || target.id}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {Object.keys(event.metadata).length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("audit_detail_metadata")}
              </Label>
              <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Changes */}
          {event.changes && Object.keys(event.changes).length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("audit_detail_changes")}
              </Label>
              <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(event.changes, null, 2)}
              </pre>
            </div>
          )}

          {/* Error info */}
          {event.error_message && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {t("audit_detail_error")}
              </Label>
              <div className="mt-1 text-sm text-destructive">
                {event.error_code && (
                  <span className="font-mono mr-2">[{event.error_code}]</span>
                )}
                {event.error_message}
              </div>
            </div>
          )}

          {/* IDs */}
          <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
            <div>
              Event ID: <span className="font-mono">{event.id}</span>
            </div>
            {event.request_id && (
              <div>
                Request ID:{" "}
                <span className="font-mono">{event.request_id}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
