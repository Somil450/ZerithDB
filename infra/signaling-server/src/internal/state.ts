export interface StateBackend {
  getRoom(roomId: string): Promise<RoomData | null>;
  setRoom(roomId: string, data: RoomData): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  setSession(sessionId: string, data: SessionData): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface RoomData {
  roomId: string;
  peers: Map<string, PeerData>;
  updatedAt: number;
}

export interface PeerData {
  peerId: string;
  sessionId?: string;
}

export interface SessionData {
  sessionId: string;
  peerId: string;
  roomId: string;
  messageQueue: string[];
  lastActivity: number;
}

export class InMemoryState implements StateBackend {
  private rooms = new Map<string, RoomData>();
  private sessions = new Map<string, SessionData>();

  async getRoom(roomId: string): Promise<RoomData | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async setRoom(roomId: string, data: RoomData): Promise<void> {
    this.rooms.set(roomId, data);
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async setSession(sessionId: string, data: SessionData): Promise<void> {
    this.sessions.set(sessionId, data);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export function createStateBackend(): StateBackend {
  return new InMemoryState();
}