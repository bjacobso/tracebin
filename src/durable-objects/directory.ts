import { DurableObject } from "cloudflare:workers";
import type { InboxInfo } from "../lib/types.ts";

// 7 days in milliseconds
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class DirectoryDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  private ensureInitialized() {
    if (this.initialized) return;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS inboxes (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_ingest_at INTEGER,
        last_ui_at INTEGER,
        secret_token TEXT NOT NULL,
        display_name TEXT
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_last_activity ON inboxes(
        COALESCE(last_ingest_at, last_ui_at, created_at)
      )
    `);

    this.initialized = true;

    // Schedule cleanup alarm
    this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000); // 1 hour
  }

  /**
   * Generate a random token
   */
  private generateToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Generate a random inbox ID
   */
  private generateInboxId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Create a new inbox
   */
  async createInbox(displayName?: string): Promise<InboxInfo> {
    this.ensureInitialized();

    const id = this.generateInboxId();
    const secretToken = this.generateToken();
    const now = Date.now();

    this.sql.exec(
      `INSERT INTO inboxes (id, created_at, secret_token, display_name)
       VALUES (?, ?, ?, ?)`,
      id,
      now,
      secretToken,
      displayName ?? null
    );

    return {
      id,
      createdAt: now,
      lastIngestAt: null,
      lastUiAt: null,
      secretToken,
      displayName: displayName ?? null,
    };
  }

  /**
   * Get inbox info by ID
   */
  async getInbox(inboxId: string): Promise<InboxInfo | null> {
    this.ensureInitialized();

    const cursor = this.sql.exec(
      `SELECT id, created_at, last_ingest_at, last_ui_at, secret_token, display_name
       FROM inboxes WHERE id = ?`,
      inboxId
    );

    for (const row of cursor) {
      return {
        id: row.id as string,
        createdAt: row.created_at as number,
        lastIngestAt: row.last_ingest_at as number | null,
        lastUiAt: row.last_ui_at as number | null,
        secretToken: row.secret_token as string,
        displayName: row.display_name as string | null,
      };
    }

    return null;
  }

  /**
   * List all inboxes
   */
  async listInboxes(): Promise<InboxInfo[]> {
    this.ensureInitialized();

    const cursor = this.sql.exec(
      `SELECT id, created_at, last_ingest_at, last_ui_at, secret_token, display_name
       FROM inboxes ORDER BY created_at DESC`
    );

    const results: InboxInfo[] = [];
    for (const row of cursor) {
      results.push({
        id: row.id as string,
        createdAt: row.created_at as number,
        lastIngestAt: row.last_ingest_at as number | null,
        lastUiAt: row.last_ui_at as number | null,
        secretToken: row.secret_token as string,
        displayName: row.display_name as string | null,
      });
    }

    return results;
  }

  /**
   * Update activity timestamp
   */
  async touchInbox(inboxId: string, type: "ingest" | "ui"): Promise<void> {
    this.ensureInitialized();

    const column = type === "ingest" ? "last_ingest_at" : "last_ui_at";
    this.sql.exec(
      `UPDATE inboxes SET ${column} = ? WHERE id = ?`,
      Date.now(),
      inboxId
    );
  }

  /**
   * Delete an inbox
   */
  async deleteInbox(inboxId: string): Promise<void> {
    this.ensureInitialized();
    this.sql.exec(`DELETE FROM inboxes WHERE id = ?`, inboxId);
  }

  /**
   * Clean up expired inboxes
   */
  async cleanupExpired(ttlMs: number = DEFAULT_TTL_MS): Promise<number> {
    this.ensureInitialized();

    const expireBefore = Date.now() - ttlMs;

    // Get count of expired
    const countCursor = this.sql.exec(
      `SELECT COUNT(*) as count FROM inboxes
       WHERE COALESCE(last_ingest_at, last_ui_at, created_at) < ?`,
      expireBefore
    );

    let count = 0;
    for (const row of countCursor) {
      count = row.count as number;
    }

    // Delete expired
    this.sql.exec(
      `DELETE FROM inboxes
       WHERE COALESCE(last_ingest_at, last_ui_at, created_at) < ?`,
      expireBefore
    );

    return count;
  }

  /**
   * Alarm handler for periodic cleanup
   */
  async alarm(): Promise<void> {
    const deleted = await this.cleanupExpired();
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} expired inboxes`);
    }

    // Reschedule alarm for next hour
    this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
  }
}
