/**
 * @internal
 * Application-level metrics for the ZerithDB signaling server.
 *
 * Exposes observable gauges and counters that are collected by the
 * OpenTelemetry SDK and exported via OTLP to Datadog / Jaeger.
 *
 * Usage:
 *   import { recordPeerJoined, recordPeerLeft, recordMessageRelayed } from "./metrics.js";
 */

import {
  metrics,
  type ObservableResult,
  type Counter,
  type ObservableGauge,
} from "@opentelemetry/api";

type MessageRelayedAttributes = {
  "relay.type": "unicast" | "broadcast";
  transport: "ws" | "poll";
};

type PeerJoinedAttributes = {
  transport: "ws" | "poll";
};

type PeerLeftAttributes = {
  transport: "ws" | "poll";
  reason: "graceful" | "timeout" | "error";
};

type RoomsActiveAttributes = Record<string, never>;
type PeersActiveAttributes = Record<string, never>;
type PollingSessionsActiveAttributes = Record<string, never>;

const meter = metrics.getMeter("zerithdb-signaling", "0.1.0");

// ─── Counters ────────────────────────────────────────────────────────────────

/**
 * Total number of signaling messages relayed since process start.
 * Tagged with `relay.type` = "unicast" | "broadcast" and `transport` = "ws" | "poll".
 */
const messagesRelayedCounter: Counter<MessageRelayedAttributes> =
  meter.createCounter<MessageRelayedAttributes>("zerithdb.signaling.messages_relayed", {
    description: "Total signaling messages relayed between peers",
    unit: "messages",
  });

/**
 * Total number of peers that have joined rooms since process start.
 * Tagged with `transport` = "ws" | "poll".
 */
const peersJoinedCounter: Counter<PeerJoinedAttributes> = meter.createCounter<PeerJoinedAttributes>(
  "zerithdb.signaling.peers_joined",
  {
    description: "Total peers that have joined a room",
    unit: "peers",
  }
);

/**
 * Total number of peers that have left rooms since process start.
 * Tagged with `transport` = "ws" | "poll" and `reason` = "graceful" | "timeout" | "error".
 */
const peersLeftCounter: Counter<PeerLeftAttributes> = meter.createCounter<PeerLeftAttributes>(
  "zerithdb.signaling.peers_left",
  {
    description: "Total peers that have left a room",
    unit: "peers",
  }
);

// ─── Observable gauges (backed by live state maps) ───────────────────────────

/** Callback references so the gauges can read live state. */
let getRoomCount: () => number = () => 0;
let getPeerCount: () => number = () => 0;
let getPollingSessionCount: () => number = () => 0;

const roomsActiveGauge: ObservableGauge<RoomsActiveAttributes> =
  meter.createObservableGauge<RoomsActiveAttributes>("zerithdb.signaling.rooms_active", {
    description: "Number of currently active rooms",
    unit: "rooms",
  });
roomsActiveGauge.addCallback((result: ObservableResult<RoomsActiveAttributes>) => {
  result.observe(getRoomCount());
});

const peersActiveGauge: ObservableGauge<PeersActiveAttributes> =
  meter.createObservableGauge<PeersActiveAttributes>("zerithdb.signaling.peers_active", {
    description: "Total number of currently connected peers across all rooms",
    unit: "peers",
  });
peersActiveGauge.addCallback((result: ObservableResult<PeersActiveAttributes>) => {
  result.observe(getPeerCount());
});

const pollingSessionsActiveGauge: ObservableGauge<PollingSessionsActiveAttributes> =
  meter.createObservableGauge<PollingSessionsActiveAttributes>(
    "zerithdb.signaling.polling_sessions_active",
    {
      description: "Number of currently active long-polling sessions",
      unit: "sessions",
    }
  );
pollingSessionsActiveGauge.addCallback(
  (result: ObservableResult<PollingSessionsActiveAttributes>) => {
    result.observe(getPollingSessionCount());
  }
);

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register live-state provider callbacks so the observable gauges can
 * read current values at export time.
 *
 * Call once during server initialisation, passing accessors to the
 * `rooms` and `pollingSessions` maps.
 */
export function registerStateProviders(providers: {
  getRoomCount: () => number;
  getPeerCount: () => number;
  getPollingSessionCount: () => number;
}): void {
  getRoomCount = providers.getRoomCount;
  getPeerCount = providers.getPeerCount;
  getPollingSessionCount = providers.getPollingSessionCount;
}

/** Record a message relay event. */
export function recordMessageRelayed(
  relayType: "unicast" | "broadcast",
  transport: "ws" | "poll"
): void {
  messagesRelayedCounter.add(1, { "relay.type": relayType, transport });
}

/** Record a peer joining a room. */
export function recordPeerJoined(transport: "ws" | "poll"): void {
  peersJoinedCounter.add(1, { transport });
}

/** Record a peer leaving a room. */
export function recordPeerLeft(
  transport: "ws" | "poll",
  reason: "graceful" | "timeout" | "error"
): void {
  peersLeftCounter.add(1, { transport, reason });
}
