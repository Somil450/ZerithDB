export interface PeerEntry {
  peerId: string;
  sessionId?: string;
}

export interface SignalingMessage {
  type: string;
  from?: string;
  to?: string;
  payload?: unknown;
  [key: string]: unknown;
}

export interface PollJoinBody {
  room: string;
  peer: string;
  token?: string;
}

export interface PollSendBody {
  session: string;
  room: string;
  message: SignalingMessage;
}

export interface PollLeaveBody {
  session: string;
  room: string;
}

export interface JoinResponse {
  sessionId: string;
  peerList: string[];
}

export interface MessagesResponse {
  messages: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  uptime_seconds: number;
  active_connections: number;
  rooms: number;
  peers: number;
  timestamp: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(
  logLevel: LogLevel = "info"
): Record<LogLevel, (...args: unknown[]) => void> {
  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[logLevel];
  };

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) console.debug(...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) console.info(...args);
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) console.warn(...args);
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) console.error(...args);
    },
  };
}

export function getEnv(key: string, defaultValue: string = ""): string {
  return typeof process !== "undefined" ? process.env?.[key] ?? defaultValue : defaultValue;
}

export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseJsonBody(body: string): Record<string, unknown> | null {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function verifyRoomToken(
  token: string | null,
  roomId: string,
  secret: string
): string | null {
  if (!secret) return null;
  if (!token) return "Missing token";

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "Invalid token format";

    const payload = JSON.parse(atob(parts[1]));
    if (payload.roomId !== roomId) return "Token not valid for this room";
    return null;
  } catch {
    return "Invalid or expired token";
  }
}