export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  action?: string;
  [key: string]: unknown;
};

const SENSITIVE_KEY_PATTERN = /token|password|secret|key|magiclink|invitation|downloadurl|authsecret|cookie|authorization/i;

export function redactSensitive<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // Redact URLs containing token parameters
    if (value.includes("token=") || value.includes("/download/") || value.includes("/magic-link?")) {
      return "[REDACTED_URL]" as unknown as T;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1)) as unknown as T;
  }

  if (typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        redacted[k] = "[REDACTED]";
      } else {
        redacted[k] = redactSensitive(v, depth + 1);
      }
    }
    return redacted as T;
  }

  return value;
}

export function formatLogEntry(level: LogLevel, message: string, context?: LogContext) {
  const sanitizedContext = context ? redactSensitive(context) : {};
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizedContext,
  });
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLogEntry("debug", message, context));
    }
  },
  info(message: string, context?: LogContext) {
    console.info(formatLogEntry("info", message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatLogEntry("warn", message, context));
  },
  error(message: string, error?: unknown, context?: LogContext) {
    const errorDetails =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : error ? { errorDetails: String(error) } : {};
    console.error(formatLogEntry("error", message, { ...errorDetails, ...context }));
  },
};
