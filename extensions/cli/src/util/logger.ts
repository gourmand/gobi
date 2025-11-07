import crypto from "crypto";
import fs from "fs";
import path from "path";

import chalk from "chalk";
import winston from "winston";

import { env } from "../env.js";

// Avoid a static import of `sentryService` to break a circular dependency
// between `sentry.ts` and `logger.ts`. We dynamically import sentry at call
// time so the logger module can initialize synchronously and won't cause
// the bundler to emit top-level awaits.
async function getSentryService() {
  try {
    const m = await import("../sentry.js");
    return m.sentryService;
  } catch {
    return null;
  }
}

const { combine, timestamp, printf, errors } = winston.format;

// Generate a unique session ID for this process
const SESSION_ID = crypto.randomBytes(4).toString("hex");

// Get log directory
function getLogDir(): string {
  const logDir = path.join(env.gobiHome, "logs");

  // Create directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return logDir;
}

// Get current log file path
function getLogFilePath(): string {
  const logDir = getLogDir();
  return path.join(logDir, "cn.log");
}

// Simple replacer for JSON.stringify to handle common issues
function createReplacer() {
  const seen = new Set();

  return (key: string, value: any) => {
    // Handle circular references
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }

    // Handle functions
    if (typeof value === "function") {
      return "[Function]";
    }

    // Handle undefined (which JSON.stringify skips by default)
    if (value === undefined) {
      return "[undefined]";
    }

    return value;
  };
}

// Custom format for log output
const logFormat = printf(
  ({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${SESSION_ID}] [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      try {
        msg += ` ${JSON.stringify(metadata, createReplacer())}`;
      } catch (err) {
        // Fallback if stringify still fails somehow
        msg += ` [Failed to stringify metadata: ${err}]`;
      }
    }

    // Add stack trace for errors
    if (stack) {
      msg += `\n${stack}`;
    }

    return msg;
  },
);

// Track headless mode
let isHeadlessMode = false;

// Create the winstonLogger instance
const winstonLogger = winston.createLogger({
  level: "info", // Default level
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    logFormat,
  ),
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: getLogFilePath(),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Function to set log level
export function setLogLevel(level: string) {
  winstonLogger.level = level;
}

// Function to configure headless mode
export function configureHeadlessMode(headless: boolean) {
  isHeadlessMode = headless;
}

// Export winstonLogger methods
export const logger = {
  debug: (message: string, meta?: any) => winstonLogger.debug(message, meta),
  info: (message: string, meta?: any) => winstonLogger.info(message, meta),
  warn: (message: string, meta?: any) => {
    winstonLogger.warn(message, meta);
    // Fire-and-forget dynamic import to send warning to Sentry if available
    void getSentryService().then((s) =>
      s?.captureMessage(message, "warning", meta),
    );
  },
  error: (message: string, error?: Error | any, meta?: any) => {
    if (error instanceof Error) {
      winstonLogger.error(message, {
        ...meta,
        error: error.message,
        stack: error.stack,
      });
      void getSentryService().then((s) =>
        s?.captureException(error, { message, ...meta }),
      );
    } else if (error) {
      winstonLogger.error(message, { ...meta, error });
      void getSentryService().then((s) =>
        s?.captureMessage(`${message}: ${String(error)}`, "error", meta),
      );
    } else {
      winstonLogger.error(message, meta);
      void getSentryService().then((s) =>
        s?.captureMessage(message, "error", meta),
      );
    }

    // In headless mode, also output to stderr
    if (isHeadlessMode) {
      if (error instanceof Error) {
        console.error(chalk.red(`${message}: ${error.message}`));
      } else if (error) {
        console.error(chalk.red(`${message}: ${error}`));
      } else {
        console.error(chalk.red(message));
      }
    }
  },
  setLevel: setLogLevel,
  configureHeadlessMode,
  getLogPath: getLogFilePath,
  getSessionId: () => SESSION_ID,
};
