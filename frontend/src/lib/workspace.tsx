/**
 * Workspace Context Provider for Multi-Tenant Architecture.
 *
 * Manages the current organization and team selection, providing:
 * - Current organization and team state
 * - Organization/team switching
 * - Persistence to localStorage
 * - TanStack Query integration for data fetching
 *
 * Hook variants:
 * - useWorkspace(): Throws if outside provider (strict, default)
 * - useWorkspaceOptional(): Returns null if outside provider
 * - useWorkspaceSafe(): Returns safe defaults if outside provider
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizationsApi,
  teamsApi,
  type Organization,
  type TeamWithMyRole,
  type OrgRole,
  type SidebarPreferences,
} from "./api";
import { isLoggedIn, useCurrentUser } from "./auth";
import { queryDefaults } from "./query-defaults";

export interface MyMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  team_order: string[];
  sidebar_preferences: SidebarPreferences | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceState {
  /** Currently selected organization */
  currentOrg: Organization | null;
  /** Currently selected team (within the current org) */
  currentTeam: TeamWithMyRole | null;
  /** User's role in the current organization */
  currentOrgRole: OrgRole | null;
  /** All organizations the user belongs to */
  organizations: Organization[];
  /** Teams in the current organization (with user's role in each) */
  teams: TeamWithMyRole[];
  /** Current user's membership data including preferences */
  myMembership: MyMembership | null;
  /** Loading states */
  isLoadingOrgs: boolean;
  isLoadingTeams: boolean;
  /** Error states */
  orgsError: Error | null;
  teamsError: Error | null;
  /** Switch to a different organization */
  switchOrganization: (orgId: string) => void;
  /** Switch to a different team */
  switchTeam: (teamId: string | null) => void;
  /** Refresh organizations and teams */
  refresh: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

const STORAGE_KEYS = {
  currentOrgId: "workspace_current_org_id",
  currentTeamId: "workspace_current_team_id",
};

