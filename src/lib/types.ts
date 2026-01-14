// Event types stored in InboxDO
export interface StoredEvent {
  id: number;
  timestamp: number;
  eventType: "trace" | "log" | "metric";
  contentType: string;
  payload: Uint8Array;
  metadata: EventMetadata | null;
  createdAt: number;
}

export interface EventMetadata {
  spanCount?: number;
  serviceNames?: string[];
  logLevel?: string;
  traceId?: string;
}

// Input for appending events
export interface IngestEvent {
  eventType: "trace" | "log" | "metric";
  contentType: string;
  payload: Uint8Array;
  metadata: EventMetadata | null;
  timestamp: number;
}

// Inbox info from DirectoryDO
export interface InboxInfo {
  id: string;
  createdAt: number;
  lastIngestAt: number | null;
  lastUiAt: number | null;
  secretToken: string;
  displayName: string | null;
}

// Rollup stats
export interface RollupStats {
  totalEvents: number;
  lastReceived: number | null;
  eventsByType: Record<string, number>;
  eventsPerMinute: number;
}

// Options for querying events
export interface GetEventsOptions {
  limit?: number;
  offset?: number;
  eventType?: "trace" | "log" | "metric";
  since?: number;
}
