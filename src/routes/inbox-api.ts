import { Hono } from "hono";
import type { InboxDO } from "../durable-objects/inbox.ts";
import type { DirectoryDO } from "../durable-objects/directory.ts";

type Bindings = {
  INBOX_DO: DurableObjectNamespace<InboxDO>;
  DIRECTORY_DO: DurableObjectNamespace<DirectoryDO>;
};

export const inboxApiRoutes = new Hono<{ Bindings: Bindings }>();

// Get events for an inbox
inboxApiRoutes.get("/api/events", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");
  const eventType = c.req.query("type") as "trace" | "log" | "metric" | undefined;
  const since = c.req.query("since") ? parseInt(c.req.query("since")!) : undefined;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const events = await stub.getEvents({ limit, offset, eventType, since });

  // Convert Uint8Array payloads to base64 for JSON transport
  const eventsJson = events.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    eventType: e.eventType,
    contentType: e.contentType,
    payloadSize: e.payload.length,
    metadata: e.metadata,
    createdAt: e.createdAt,
  }));

  return c.json({ events: eventsJson });
});

// Get single event with full payload
inboxApiRoutes.get("/api/events/:eventId", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const eventId = parseInt(c.req.param("eventId")!);

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const event = await stub.getEvent(eventId);

  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

  // Decode payload if JSON
  let payloadContent: string | null = null;
  if (event.contentType.includes("json")) {
    try {
      const json = JSON.parse(new TextDecoder().decode(event.payload));
      payloadContent = JSON.stringify(json, null, 2);
    } catch {
      payloadContent = new TextDecoder().decode(event.payload);
    }
  }

  return c.json({
    id: event.id,
    timestamp: event.timestamp,
    eventType: event.eventType,
    contentType: event.contentType,
    payloadSize: event.payload.length,
    payloadContent,
    metadata: event.metadata,
    createdAt: event.createdAt,
  });
});

// Get raw payload as binary
inboxApiRoutes.get("/api/events/:eventId/raw", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const eventId = parseInt(c.req.param("eventId")!);

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const event = await stub.getEvent(eventId);

  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

  return new Response(event.payload, {
    headers: {
      "Content-Type": event.contentType,
      "Content-Disposition": `attachment; filename="event-${eventId}.bin"`,
    },
  });
});

// Get stats for an inbox
inboxApiRoutes.get("/api/stats", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const stats = await stub.getStats();

  return c.json(stats);
});
