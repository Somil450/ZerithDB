import { createLogger, generateSessionId, verifyRoomToken, getEnv } from "./internal/types.js";
import { RoomState, SignalingRelay } from "./internal/room-state.js";

const LOG_LEVEL = (getEnv("LOG_LEVEL") || "info") as "debug" | "info" | "warn" | "error";
const JWT_SECRET = getEnv("JWT_SECRET");
const VERSION = "0.1.0";

const logger = createLogger(LOG_LEVEL);

const rooms = new RoomState();

const messageHandler = {
  deliver: (_roomId: string, peerId: string, _message: unknown): void => {
    logger.debug(`[DELIVER] to=${peerId}`);
  },
};

const relay = new SignalingRelay(rooms, messageHandler, logger);

interface EdgeConnection {
  peerId: string;
  roomId: string;
}

const activeConnections = new Map<string, EdgeConnection>();

interface PollingSession {
  sessionId: string;
  peerId: string;
  roomId: string;
  messageQueue: string[];
  lastActivity: number;
}

const pollingSessions = new Map<string, PollingSession>();

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (url.pathname === "/" || url.pathname === "/health") {
    return handleHealth();
  }

  if (url.pathname === "/ws") {
    return handleWebSocket(request, headers);
  }

  if (url.pathname === "/poll/join" && request.method === "POST") {
    return handlePollJoin(request, headers);
  }

  if (url.pathname === "/poll/messages" && request.method === "GET") {
    return handlePollMessages(request, headers);
  }

  if (url.pathname === "/poll/send" && request.method === "POST") {
    return handlePollSend(request, headers);
  }

  if (url.pathname === "/poll/leave" && request.method === "POST") {
    return handlePollLeave(request, headers);
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "zerithdb-signaling",
      version: VERSION,
      platform: "vercel-edge",
      active_connections: activeConnections.size,
      rooms: rooms.getRoomCount(),
      peers: rooms.getPeerCount(),
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleWebSocket(request: Request, headers: Record<string, string>): Promise<Response> {
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426, headers });
  }

  const url = new URL(request.url);
  const roomId = url.searchParams.get("room");
  const peerId = url.searchParams.get("peer");
  const token = url.searchParams.get("token");

  if (!roomId || !peerId) {
    return new Response("Missing room or peer query parameters", { status: 400, headers });
  }

  const authError = verifyRoomToken(token, roomId, JWT_SECRET);
  if (authError) {
    return new Response(authError, { status: 401, headers });
  }

  const peerList = rooms.addPeer(roomId, { peerId });
  activeConnections.set(peerId, { peerId, roomId });

  logger.info(`[+] peer=${peerId} joined room=${roomId} via Edge WebSocket`);

  return new Response(
    JSON.stringify({ type: "peer-list", from: "server", payload: peerList }),
    {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    }
  );
}

async function handlePollJoin(request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json();
    const { room, peer, token } = body as { room?: string; peer?: string; token?: string };

    if (!room || !peer) {
      return new Response(JSON.stringify({ error: "Missing room or peer" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const authError = verifyRoomToken(token ?? null, room, JWT_SECRET);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const sessionId = generateSessionId();
    const peerList = rooms.addPeer(room, { peerId: peer, sessionId });

    const session: PollingSession = {
      sessionId,
      peerId: peer,
      roomId: room,
      messageQueue: [],
      lastActivity: Date.now(),
    };
    pollingSessions.set(sessionId, session);

    logger.info(`[+] peer=${peer} joined room=${room} via Edge polling`);

    return new Response(JSON.stringify({ sessionId, peerList }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

async function handlePollMessages(request: Request, headers: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  const roomId = url.searchParams.get("room");

  if (!sessionId || !roomId) {
    return new Response(JSON.stringify({ error: "Missing session or room" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const session = pollingSessions.get(sessionId);
  if (!session || session.roomId !== roomId) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  session.lastActivity = Date.now();

  if (session.messageQueue.length > 0) {
    const messages = session.messageQueue.splice(0);
    return new Response(JSON.stringify({ messages }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ messages: [] }), {
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-cache" },
  });
}

async function handlePollSend(request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json();
    const { session, room, message } = body as { session?: string; room?: string; message?: object };

    if (!session || !room || !message) {
      return new Response(JSON.stringify({ error: "Missing session, room, or message" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const sessionData = pollingSessions.get(session);
    if (!sessionData || sessionData.roomId !== room) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    sessionData.lastActivity = Date.now();

    const msg = message as Record<string, unknown>;
    msg.from = sessionData.peerId;

    relay.relay(room, sessionData.peerId, msg as any);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

async function handlePollLeave(request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json();
    const { session, room } = body as { session?: string; room?: string };

    if (!session || !room) {
      return new Response(JSON.stringify({ error: "Missing session or room" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const sessionData = pollingSessions.get(session);
    if (sessionData) {
      rooms.removePeer(room, sessionData.peerId);
      pollingSessions.delete(session);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}