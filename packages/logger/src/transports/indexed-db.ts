import type { Transport, LogEntry, IndexedDBTransportConfig, LogQuery } from "../core/types.js";

const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_STORE_NAME = "logs";

/**
 * Transport that persists log entries to IndexedDB.
 * Supports querying by level, tag, date range, and automatic rotation.
 */
export class IndexedDBTransport implements Transport {
  readonly name = "indexeddb";

  private readonly dbName: string;
  private readonly storeName: string;
  private readonly maxEntries: number;
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;

  constructor(config: IndexedDBTransportConfig) {
    this.dbName = config.dbName;
    this.storeName = config.storeName ?? DEFAULT_STORE_NAME;
    this.maxEntries = config.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.dbReady = this.open();
  }

  async log(entry: LogEntry): Promise<void> {
    const db = await this.dbReady;
    await this.put(db, entry);
    await this.rotate(db);
  }

  async query(query: LogQuery): Promise<LogEntry[]> {
    const db = await this.dbReady;
    return this.getAll(db, query);
  }

  async clear(): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async count(): Promise<number> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async dispose(): Promise<void> {
    const db = await this.dbReady;
    db.close();
    this.db = null;
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("level", "level", { unique: false });
          store.createIndex("tag", "tag", { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private put(db: IDBDatabase, entry: LogEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async rotate(db: IDBDatabase): Promise<void> {
    const currentCount = await this.countEntries(db);
    if (currentCount <= this.maxEntries) return;

    const excess = currentCount - this.maxEntries;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const index = store.index("timestamp");
      const req = index.openCursor();
      let deleted = 0;

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && deleted < excess) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  private countEntries(db: IDBDatabase): Promise<number> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private getAll(db: IDBDatabase, query: LogQuery): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.index("timestamp").openCursor(null, "prev");
      const results: LogEntry[] = [];

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(results);
          return;
        }

        const entry = cursor.value as LogEntry;

        if (query.level !== undefined && entry.level < query.level) {
          cursor.continue();
          return;
        }

        if (query.tag && !entry.tag.startsWith(query.tag)) {
          cursor.continue();
          return;
        }

        if (query.since && new Date(entry.timestamp) < query.since) {
          cursor.continue();
          return;
        }

        if (query.until && new Date(entry.timestamp) > query.until) {
          cursor.continue();
          return;
        }

        results.push(entry);

        if (query.limit && results.length >= query.limit) {
          resolve(results);
          return;
        }

        cursor.continue();
      };

      req.onerror = () => reject(req.error);
    });
  }
}
