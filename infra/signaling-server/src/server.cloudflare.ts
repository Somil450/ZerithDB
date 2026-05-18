/// <reference types="@cloudflare/workers-types" />

import { createLogger, generateSessionId, verifyRoomToken, getEnv } from "./internal/types.js";
import { RoomState, SignalingRelay } from "./internal/room-state.js";

const LOG_LEVEL = (getEnv("LOG_LEVEL") || "info") as "debug" | "info" | "warn" | "error";
const JWT_SECRET = getEnv("JWT_SECRET");
const VERSION = "0.1.0";

declare const WebSocketPair: {
  new (): { server: WebSocket; client: WebSocket };
};

const logger = createLogger(LOG_LEVEL);

const rooms = new RoomState();

const messageHandler = {
  deliver: (_roomId: string, peerId: string, _message: unknown): void => {
    logger.debug(`[DELIVER] to=${peerId}`);
  },
};

const relay = new SignalingRelay(rooms, messageHandler, logger);

interface CloudflarePeer {
  peerId?: string;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

const activeConnections = new Map<number, CloudflarePeer>();

let connectionCounter = 0;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return handleHealth(request);
    }

    if (url.pathname === "/ws") {
      return handleWebSocket(request);
    }

    if (url.pathname === "/poll/join" && request.method === "POST") {
      return handlePollJoin(request);
    }

    if (url.pathname === "/poll/messages" && request.method === "GET") {
      return handlePollMessages(request);
    }

    if (url.pathname === "/poll/send" && request.method === "POST") {
      return handlePollSend(request);
    }

    if (url.pathname === "/poll/leave" && request.method === "POST") {
      return handlePollLeave(request);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function handleHealth(request: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json" };

  return new Response(
    JSON.stringify({
      status: "ok",
      service: "zerithdb-signaling",
      version: VERSION,
      platform: "cloudflare-workers",
      active_connections: activeConnections.size,
      rooms: rooms.getRoomCount(),
      peers: rooms.getPeerCount(),
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers }
  );
}

async function handleWebSocket(request: Request): Promise<Response> {
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const url = new URL(request.url);
  const roomId = url.searchParams.get("room");
  const peerId = url.searchParams.get("peer");
  const token = url.searchParams.get("token");

  if (!roomId || !peerId) {
    return new Response("Missing room or peer query parameters", { status: 400 });
  }

  const authError = verifyRoomToken(token, roomId, JWT_SECRET);
  if (authError) {
    return new Response(authError, { status: 401 });
  }

  const pair = new WebSocketPair();
  const client = pair.client;

  const connId = ++connectionCounter;
  (client as CloudflarePeer).peerId = peerId;
  activeConnections.set(connId, client as CloudflarePeer);

  const peerList = rooms.addPeer(roomId, { peerId });

  logger.info(`[+] peer=${peerId} joined room=${roomId} via WebSocket`);

  client.addEventListener("message", (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string);
      msg.from = peerId;
      relay.relay(roomId, peerId, msg);
    } catch {
      logger.warn(`[!] Invalid message from peer=${peerId}`);
    }
  });

  client.addEventListener("close", () => {
    activeConnections.delete(connId);
    const result = rooms.removePeer(roomId, peerId);
    logger.info(`[-] peer=${peerId} left room=${roomId}`);
    if (!result.roomEmpty && result.remainingPeers.length > 0) {
      broadcastToConnections(roomId, peerId, {
        type: "peer-left",
        from: "server",
        payload: peerId,
      });
    }
  });

  client.send(JSON.stringify({ type: "peer-list", from: "server", payload: peerList }));

  return new Response(null, {
    status: 101,
    webSocket: pair.server,
  } as ResponseInit);
}

function broadcastToConnections(roomId: string, excludePeerId: string, msg: object): void {
  const peers = rooms.getPeers(roomId);
  for (const peer of peers) {
    if (peer.peerId === excludePeerId) continue;
    for (const [, conn] of activeConnections) {
      if (conn.peerId === peer.peerId) {
        conn.send(JSON.stringify(msg));
        break;
      }
    }
  }
}

interface PollingSession {
  sessionId: string;
  peerId: string;
  roomId: string;
  messageQueue: string[];
  lastActivity: number;
}

const pollingSessions = new Map<string, PollingSession>();

async function handlePollJoin(request: Request): Promise<Response> {
  const body = await request.json();
  const { room, peer, token } = body as { room?: string; peer?: string; token?: string };

  if (!room || !peer) {
    return new Response(JSON.stringify({ error: "Missing room or peer" }), { status: 400 });
  }

  const authError = verifyRoomToken(token ?? null, room, JWT_SECRET);
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), { status: 401 });
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

  logger.info(`[+] peer=${peer} joined room=${room} via HTTP polling`);

  return new Response(JSON.stringify({ sessionId, peerList }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handlePollMessages(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  const roomId = url.searchParams.get("room");

  if (!sessionId || !roomId) {
    return new Response(JSON.stringify({ error: "Missing session or room" }), { status: 400 });
  }

  const session = pollingSessions.get(sessionId);
  if (!session || session.roomId !== roomId) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  session.lastActivity = Date.now();

  if (session.messageQueue.length > 0) {
    const messages = session.messageQueue.splice(0);
    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const waitTime = 5000;
  const startTime = Date.now();

  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (session.messageQueue.length > 0 || Date.now() - startTime >= waitTime) {
        clearInterval(checkInterval);
        resolve(true);
      }
    }, 500);
  });

  if (session.messageQueue.length > 0) {
    const messages = session.messageQueue.splice(0);
    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ messages: [] }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
  });
}

async function handlePollSend(request: Request): Promise<Response> {
  const body = await request.json();
  const { session, room, message } = body as { session?: string; room?: string; message?: object };

  if (!session || !room || !message) {
    return new Response(JSON.stringify({ error: "Missing session, room, or message" }), { status: 400 });
  }

  const sessionData = pollingSessions.get(session);
  if (!sessionData || sessionData.roomId !== room) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  sessionData.lastActivity = Date.now();

  const msg = message as Record<string, unknown>;
  msg.from = sessionData.peerId;

  relay.relay(room, sessionData.peerId, msg as any);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handlePollLeave(request: Request): Promise<Response> {
  const body = await request.json();
  const { session, room } = body as { session?: string; room?: string };

  if (!session || !room) {
    return new Response(JSON.stringify({ error: "Missing session or room" }), { status: 400 });
  }

  const sessionData = pollingSessions.get(session);
  if (sessionData) {
    rooms.removePeer(room, sessionData.peerId);
    pollingSessions.delete(session);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}