export const workspaceKeys = {
  organizations: ["workspace", "organizations"] as const,
  teams: (orgId: string) => ["workspace", "teams", orgId] as const,
  membership: (orgId: string) => ["workspace", "membership", orgId] as const,
};

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const queryClient = useQueryClient();
  useCurrentUser(); // Keep the hook for side effects
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.currentOrgId),
  );
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.currentTeamId),
  );
  const [currentOrgRole, setCurrentOrgRole] = useState<OrgRole | null>(null);

  const {
    data: orgsData,
    isLoading: isLoadingOrgs,
    error: orgsError,
  } = useQuery({
    queryKey: workspaceKeys.organizations,
    queryFn: () => organizationsApi.getOrganizations(),
    enabled: isLoggedIn(),
    ...queryDefaults.stable,
  });

  const organizations = orgsData?.data ?? [];

  useEffect(() => {
    if (!isLoadingOrgs && organizations.length > 0 && !currentOrgId) {
      const firstOrg = organizations[0];
      setCurrentOrgId(firstOrg.id);
      localStorage.setItem(STORAGE_KEYS.currentOrgId, firstOrg.id);
    }
  }, [isLoadingOrgs, organizations, currentOrgId]);

  useEffect(() => {
    if (!isLoadingOrgs && currentOrgId && organizations.length > 0) {
      const orgExists = organizations.some((org) => org.id === currentOrgId);
      if (!orgExists) {
        const firstOrg = organizations[0];
        setCurrentOrgId(firstOrg.id);
        localStorage.setItem(STORAGE_KEYS.currentOrgId, firstOrg.id);
        setCurrentTeamId(null);
        localStorage.removeItem(STORAGE_KEYS.currentTeamId);
      }
    }
  }, [isLoadingOrgs, currentOrgId, organizations]);

  const {
    data: teamsData,
    isLoading: isLoadingTeams,
    error: teamsError,
  } = useQuery({
    queryKey: workspaceKeys.teams(currentOrgId ?? ""),
    queryFn: () => teamsApi.getMyTeams(currentOrgId!),
    enabled: isLoggedIn() && !!currentOrgId,
    ...queryDefaults.stable,
  });

  const teams = teamsData?.data ?? [];

  const { data: myMembership } = useQuery({
    queryKey: ["workspace", "my-membership", currentOrgId],
    queryFn: () => organizationsApi.getMyMembership(currentOrgId!),
    enabled: isLoggedIn() && !!currentOrgId,
    ...queryDefaults.stable,
  });

  useEffect(() => {
    if (myMembership) {
      setCurrentOrgRole(myMembership.role);
    } else {
      setCurrentOrgRole(null);
    }
  }, [myMembership]);

  useEffect(() => {
    if (!isLoadingTeams && teams.length > 0 && !currentTeamId) {
      const firstTeam = teams[0];
      setCurrentTeamId(firstTeam.id);
      localStorage.setItem(STORAGE_KEYS.currentTeamId, firstTeam.id);
    }
  }, [isLoadingTeams, teams, currentTeamId]);

  useEffect(() => {
    if (!isLoadingTeams && currentTeamId && teams.length > 0) {
      const teamExists = teams.some((team) => team.id === currentTeamId);
      if (!teamExists) {
        const firstTeam = teams[0];
        setCurrentTeamId(firstTeam.id);
        localStorage.setItem(STORAGE_KEYS.currentTeamId, firstTeam.id);
      }
    }
  }, [isLoadingTeams, currentTeamId, teams]);

  const currentOrg = useMemo(
    () => organizations.find((org) => org.id === currentOrgId) ?? null,
    [organizations, currentOrgId],
  );

  const currentTeam = useMemo(
    () => teams.find((team) => team.id === currentTeamId) ?? null,
    [teams, currentTeamId],
  );

  // Sort teams based on saved team order
  const sortedTeams = useMemo(() => {
    const teamOrder = myMembership?.team_order ?? [];
    if (teamOrder.length === 0) {
      return teams;
    }
    // Create a map of team id to index for quick lookup
    const orderMap = new Map(teamOrder.map((id, index) => [id, index]));
    return [...teams].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [teams, myMembership?.team_order]);

  const switchOrganization = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
    localStorage.setItem(STORAGE_KEYS.currentOrgId, orgId);
    setCurrentTeamId(null);
    localStorage.removeItem(STORAGE_KEYS.currentTeamId);
  }, []);

  const switchTeam = useCallback((teamId: string | null) => {
    setCurrentTeamId(teamId);
    if (teamId) {
      localStorage.setItem(STORAGE_KEYS.currentTeamId, teamId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentTeamId);
    }
  }, []);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: workspaceKeys.organizations });
    if (currentOrgId) {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.teams(currentOrgId),
      });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.membership(currentOrgId),
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace", "my-membership", currentOrgId],
      });
    }
  }, [queryClient, currentOrgId]);

  const value = useMemo<WorkspaceState>(
    () => ({
      currentOrg,
      currentTeam,
      currentOrgRole,
      organizations,
      teams: sortedTeams,
      myMembership: myMembership ?? null,
      isLoadingOrgs,
      isLoadingTeams,
      orgsError: orgsError instanceof Error ? orgsError : null,
      teamsError: teamsError instanceof Error ? teamsError : null,
      switchOrganization,
      switchTeam,
      refresh,
    }),
    [
      currentOrg,
      currentTeam,
      currentOrgRole,
      organizations,
      sortedTeams,
      myMembership,
      isLoadingOrgs,
      isLoadingTeams,
      orgsError,
      teamsError,
      switchOrganization,
      switchTeam,
      refresh,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Returns workspace state. Throws if used outside WorkspaceProvider.
 * Use this for components that must be within the workspace context.
 */
export function useWorkspace(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

/**
 * Returns workspace state or null if outside WorkspaceProvider.
 * Use for components that may render outside workspace context (e.g., error boundaries).
 */
export function useWorkspaceOptional(): WorkspaceState | null {
  return useContext(WorkspaceContext);
}

/** Default workspace state for components outside the provider */
const defaultWorkspaceState: WorkspaceState = {
  currentOrg: null,
  currentTeam: null,
  currentOrgRole: null,
  organizations: [],
  teams: [],
  myMembership: null,
  isLoadingOrgs: true,
  isLoadingTeams: true,
  orgsError: null,
  teamsError: null,
  switchOrganization: () => {},
  switchTeam: () => {},
  refresh: () => {},
};

/**
 * Returns workspace state with safe defaults if outside WorkspaceProvider.
 * Useful for components that need graceful degradation (loading states, fallbacks).
 */
export function useWorkspaceSafe(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  return context ?? defaultWorkspaceState;
}

export function useOrganizations() {
  return useQuery({
    queryKey: workspaceKeys.organizations,
    queryFn: () => organizationsApi.getOrganizations(),
    enabled: isLoggedIn(),
    ...queryDefaults.stable,
  });
}

export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", "organization", orgId],
    queryFn: () => organizationsApi.getOrganization(orgId!),
    enabled: isLoggedIn() && !!orgId,
    ...queryDefaults.stable,
  });
}

export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.membership(orgId ?? ""),
    queryFn: () => organizationsApi.getMembers(orgId!),
    enabled: isLoggedIn() && !!orgId,
    ...queryDefaults.stable,
  });
}

export function useTeams(orgId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.teams(orgId ?? ""),
    queryFn: () => teamsApi.getMyTeams(orgId!),
    enabled: isLoggedIn() && !!orgId,
    ...queryDefaults.stable,
  });
}

export function useTeam(orgId: string | undefined, teamId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", "team", orgId, teamId],
    queryFn: () => teamsApi.getTeam(orgId!, teamId!),
    enabled: isLoggedIn() && !!orgId && !!teamId,
    ...queryDefaults.stable,
  });
}

export function useTeamMembers(
  orgId: string | undefined,
  teamId: string | undefined,
) {
  return useQuery({
    queryKey: ["workspace", "team-members", orgId, teamId],
    queryFn: () => teamsApi.getMembers(orgId!, teamId!),
    enabled: isLoggedIn() && !!orgId && !!teamId,
    ...queryDefaults.stable,
  });
}
