import winston from "winston";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, "..", "logs");

const isLoggingEnabled = process.env.E2E_LOG_TEST_DATA === "true";

const transports: winston.transport[] = [];

if (isLoggingEnabled) {
  // Ensure logs directory exists before creating file transports
  fs.mkdirSync(logsDir, { recursive: true });

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, "test-data.json"),
      options: { flags: "a" },
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "errors.json"),
      level: "error",
      options: { flags: "a" },
    })
  );
}

if (process.env.DEBUG === "true") {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export const logger = winston.createLogger({
  level: "info",
  silent: !isLoggingEnabled && process.env.DEBUG !== "true",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports,
});

export interface TestDataLog {
  testName: string;
  email?: string;
  password?: string;
  name?: string;
  workspaceName?: string;
  teamName?: string | null;
  teamId?: string | null;
  [key: string]: unknown;
}

export function logTestData(data: TestDataLog) {
  logger.info("test-data", data);
}

export function logTestStart(testName: string) {
  logger.info("test-start", { testName, startedAt: new Date().toISOString() });
}

export function logTestEnd(testName: string, status: "passed" | "failed", duration?: number) {
  logger.info("test-end", { testName, status, duration, endedAt: new Date().toISOString() });
}

export function logError(testName: string, error: unknown) {
  logger.error("test-error", {
    testName,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}
