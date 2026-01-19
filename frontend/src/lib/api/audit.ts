/**
 * Audit logs API client for viewing organization activity.
 *
 * Provides methods for querying and exporting audit logs.
 */

import { API_BASE, apiClient, getAuthHeader } from "./client";

/** Log level/severity */
export type LogLevel = "debug" | "info" | "warning" | "error" | "critical";

/** Actor who performed the action */
export interface AuditActor {
  id: string | null;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

/** Target of the action */
export interface AuditTarget {
  type: string;
  id: string | null;
  name: string | null;
}

/** Audit event response */
export interface AuditEvent {
  id: string;
  timestamp: string;
  version: string;
  action: string;
  category: string;
  outcome: string;
  severity: LogLevel;
  actor: AuditActor;
  targets: AuditTarget[];
  organization_id: string | null;
  team_id: string | null;
  request_id: string | null;
  session_id: string | null;
  metadata: Record<string, unknown>;
  changes: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
}

/** Paginated audit log response */
export interface AuditLogResponse {
  events: AuditEvent[];
  total: number;
  skip: number;
  limit: number;
}

/** Query parameters for listing audit logs */
export interface AuditLogQuery {
  start_time?: string;
  end_time?: string;
  actions?: string[];
  actor_id?: string;
  actor_email?: string;
  team_id?: string;
  target_type?: string;
  target_id?: string;
  outcome?: string;
  query?: string;
  skip?: number;
  limit?: number;
  sort_field?: "timestamp" | "action" | "outcome" | "actor_email" | "duration_ms";
  sort_order?: "asc" | "desc";
}

/** Export parameters */
export interface AuditLogExportParams {
  start_time: string;
  end_time: string;
  actions?: string[];
  team_id?: string;
  outcome?: string;
  format?: "csv";
}

export const auditApi = {
  /**
   * List audit logs for an organization
   */
  async listLogs(
    orgId: string,
    params: AuditLogQuery = {},
  ): Promise<AuditLogResponse> {
    const searchParams = new URLSearchParams();

    if (params.start_time) searchParams.set("start_time", params.start_time);
    if (params.end_time) searchParams.set("end_time", params.end_time);
    if (params.actions?.length) {
      params.actions.forEach((a) => searchParams.append("actions", a));
    }
    if (params.actor_id) searchParams.set("actor_id", params.actor_id);
    if (params.actor_email) searchParams.set("actor_email", params.actor_email);
    if (params.team_id) searchParams.set("team_id", params.team_id);
    if (params.target_type) searchParams.set("target_type", params.target_type);
    if (params.target_id) searchParams.set("target_id", params.target_id);
    if (params.outcome) searchParams.set("outcome", params.outcome);
    if (params.query) searchParams.set("query", params.query);
    if (params.skip !== undefined)
      searchParams.set("skip", params.skip.toString());
    if (params.limit !== undefined)
      searchParams.set("limit", params.limit.toString());
    if (params.sort_field) searchParams.set("sort_field", params.sort_field);
    if (params.sort_order) searchParams.set("sort_order", params.sort_order);

    const queryString = searchParams.toString();
    const url = `/v1/organizations/${orgId}/audit-logs${queryString ? `?${queryString}` : ""}`;

    return apiClient.get<AuditLogResponse>(url, { headers: getAuthHeader() });
  },

  /**
   * Export audit logs as CSV
   */
  async exportLogs(
    orgId: string,
    params: AuditLogExportParams,
  ): Promise<Blob> {
    const searchParams = new URLSearchParams();

    searchParams.set("start_time", params.start_time);
    searchParams.set("end_time", params.end_time);
    if (params.actions?.length) {
      params.actions.forEach((a) => searchParams.append("actions", a));
    }
    if (params.team_id) searchParams.set("team_id", params.team_id);
    if (params.outcome) searchParams.set("outcome", params.outcome);
    searchParams.set("format", params.format || "csv");

    const url = `/v1/organizations/${orgId}/audit-logs/export?${searchParams.toString()}`;
    const token = localStorage.getItem("auth_token");

    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }

    return response.blob();
  },

  /**
   * Get available audit action types
   */
  async getActions(orgId: string): Promise<string[]> {
    return apiClient.get<string[]>(
      `/v1/organizations/${orgId}/audit-logs/actions`,
      { headers: getAuthHeader() },
    );
  },
};
