import { Hono } from "hono";
import type { InboxDO } from "../durable-objects/inbox.ts";
import type { DirectoryDO } from "../durable-objects/directory.ts";
import { extractTraceMetadata, extractLogMetadata } from "../lib/otlp.ts";

type Bindings = {
  INBOX_DO: DurableObjectNamespace<InboxDO>;
  DIRECTORY_DO: DurableObjectNamespace<DirectoryDO>;
};

export const ingestRoutes = new Hono<{ Bindings: Bindings }>();

// OTLP Traces ingest
ingestRoutes.post("/v1/traces", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const contentType = c.req.header("content-type") || "application/x-protobuf";

  // Get raw body
  const payload = new Uint8Array(await c.req.arrayBuffer());

  // Extract metadata from JSON payloads
  const metadata = extractTraceMetadata(payload, contentType);

  // Get inbox DO stub
  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  // Append event
  await stub.appendEvent({
    eventType: "trace",
    contentType,
    payload,
    metadata,
    timestamp: Date.now(),
  });

  // Update directory activity (fire and forget)
  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ingest"));

  // Return OTLP success response (empty object)
  return c.json({});
});

// OTLP Logs ingest
ingestRoutes.post("/v1/logs", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const contentType = c.req.header("content-type") || "application/x-protobuf";

  // Get raw body
  const payload = new Uint8Array(await c.req.arrayBuffer());

  // Extract metadata from JSON payloads
  const metadata = extractLogMetadata(payload, contentType);

  // Get inbox DO stub
  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  // Append event
  await stub.appendEvent({
    eventType: "log",
    contentType,
    payload,
    metadata,
    timestamp: Date.now(),
  });

  // Update directory activity (fire and forget)
  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ingest"));

  // Return OTLP success response
  return c.json({});
});

// OTLP Metrics ingest (placeholder - stores but doesn't parse)
ingestRoutes.post("/v1/metrics", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const contentType = c.req.header("content-type") || "application/x-protobuf";

  // Get raw body
  const payload = new Uint8Array(await c.req.arrayBuffer());

  // Get inbox DO stub
  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  // Append event
  await stub.appendEvent({
    eventType: "metric",
    contentType,
    payload,
    metadata: null,
    timestamp: Date.now(),
  });

  // Update directory activity (fire and forget)
  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ingest"));

  // Return OTLP success response
  return c.json({});
});
