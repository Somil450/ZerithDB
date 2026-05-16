import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

const PORT = parseInt(process.env["PORT"] ?? "4000", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";
type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL = (process.env["LOG_LEVEL"] ?? "info") as LogLevel;
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[LOG_LEVEL];
};
const logger = {
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

// roomId → Set of { peerId, ws }
const rooms = new Map<string, Set<{ peerId: string; ws: WebSocket }>>();

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      service: "zerithdb-signaling",
      version: "0.1.0",
      rooms: rooms.size,
      peers: [...rooms.values()].reduce((acc, s) => acc + s.size, 0),
    })
  );
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  // Use a dummy base for parsing relative URLs
  const url = new URL(req.url ?? "/", "http://localhost");
  const roomId = url.searchParams.get("room");
  const peerId = url.searchParams.get("peer");

  if (!roomId || !peerId) {
    logger.warn(`[!] Rejected connection from ${req.socket.remoteAddress}: missing params`);
    ws.close(1008, "Missing room or peer query parameters");
    return;
  }

  // Ensure room exists
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  const room = rooms.get(roomId)!;

  // Add peer to room
  const peerEntry = { peerId, ws };
  room.add(peerEntry);

  logger.info(`[+] peer=${peerId} joined room=${roomId} (room size: ${room.size})`);

  // Send the new peer the list of existing peers
  const existingPeerIds = [...room].filter((p) => p.peerId !== peerId).map((p) => p.peerId);

  ws.send(JSON.stringify({ type: "peer-list", from: "server", payload: existingPeerIds }));

  // Relay messages between peers
  ws.on("message", (data) => {
    let msg: { to?: string; from?: string; [key: string]: unknown };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return; // Ignore malformed messages
    }

    // Stamp the sender
    msg.from = peerId;

    const serialized = JSON.stringify(msg);

    if (msg["to"] !== undefined) {
      // Unicast to a specific peer
      const target = [...room].find((p) => p.peerId === msg["to"]);
      if (target?.ws.readyState === WebSocket.OPEN) {
        target.ws.send(serialized);
      }
    } else {
      // Broadcast to all peers in the room except sender
      for (const peer of room) {
        if (peer.peerId !== peerId && peer.ws.readyState === WebSocket.OPEN) {
          peer.ws.send(serialized);
        }
      }
    }
  });

  ws.on("close", () => {
    room.delete(peerEntry);
    logger.info(`[-] peer=${peerId} left room=${roomId} (room size: ${room.size})`);
    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
    } else {
      // Notify remaining peers
      const leaveMsg = JSON.stringify({ type: "peer-left", from: "server", payload: peerId });
      for (const peer of room) {
        if (peer.ws.readyState === WebSocket.OPEN) {
          peer.ws.send(leaveMsg);
        }
      }
    }
  });

  ws.on("error", (err) => {
    logger.error(`[!] peer=${peerId} error:`, err.message);
    room.delete(peerEntry);
  });
});

server.listen(PORT, HOST, () => {
  logger.info(`🚀 ZerithDB Signaling Server running at ws://${HOST}:${PORT}`);
  logger.info(`   HTTP health check: http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Shutting down signaling server...");
  wss.close(() => server.close(() => process.exit(0)));
});
