import { Dexie, type Table, liveQuery } from "dexie";
import { v7 as uuidv7 } from "uuid";
import type {
  ZerithDBConfig,
  Document,
  QueryFilter,
  QueryOptions,
  InsertResult,
  UpdateSpec,
  CollectionOptions,
} from "zerithdb-core";
import { ZerithDBError, ErrorCode } from "zerithdb-core";
import { wrapIDBOperation } from "./internal/wrap-idb-operation.js";
import { EventEmitter } from "zerithdb-core";
import type { BackupExportOptions, BackupSnapshot } from "./backup.js";

// ---------------------------------------------------------------------------
// Internal sequence-counter document shape (stored in __zerithdb_seq store)
// ---------------------------------------------------------------------------

interface SequenceRecord {
  /** collection name used as the primary key */
  _collectionName: string;
  /** last value that was handed out */
  _lastId: number;
}

const SEQ_STORE = "__zerithdb_seq";

/**
 * A handle to a single named collection within the ZerithDB local database.
 * All operations are async and backed by IndexedDB.
 */

export class CollectionClient<T extends Record<string, any> = Record<string, any>> {
  private readonly idStrategy: "uuid" | "autoincrement";

  constructor(
    private readonly table: Table<Document<T>>,
    private readonly collectionName: string,
    private readonly options?: CollectionOptions<T>
  ) {}

