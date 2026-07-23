/**
 * Structured Logger
 * Provides consistent logging with levels, context, and formatting.
 * Logs internally (console) and can be extended for external services.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  module?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_EMOJIS: Record<LogLevel, string> = {
  debug: "🔍",
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
};

class Logger {
  private minLevel: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
    const context = entry.context
      ? ` | ${JSON.stringify(entry.context)}`
      : "";
    return `${LOG_EMOJIS[entry.level]} [${entry.timestamp}] [${(entry.module ?? "app").toUpperCase()}] ${entry.message}${context}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, module?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      module,
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "debug":
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  debug(message: string, context?: Record<string, unknown>, module?: string): void {
    this.log("debug", message, context, module);
  }

  info(message: string, context?: Record<string, unknown>, module?: string): void {
    this.log("info", message, context, module);
  }

  warn(message: string, context?: Record<string, unknown>, module?: string): void {
    this.log("warn", message, context, module);
  }

  error(message: string, context?: Record<string, unknown>, module?: string): void {
    this.log("error", message, context, module);
  }

  /**
   * Create a child logger with a fixed module name
   */
  child(module: string): {
    debug: (msg: string, ctx?: Record<string, unknown>) => void;
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
  } {
    const childLogger = new Logger();
    childLogger.minLevel = this.minLevel;
    return {
      debug: (msg: string, ctx?: Record<string, unknown>) => childLogger.debug(msg, ctx, module),
      info: (msg: string, ctx?: Record<string, unknown>) => childLogger.info(msg, ctx, module),
      warn: (msg: string, ctx?: Record<string, unknown>) => childLogger.warn(msg, ctx, module),
      error: (msg: string, ctx?: Record<string, unknown>) => childLogger.error(msg, ctx, module),
    };
  }
}

export const logger = new Logger();
export default logger;
