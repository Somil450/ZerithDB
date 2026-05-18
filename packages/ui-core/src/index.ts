import { EventEmitter } from "zerithdb-core";
import type { ZerithDBApp, CollectionName, DocumentId } from "zerithdb-sdk";

export class FieldBinder<T = any> extends EventEmitter<Record<string, any>> {
  private app: ZerithDBApp;
  private collection: CollectionName;
  private id: DocumentId;
  private field: string;
  private value: T | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(app: ZerithDBApp, collection: CollectionName, id: DocumentId, field: string) {
    super();
    this.app = app;
    this.collection = collection;
    this.id = id;
    this.field = field;
  }

  public async bind() {
    // Initial fetch
    const doc = await this.app.db(this.collection).findById(this.id);
    if (doc) {
      this.value = doc[this.field] as T;
      this.emit("change", this.value);
    }

    // Subscribe to changes (assuming a sync event or liveQuery integration, simplified here)
    const handleStateChange = async () => {
      const updated = await this.app.db(this.collection).findById(this.id);
      if (updated && updated[this.field] !== this.value) {
        this.value = updated[this.field] as T;
        this.emit("change", this.value);
      }
    };

    this.app.sync.on("state:change", handleStateChange);
    this.unsubscribe = () => {
      this.app.sync.off("state:change", handleStateChange);
    };
  }

  public unbind() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  public async update(newValue: T) {
    const oldValue = this.value;
    
    // Optimistic UI update
    this.value = newValue;
    this.emit("change", this.value);

    try {
      await this.app.db(this.collection).update({ _id: this.id }, {
        $set: { [this.field]: newValue }
      });
    } catch (err) {
      // Rollback on validation failure
      this.value = oldValue;
      this.emit("change", this.value);
      this.emit("error", err);
    }
  }
  
  public getValue(): T | null {
    return this.value;
  }
}

export class PresenceManager extends EventEmitter<Record<string, any>> {
  private app: ZerithDBApp;
  private collection: CollectionName;
  private id: DocumentId;
  private field: string;
  private activePeers: Map<string, any> = new Map();

  constructor(app: ZerithDBApp, collection: CollectionName, id: DocumentId, field: string) {
    super();
    this.app = app;
    this.collection = collection;
    this.id = id;
    this.field = field;
  }
  
  public bind() {
     // Mock presence binding for the specified field
     // In a real implementation this would hook into app.sync's awareness/ephemeral state
     this.emit("presence:change", Array.from(this.activePeers.entries()));
  }
  
  public unbind() {
     // Cleanup
  }
  
  public setPresence(state: any) {
     // Broadcast ephemeral state
     this.emit("presence:update", state);
  }
}
