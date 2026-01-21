/**
 * MSW Server Setup
 *
 * Configures the Mock Service Worker server for testing.
 * Import this in test files or setup to enable API mocking.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Create the MSW server with default handlers
export const server = setupServer(...handlers);

// Re-export for convenience
export { handlers } from "./handlers";
export {
  createMockSSEResponse,
  createChatStreamEvents,
  createToolApprovalEvents,
  createGuardrailBlockEvents,
  createSourcesEvents,
  mockUser,
  mockOrganization,
  mockTeam,
  mockConversation,
  mockToken,
} from "./handlers";
