import type { PeerEntry, SignalingMessage } from "./types.js";

export class RoomState {
  private rooms = new Map<string, Set<PeerEntry>>();

  getOrCreateRoom(roomId: string): Set<PeerEntry> {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Set();
      this.rooms.set(roomId, room);
    }
    return room;
  }

  addPeer(roomId: string, peer: PeerEntry): string[] {
    const room = this.getOrCreateRoom(roomId);
    room.add(peer);
    return [...room].filter((p) => p.peerId !== peer.peerId).map((p) => p.peerId);
  }

  removePeer(roomId: string, peerId: string): { roomEmpty: boolean; remainingPeers: string[] } {
    const room = this.rooms.get(roomId);
    if (!room) return { roomEmpty: true, remainingPeers: [] };

    for (const peer of room) {
      if (peer.peerId === peerId) {
        room.delete(peer);
        break;
      }
    }

    if (room.size === 0) {
      this.rooms.delete(roomId);
      return { roomEmpty: true, remainingPeers: [] };
    }

    return {
      roomEmpty: false,
      remainingPeers: [...room].filter((p) => p.peerId !== peerId).map((p) => p.peerId),
    };
  }

  getPeers(roomId: string): PeerEntry[] {
    const room = this.rooms.get(roomId);
    return room ? [...room] : [];
  }

  getPeer(roomId: string, peerId: string): PeerEntry | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    for (const peer of room) {
      if (peer.peerId === peerId) return peer;
    }
    return undefined;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getPeerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.size;
    }
    return count;
  }

  clearRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}

export interface MessageHandler {
  deliver(roomId: string, peerId: string, message: SignalingMessage): void;
}

export class SignalingRelay {
  constructor(
    private rooms: RoomState,
    private handler: MessageHandler,
    private logger: Record<string, (...args: unknown[]) => void>
  ) {}

  relay(roomId: string, senderPeerId: string, msg: SignalingMessage): void {
    const room = this.rooms.getPeers(roomId);
    if (!room || room.length === 0) return;

    const serialized = JSON.stringify(msg);

    if (msg.to !== undefined) {
      this.logger.debug(`[UNICAST] from=${senderPeerId} to=${msg.to}`);
      const target = room.find((p) => p.peerId === msg.to);
      if (target) {
        this.handler.deliver(roomId, target.peerId, JSON.parse(serialized));
      }
    } else {
      this.logger.debug(`[BROADCAST] from=${senderPeerId} room=${roomId}`);
      for (const peer of room) {
        if (peer.peerId !== senderPeerId) {
          this.handler.deliver(roomId, peer.peerId, JSON.parse(serialized));
        }
      }
    }
  }

  broadcast(roomId: string, excludePeerId: string, msg: SignalingMessage): void {
    const room = this.rooms.getPeers(roomId);
    if (!room) return;

    const serialized = JSON.stringify(msg);
    for (const peer of room) {
      if (peer.peerId !== excludePeerId) {
        this.handler.deliver(roomId, peer.peerId, JSON.parse(serialized));
      }
    }
  }
}