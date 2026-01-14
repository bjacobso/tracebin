import { DurableObject } from "cloudflare:workers";
import type {
  StoredEvent,
  IngestEvent,
  RollupStats,
  GetEventsOptions,
} from "../lib/types.ts";

const MAX_EVENTS = 5000;

export class InboxDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  private ensureInitialized() {
    if (this.initialized) return;

    // Create events table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        content_type TEXT NOT NULL,
        payload BLOB NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Create indexes
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp DESC)
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type, timestamp DESC)
    `);

    this.initialized = true;
  }

  /**
   * Append a new event to storage
   */
  async appendEvent(event: IngestEvent): Promise<void> {
    this.ensureInitialized();

    const metadataJson = event.metadata ? JSON.stringify(event.metadata) : null;

    this.sql.exec(
      `INSERT INTO events (timestamp, event_type, content_type, payload, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      event.timestamp,
      event.eventType,
      event.contentType,
      event.payload,
      metadataJson,
      Date.now()
    );

    // Enforce retention - keep only last MAX_EVENTS
    this.enforceRetention();
  }

  /**
   * Get recent events with optional filtering
   */
  async getEvents(options: GetEventsOptions = {}): Promise<StoredEvent[]> {
    this.ensureInitialized();

    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    let query = `SELECT id, timestamp, event_type, content_type, payload, metadata, created_at FROM events`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (options.eventType) {
      conditions.push(`event_type = ?`);
      params.push(options.eventType);
    }

    if (options.since) {
      conditions.push(`timestamp >= ?`);
      params.push(options.since);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const cursor = this.sql.exec(query, ...params);
    const results: StoredEvent[] = [];

    for (const row of cursor) {
      results.push({
        id: row.id as number,
        timestamp: row.timestamp as number,
        eventType: row.event_type as "trace" | "log" | "metric",
        contentType: row.content_type as string,
        payload: new Uint8Array(row.payload as ArrayBuffer),
        metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
        createdAt: row.created_at as number,
      });
    }

    return results;
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: number): Promise<StoredEvent | null> {
    this.ensureInitialized();

    const cursor = this.sql.exec(
      `SELECT id, timestamp, event_type, content_type, payload, metadata, created_at
       FROM events WHERE id = ?`,
      eventId
    );

    for (const row of cursor) {
      return {
        id: row.id as number,
        timestamp: row.timestamp as number,
        eventType: row.event_type as "trace" | "log" | "metric",
        contentType: row.content_type as string,
        payload: new Uint8Array(row.payload as ArrayBuffer),
        metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
        createdAt: row.created_at as number,
      };
    }

    return null;
  }

  /**
   * Get rollup statistics
   */
  async getStats(): Promise<RollupStats> {
    this.ensureInitialized();

    // Total count
    const totalCursor = this.sql.exec(`SELECT COUNT(*) as count FROM events`);
    let totalEvents = 0;
    for (const row of totalCursor) {
      totalEvents = row.count as number;
    }

    // Last received
    const lastCursor = this.sql.exec(
      `SELECT MAX(timestamp) as last_ts FROM events`
    );
    let lastReceived: number | null = null;
    for (const row of lastCursor) {
      lastReceived = row.last_ts as number | null;
    }

    // Events by type
    const typeCursor = this.sql.exec(
      `SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type`
    );
    const eventsByType: Record<string, number> = {};
    for (const row of typeCursor) {
      eventsByType[row.event_type as string] = row.count as number;
    }

    // Events in last minute
    const oneMinuteAgo = Date.now() - 60000;
    const rateCursor = this.sql.exec(
      `SELECT COUNT(*) as count FROM events WHERE timestamp >= ?`,
      oneMinuteAgo
    );
    let eventsPerMinute = 0;
    for (const row of rateCursor) {
      eventsPerMinute = row.count as number;
    }

    return {
      totalEvents,
      lastReceived,
      eventsByType,
      eventsPerMinute,
    };
  }

  /**
   * Enforce retention by keeping only the last MAX_EVENTS
   */
  private enforceRetention(): void {
    this.sql.exec(
      `DELETE FROM events WHERE id NOT IN (
        SELECT id FROM events ORDER BY timestamp DESC LIMIT ?
      )`,
      MAX_EVENTS
    );
  }
}