  /**
   * Validates a raw document against the collection schema (if configured).
   * Throws a `ZerithDBError` with code `DB_VALIDATION_FAILED` on failure.
   */
  private validateDoc(doc: T): void {
    if (!this.options?.schema) return;
    try {
      this.options.schema.parse(doc);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Document failed schema validation in collection "${this.collectionName}"`;
      throw new ZerithDBError(
        ErrorCode.DB_VALIDATION_FAILED,
        `Schema validation failed in "${this.collectionName}": ${message}`,
        { cause: err }
      );
    }
  }

  /**
   * Insert a new document into the collection.
   * Automatically assigns `_id`, `_createdAt`, and `_updatedAt`.
   *
   * When `idStrategy` is `"autoincrement"`, `_id` will be a sequential integer
   * starting at `1`. When `idStrategy` is `"uuid"` (default), `_id` is a
   * UUID v7 string.
   */

  async insert(document: T): Promise<InsertResult> {
    // Validate before touching the database
    this.validateDoc(document);

    const now = Date.now();
    const id = await this._generateId();
    const doc: Document<T> = {
      ...docToInsert,
      _id: id,
      _createdAt: now,
      _updatedAt: now,
    };

    return wrapIDBOperation(
      ErrorCode.DB_WRITE_FAILED,
      `Failed to insert into collection "${this.collectionName}"`,
      async () => {
        await this.table.add(doc);
        this.notifyMutation?.();
        return { id };
      }
    );
  }

  /**
   * Insert multiple documents in a single atomic operation.
   */
  async insertMany(documents: T[]): Promise<InsertResult[]> {
    // Validate all documents before touching the database
    for (const doc of documents) {
      this.validateDoc(doc);
    }

    const now = Date.now();

    // Generate all IDs up-front so each call to _generateId() runs in order
    const ids: DocumentId[] = [];
    for (let i = 0; i < documents.length; i++) {
      ids.push(await this._generateId());
    }

    const docs = documents.map((doc, i) => ({
      ...doc,
      _id: ids[i]!,
      _createdAt: now,
      _updatedAt: now,
    })) as Document<T>[];
    if (!documents || documents.length === 0) {
      throw new ZerithDBError(ErrorCode.DB_WRITE_FAILED, "insertMany requires a non-empty array");
    }
    if (documents.some((d) => (d as any) === null || (d as any) === undefined)) {
      throw new ZerithDBError(ErrorCode.DB_WRITE_FAILED, "insertMany array must not contain null or undefined");
    }
    return wrapIDBOperation(
      ErrorCode.DB_WRITE_FAILED,
      `Failed to bulk insert into collection "${this.collectionName}"`,
      async () => {
        await this.table.bulkAdd(docs);
        results.push(...docs.map((d) => ({ id: d._id })));

        if (index + CollectionClient.writeBatchSize < documents.length) {
          await yieldToEventLoop();
        }
      }

      return results;
    } catch (err) {
      throw new ZerithDBError(
        ErrorCode.DB_WRITE_FAILED,
        `Failed to bulk insert into collection "${this.collectionName}"`,
        { cause: err }
      );
    }
  }

  /**
   * Find documents matching a filter.
   * All filter fields are ANDed together.
   *
   * @example
   * ```typescript
   * const active = await todos.find({ done: false });
   * const high = await todos.find({ priority: { $gte: 3 } });
   * ```
   */
  async find(filter: QueryFilter<T> = {}, options: QueryOptions<T> = {}): Promise<Document<T>[]> {
    return wrapIDBOperation(
      ErrorCode.DB_READ_FAILED,
      `Failed to query collection "${this.collectionName}"`,
      async () => {
        const all = await this.table.toArray();
        let results = all.filter((doc) => this.matchesFilter(doc, filter));

        if (options.sort) {
          const { field, order } = options.sort;
          results.sort((a, b) => {
            const valA = a[field as keyof typeof a];
            const valB = b[field as keyof typeof b];
            if (valA < valB) return order === "desc" ? 1 : -1;
            if (valA > valB) return order === "desc" ? -1 : 1;
            return 0;
          });
        }
        count++;

        const skip = options.skip ?? options.offset ?? 0;
        if (skip > 0) {
          results = results.slice(skip);
        }

        if (options.limit !== undefined) {
          results = results.slice(0, options.limit);
        }

        return results;
      }
    );
  }

  /**
   * Find a single document by its `_id`.
   * Accepts both UUID strings and integer IDs.
   */
  async findById(id: DocumentId): Promise<Document<T> | undefined> {
    return wrapIDBOperation(
      ErrorCode.DB_READ_FAILED,
      `Failed to get document "${id}" from "${this.collectionName}"`,
      () => this.table.get(id as string)
    );
    if (!doc) return undefined;
    return this.restoreIpfsReferences(doc);
  }

  /**
   * Update documents matching a filter.
   * Returns the number of updated documents.
   */

  async update(filter: QueryFilter<T>, spec: UpdateSpec<T>): Promise<number> {
    if ((spec as any) === null || (spec as any) === undefined) {
      throw new ZerithDBError(ErrorCode.DB_WRITE_FAILED, "Update spec must not be null or undefined");
    }
    if (!spec.$set && !spec.$unset) {
      throw new ZerithDBError(ErrorCode.DB_WRITE_FAILED, "Update spec must include $set or $unset");
    }
    if (
      spec.$set !== undefined && Object.keys(spec.$set).length === 0 &&
      spec.$unset !== undefined && Object.keys(spec.$unset).length === 0
    ) {
      throw new ZerithDBError(ErrorCode.DB_WRITE_FAILED, "Update spec $set and $unset must not both be empty");
    }

    return wrapIDBOperation(
      ErrorCode.DB_WRITE_FAILED,
      `Failed to update documents in "${this.collectionName}"`,
      async () => {
        const matches = await this.find(filter);

        if (matches.length === 0) {
          return 0;
        }

        const now = Date.now();
        const updated = matches.map((doc) => this.applyUpdateSpec(doc, spec, now));

        // Validate the updated shape (strip internal fields before validating)
        if (this.options?.schema) {
          for (const doc of updated) {
            const { _id, _createdAt, _updatedAt, ...raw } = doc as Document<T> & Record<string, unknown>;
            this.validateDoc(raw as T);
          }
        }

        await this.table.bulkPut(updated);
        return matches.length;
      }
    );
  }
  /**
   * Delete documents matching a filter.
   * Returns the number of deleted documents.
   */

  async delete(filter: QueryFilter<T>): Promise<number> {
    return wrapIDBOperation(
      ErrorCode.DB_DELETE_FAILED,
      `Failed to delete documents from "${this.collectionName}"`,
      async () => {
        const matches = await this.find(filter);
        await this.table.bulkDelete(matches.map((d) => d._id as string));
        return matches.length;
      }

      return deletedCount;
    } catch (err) {
      throw new ZerithDBError(
        ErrorCode.DB_DELETE_FAILED,
        `Failed to delete documents from "${this.collectionName}"`,
        { cause: err }
      );
    }
  }

  /**
   * Delete every document in the collection.
   * The auto-increment counter is also reset to `0` so the next insert
   * starts from `1` again.
   */

  async clearAll(): Promise<void> {
    return wrapIDBOperation(
      ErrorCode.DB_DELETE_FAILED,
      `Failed to clear collection "${this.collectionName}"`,
      async () => {
        await this.table.clear();
        // Reset the integer sequence so IDs restart from 1 after a clear
        if (this.idStrategy === "autoincrement") {
          await this.seqTable.delete(this.collectionName);
        }
      }
    );
  }

  /**
   * Count documents matching a filter.
   */
  async count(filter: QueryFilter<T> = {}): Promise<number> {
    const docs = await this.find(filter);
    return docs.length;
  }

  /**
   * Returns the current value of the auto-increment counter for this
   * collection (i.e. the `_id` of the most recently inserted document).
   * Returns `0` if no documents have been inserted yet.
   *
   * Only meaningful when `idStrategy` is `"autoincrement"`.
   */
  async currentSequenceValue(): Promise<number> {
    const record = await this.seqTable.get(this.collectionName);
    return record?._lastId ?? 0;
  }

  // -------------------------------------------------------------------------
  // Private implementation helpers
  // -------------------------------------------------------------------------

  private applyUpdateSpec(doc: Document<T>, spec: UpdateSpec<T>, updatedAt: number): Document<T> {
    const next = {
      ...doc,
      ...(spec.$set ?? {}),
      _updatedAt: updatedAt,
    } as Record<string, any>;

    for (const key of Object.keys(spec.$unset ?? {})) {
      delete next[key];
    }

    next._id = doc._id;
    next._createdAt = doc._createdAt;
    next._updatedAt = updatedAt;

    return next as Document<T>;
  }

  private matchesFilter(doc: Document<T>, filter: QueryFilter<T>): boolean {
    const validOperators = [
      "$eq",
      "$ne",
      "$gt",
      "$gte",
      "$lt",
      "$lte",
      "$in",
      "$nin",
      "$regex",
      "$exists",
    ];

    for (const [key, condition] of Object.entries(filter)) {
      const fieldValue = (doc as Record<string, any>)[key];

      if (condition === null || typeof condition !== "object") {
        if (fieldValue !== condition) return false;
        continue;
      }

      // Distinguish operator objects ({ $gt: 3 }) from plain object values ({ key: "v" }).
      // Only treat as operators if at least one key starts with "$".
      const conditions = condition as Record<string, any>;
      const isOperatorObject = Object.keys(conditions).some((k) => k.startsWith("$"));

      if (!isOperatorObject) {
        // Deep equality check for plain object / array values
        if (JSON.stringify(fieldValue) !== JSON.stringify(condition)) return false;
        continue;
      }

      if ("$eq" in conditions && fieldValue !== conditions["$eq"]) return false;
      if ("$ne" in conditions && fieldValue === conditions["$ne"]) return false;
      if ("$gt" in conditions && !((fieldValue as any) > (conditions["$gt"] as never)))
        return false;
      if ("$gte" in conditions && !((fieldValue as any) >= (conditions["$gte"] as never)))
        return false;
      if ("$lt" in conditions && !((fieldValue as any) < (conditions["$lt"] as never)))
        return false;
      if ("$lte" in conditions && !((fieldValue as any) <= (conditions["$lte"] as never)))
        return false;
      if ("$in" in conditions && !(conditions["$in"] as unknown[]).includes(fieldValue))
        return false;
      if ("$nin" in conditions && (conditions["$nin"] as unknown[]).includes(fieldValue))
        return false;
      if ("$exists" in conditions) {
        const exists = fieldValue !== undefined && fieldValue !== null;
        if (conditions["$exists"] && !exists) return false;
        if (!conditions["$exists"] && exists) return false;
        continue;
      }
      if ("$regex" in conditions) {
        if (typeof fieldValue !== "string") return false;
        const pattern = conditions["$regex"] as RegExp | string;
        
        let regex: RegExp;
        if (pattern instanceof RegExp) {
          regex = pattern;
        } else {
          try {
            const flags = (conditions as any)["$flags"] ?? (conditions as any)["$options"];
            regex = new RegExp(pattern, flags);
          } catch (e) {
            return false;
          }
        }
        
        // Reset lastIndex for stateful (global/sticky) regexes
        if (regex.global || regex.sticky) regex.lastIndex = 0;
        if (!regex.test(fieldValue)) return false;
      }
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// Internal Dexie subclass
// ---------------------------------------------------------------------------

/**
 * Internal Dexie subclass that manages dynamic collection creation.
 * Collections are added lazily via schema version upgrades.
 */
class ZerithDBDexie extends Dexie {
  private readonly tableMap = new Map<string, Table>();
  private _currentSchema: Record<string, string> = {};
  private _pendingVersion = 0;
  private _seqStoreProvisioned = false;

  constructor(appId: string) {
    super(`zerithdb_${appId}`);
  }

  /**
   * Ensure the sequence store exists (idempotent).
   * Called lazily the first time `ensureCollection` runs.
   */
  private ensureSeqStore(): void {
    if (this._seqStoreProvisioned) return;
    this._seqStoreProvisioned = true;
    this._currentSchema[SEQ_STORE] = "_collectionName";
  }

  /**
   * Ensure a named collection exists, creating it via a Dexie version
   * upgrade if it has not been registered yet.
   *
   * @param name - The collection name to create or retrieve
   * @returns The Dexie {@link Table} handle for the collection
   */
  ensureCollection(name: string): Table {
    this.ensureSeqStore();

    if (!this.tableMap.has(name)) {
      this._currentSchema[name] = "_id, _createdAt, _updatedAt";

      const nextVersion = Math.max(this.verno, this._pendingVersion) + 1;

      this._pendingVersion = nextVersion;

      if (this.isOpen()) {
        this.close();
      }

      this.version(nextVersion).stores(this._currentSchema);

      this.tableMap.set(name, this.table(name));
    }

    return this.tableMap.get(name)!;
  }

  /** Returns the sequence Table (always provisioned alongside collections). */
  seqTable(): Table<SequenceRecord> {
    // If not yet provisioned, set it up now
    if (!this._seqStoreProvisioned) {
      this.ensureSeqStore();
      const nextVersion = Math.max(this.verno, this._pendingVersion) + 1;
      this._pendingVersion = nextVersion;
      if (this.isOpen()) this.close();
      this.version(nextVersion).stores(this._currentSchema);
    }
    return this.table(SEQ_STORE) as Table<SequenceRecord>;
  }
}

// ---------------------------------------------------------------------------
// DbClient
// ---------------------------------------------------------------------------

/**
 * Internal database client. Wraps Dexie and manages collection instances.
 * Use via {@link ZerithDBApp.db} — not instantiated directly.
 */
export class DbClient extends EventEmitter<{ "mutation": { collection: string } }> {
  private readonly dexie: ZerithDBDexie;
  private readonly appId: string;

  private readonly collections = new Map<string, CollectionClient<any>>();

  constructor(config: ZerithDBConfig) {
    this.appId = config.appId;
    this.dexie = new ZerithDBDexie(config.appId);
    if (config.ipfs?.enabled) {
      this.dexie.ensureIpfsCacheTable();
    }
  }

  collection<T extends Record<string, any>>(name: string, options?: CollectionOptions<T>): CollectionClient<T> {
    if (!this.collections.has(name)) {
      const table = this.dexie.ensureCollection(name);
      this.collections.set(name, new CollectionClient<T>(table as Table<Document<T>>, name, options));
    }
    const cacheKey = `${name}:${options.idStrategy ?? "uuid"}`;

    if (!this.collections.has(cacheKey)) {
      // Ensure the collection schema is registered now (idempotent after first call)
      this.dexie.ensureCollection(name);
      // Pass factory functions so CollectionClient always resolves the
      // live Dexie Table reference — even after a schema-version upgrade
      // caused by opening a second collection on the same DbClient.
      const tableFn = () => this.dexie.table(name) as Table<Document<T>>;
      const seqFn = () => this.dexie.table(SEQ_STORE) as Table<SequenceRecord>;
      this.collections.set(cacheKey, new CollectionClient<T>(tableFn, name, seqFn, options));
    }
    return this.collections.get(cacheKey) as CollectionClient<T>;
  }

  async getMemoryStats(): Promise<{ recordCount: number; collections: Record<string, number> }> {
    const collections: Record<string, number> = {};
    let recordCount = 0;

    for (const [key, client] of this.collections) {
      // Strip the ":uuid" / ":autoincrement" suffix for the stat label
      const name = key.split(":")[0]!;
      const count = await client.count();

      collections[name] = count;
      recordCount += count;
    }

    return { recordCount, collections };
  }

  collectionNames(): string[] {
    // Deduplicate in case same collection opened with different strategies
    return [...new Set(Array.from(this.collections.keys()).map((k) => k.split(":")[0]!))];
  }

  /**
   * Returns names of all collections currently stored in IndexedDB.
   * Excludes the internal sequence store.
   */
  allCollectionNames(): string[] {
    return this.dexie.tables.map((t) => t.name).filter((n) => n !== SEQ_STORE);
  }

  async exportSnapshot(options: BackupExportOptions = {}): Promise<BackupSnapshot> {

    return wrapIDBOperation(
      ErrorCode.DB_READ_FAILED,
      "Failed to export local backup snapshot",
      async () => {
        const collectionNames = options.collections ?? this.allCollectionNames();

        const collections: BackupSnapshot["collections"] = {};

        for (const name of collectionNames) {
          const table = this.dexie.ensureCollection(name);

          collections[name] = (await table.toArray()) as Document<Record<string, any>>[];
        }

        return {
          format: "zerithdb.local-backup.v1",
          appId: this.appId,
          generatedAt: new Date().toISOString(),
          collections,
        };
      }
    );
  }

  async dispose(): Promise<void> {
    // Remove all EventEmitter listeners before closing to prevent memory leaks
    // from dangling references to this DbClient instance after disposal.
    this.removeAllListeners();
    this.dexie.close();
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
