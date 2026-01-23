/**
 * Shared TypeScript types for test utilities and fixtures
 *
 * These types are extracted from multiple test files to maintain
 * consistency and reduce duplication across the test suite.
 */

/**
 * Standard list response format from API endpoints
 */
export interface ListResponse<T> {
  data: T[];
  count: number;
}

/**
 * Authentication tokens returned from login
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

/**
 * Organization entity from API
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Team entity from API
 */
export interface Team {
  id: string;
  name: string;
  slug: string;
  organization_id: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * User entity from API
 */
export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_platform_admin: boolean;
  language: string;
}

/**
 * Conversation entity from API
 */
export interface Conversation {
  id: string;
  title: string;
  organization_id: string;
  team_id?: string;
  user_id?: string;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Prompt entity from API
 */
export interface Prompt {
  id: string;
  name: string;
  description?: string;
  content: string;
  prompt_type: "TEMPLATE" | "SYSTEM";
  is_active: boolean;
  organization_id?: string;
  team_id?: string;
  user_id?: string;
}

/**
 * Document entity from API
 */
export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  mime_type?: string;
  processing_status: "pending" | "processing" | "completed" | "failed";
  processing_error?: string;
  chunk_count: number;
  organization_id: string;
  team_id?: string;
  user_id?: string;
}

/**
 * MCP Server entity from API
 */
export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  url: string;
  transport: string;
  auth_type: string;
  enabled: boolean;
  organization_id: string;
  team_id?: string;
  user_id?: string;
}

/**
 * Guardrails settings entity from API
 */
export interface GuardrailSettings {
  id: string;
  guardrails_enabled: boolean;
  input_blocked_keywords: string[];
  input_blocked_patterns: string[];
  input_action: "BLOCK" | "WARN" | "REDACT";
  output_blocked_keywords: string[];
  output_blocked_patterns: string[];
  output_action: "BLOCK" | "WARN" | "REDACT";
  pii_detection_enabled: boolean;
  pii_types: string[];
  pii_action: "BLOCK" | "WARN" | "REDACT";
}

/**
 * Media upload response from API
 */
export interface MediaUploadResponse {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  url: string;
}
