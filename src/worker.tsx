import { Hono } from "hono";
import { cors } from "hono/cors";
import type { InboxDO } from "./durable-objects/inbox.ts";
import type { DirectoryDO } from "./durable-objects/directory.ts";
import { Layout } from "./ui/components/Layout.tsx";
import { EventList } from "./ui/components/EventList.tsx";
import { RawViewer } from "./ui/components/RawViewer.tsx";
import { extractTraceMetadata, extractLogMetadata } from "./lib/otlp.ts";
import { generateDemoTraces, generateDemoLogs } from "./lib/demo-data.ts";

// Re-export Durable Object classes
export { InboxDO } from "./durable-objects/inbox.ts";
export { DirectoryDO } from "./durable-objects/directory.ts";

type Bindings = {
  INBOX_DO: DurableObjectNamespace<InboxDO>;
  DIRECTORY_DO: DurableObjectNamespace<DirectoryDO>;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for API endpoints
app.use("/api/*", cors());
app.use("/i/:inboxId/api/*", cors());

// ==================== Top-level API routes ====================

// Create inbox
app.post("/api/inboxes", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const displayName = body.displayName as string | undefined;

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  const inbox = await dirStub.createInbox(displayName);

  const origin = new URL(c.req.url).origin;
  const inboxUrl = `${origin}/i/${inbox.id}`;

  return c.json({
    id: inbox.id,
    displayName: inbox.displayName,
    createdAt: inbox.createdAt,
    secretToken: inbox.secretToken,
    urls: {
      ui: `${inboxUrl}/ui`,
      traces: `${inboxUrl}/v1/traces`,
      logs: `${inboxUrl}/v1/logs`,
      metrics: `${inboxUrl}/v1/metrics`,
    },
  });
});

// List inboxes
app.get("/api/inboxes", async (c) => {
  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  const inboxes = await dirStub.listInboxes();

  return c.json(
    inboxes.map((inbox) => ({
      id: inbox.id,
      displayName: inbox.displayName,
      createdAt: inbox.createdAt,
      lastIngestAt: inbox.lastIngestAt,
      lastUiAt: inbox.lastUiAt,
    }))
  );
});

// Get inbox info
app.get("/api/inboxes/:id", async (c) => {
  const inboxId = c.req.param("id")!;

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  const inbox = await dirStub.getInbox(inboxId);

  if (!inbox) {
    return c.json({ error: "Inbox not found" }, 404);
  }

  return c.json({
    id: inbox.id,
    displayName: inbox.displayName,
    createdAt: inbox.createdAt,
    lastIngestAt: inbox.lastIngestAt,
    lastUiAt: inbox.lastUiAt,
  });
});

// Delete inbox
app.delete("/api/inboxes/:id", async (c) => {
  const inboxId = c.req.param("id")!;

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  await dirStub.deleteInbox(inboxId);

  return c.json({ success: true });
});

// Create demo inbox with sample data
app.post("/api/demo", async (c) => {
  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  // Create a new inbox for the demo
  const inbox = await dirStub.createInbox("Demo");

  const id = c.env.INBOX_DO.idFromName(inbox.id);
  const stub = c.env.INBOX_DO.get(id);

  // Generate and insert demo traces
  const demoTraces = generateDemoTraces();
  for (const trace of demoTraces) {
    const payload = new TextEncoder().encode(JSON.stringify(trace));
    const metadata = extractTraceMetadata(payload, "application/json");
    await stub.appendEvent({
      eventType: "trace",
      contentType: "application/json",
      payload,
      metadata,
      timestamp: Date.now(),
    });
  }

  // Generate and insert demo logs
  const demoLogs = generateDemoLogs();
  for (const log of demoLogs) {
    const payload = new TextEncoder().encode(JSON.stringify(log));
    const metadata = extractLogMetadata(payload, "application/json");
    await stub.appendEvent({
      eventType: "log",
      contentType: "application/json",
      payload,
      metadata,
      timestamp: Date.now(),
    });
  }

  // Update inbox activity timestamp
  await dirStub.touchInbox(inbox.id, "ingest");

  // Redirect to the dashboard
  const origin = new URL(c.req.url).origin;
  return c.redirect(`${origin}/i/${inbox.id}/ui`);
});

// ==================== Ingest routes ====================

// OTLP Traces ingest
app.post("/i/:inboxId/v1/traces", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const contentType = c.req.header("content-type") || "application/x-protobuf";

  const payload = new Uint8Array(await c.req.arrayBuffer());
  const metadata = extractTraceMetadata(payload, contentType);

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  await stub.appendEvent({
    eventType: "trace",
    contentType,
    payload,
    metadata,
    timestamp: Date.now(),
  });

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ingest"));

  return c.json({});
});

// OTLP Logs ingest
app.post("/i/:inboxId/v1/logs", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const contentType = c.req.header("content-type") || "application/x-protobuf";

  const payload = new Uint8Array(await c.req.arrayBuffer());
  const metadata = extractLogMetadata(payload, contentType);

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  await stub.appendEvent({
    eventType: "log",
    contentType,
    payload,
    metadata,
    timestamp: Date.now(),
  });

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ingest"));

  return c.json({});
});

// OTLP Metrics ingest
app.post("/i/:inboxId/v1/metrics", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const contentType = c.req.header("content-type") || "application/x-protobuf";

  const payload = new Uint8Array(await c.req.arrayBuffer());

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  await stub.appendEvent({
    eventType: "metric",
    contentType,
    payload,
    metadata: null,
    timestamp: Date.now(),
  });

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ingest"));

  return c.json({});
});

// ==================== Inbox API routes ====================

// Get events for an inbox
app.get("/i/:inboxId/api/events", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");
  const eventType = c.req.query("type") as "trace" | "log" | "metric" | undefined;
  const since = c.req.query("since") ? parseInt(c.req.query("since")!) : undefined;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const events = await stub.getEvents({ limit, offset, eventType, since });

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
app.get("/i/:inboxId/api/events/:eventId", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const eventId = parseInt(c.req.param("eventId")!);

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const event = await stub.getEvent(eventId);

  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

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
app.get("/i/:inboxId/api/events/:eventId/raw", async (c) => {
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
app.get("/i/:inboxId/api/stats", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const stats = await stub.getStats();

  return c.json(stats);
});

// ==================== UI routes ====================

// Dashboard
app.get("/i/:inboxId/ui", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const [events, stats] = await Promise.all([
    stub.getEvents({ limit: 20 }),
    stub.getStats(),
  ]);

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ui"));

  const origin = new URL(c.req.url).origin;
  const inboxUrl = `${origin}/i/${inboxId}`;

  return c.html(
    <Layout title="Dashboard" inboxId={inboxId}>
      <section class="stats">
        <div class="stat">
          <span class="label">Total Events</span>
          <span class="value">{stats.totalEvents}</span>
        </div>
        <div class="stat">
          <span class="label">Last Received</span>
          <span class="value">
            {stats.lastReceived
              ? new Date(stats.lastReceived).toLocaleTimeString()
              : "Never"}
          </span>
        </div>
        <div class="stat">
          <span class="label">Events/min</span>
          <span class="value">{stats.eventsPerMinute}</span>
        </div>
        <div class="stat">
          <span class="label">Traces</span>
          <span class="value">{stats.eventsByType.trace || 0}</span>
        </div>
        <div class="stat">
          <span class="label">Logs</span>
          <span class="value">{stats.eventsByType.log || 0}</span>
        </div>
      </section>

      <section>
        <h2>Recent Events</h2>
        <div
          hx-get={`/i/${inboxId}/ui/events-partial`}
          hx-trigger="every 5s"
          hx-swap="innerHTML"
        >
          <EventList events={events} inboxId={inboxId} />
        </div>
      </section>

      <section class="endpoints">
        <h3>Ingest Endpoints</h3>
        <div class="endpoint">
          <span class="method">POST</span>
          <code>{inboxUrl}/v1/traces</code>
        </div>
        <div class="endpoint">
          <span class="method">POST</span>
          <code>{inboxUrl}/v1/logs</code>
        </div>
        <div class="endpoint">
          <span class="method">POST</span>
          <code>{inboxUrl}/v1/metrics</code>
        </div>
      </section>
    </Layout>
  );
});

// Events list page
app.get("/i/:inboxId/ui/events", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const events = await stub.getEvents({ limit: 100 });

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ui"));

  return c.html(
    <Layout title="Events" inboxId={inboxId}>
      <section>
        <h2>All Events</h2>
        <div
          hx-get={`/i/${inboxId}/ui/events-partial`}
          hx-trigger="every 5s"
          hx-swap="innerHTML"
        >
          <EventList events={events} inboxId={inboxId} />
        </div>
      </section>
    </Layout>
  );
});

// Partial events list for htmx refresh
app.get("/i/:inboxId/ui/events-partial", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const events = await stub.getEvents({ limit: 20 });

  return c.html(<EventList events={events} inboxId={inboxId} />);
});

// Single event detail
app.get("/i/:inboxId/ui/events/:eventId", async (c) => {
  const inboxId = c.req.param("inboxId")!;
  const eventId = parseInt(c.req.param("eventId")!);

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const event = await stub.getEvent(eventId);

  if (!event) {
    return c.html(
      <Layout title="Not Found" inboxId={inboxId}>
        <div class="empty">
          <p>Event not found</p>
          <a href={`/i/${inboxId}/ui/events`} class="btn btn-primary">
            Back to events
          </a>
        </div>
      </Layout>,
      404
    );
  }

  return c.html(
    <Layout title={`Event ${eventId}`} inboxId={inboxId}>
      <RawViewer event={event} inboxId={inboxId} />
    </Layout>
  );
});

// ==================== Health & Landing ====================

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Landing page
app.get("/", (c) => {
  const origin = new URL(c.req.url).origin;

  const exampleUsage = `# Create an inbox
curl -X POST ${origin}/api/inboxes

# Response:
{
  "id": "abc123...",
  "urls": {
    "ui": "${origin}/i/abc123/ui",
    "traces": "${origin}/i/abc123/v1/traces",
    "logs": "${origin}/i/abc123/v1/logs"
  }
}

# Send a trace (OTLP/JSON)
curl -X POST ${origin}/i/abc123/v1/traces \\
  -H "Content-Type: application/json" \\
  -d '{"resourceSpans":[...]}'

# View in browser
open ${origin}/i/abc123/ui`;

  const sdkConfig = `# Set these environment variables in your app
OTEL_EXPORTER_OTLP_ENDPOINT=${origin}/i/<inboxId>
OTEL_EXPORTER_OTLP_PROTOCOL=http/json`;

  const effectConfig = `// Effect with @effect/opentelemetry
import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { Effect } from "effect"

const TracingLive = NodeSdk.layer(() => ({
  resource: { serviceName: "my-service" },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: "${origin}/i/<inboxId>/v1/traces",
    })
  ),
}))

// Use in your program
const program = Effect.gen(function* () {
  // Your effectful code with automatic tracing
})

Effect.runPromise(program.pipe(Effect.provide(TracingLive)))`;

  return c.html(
    <Layout title="Home">
      <section>
        <h2>Welcome to Tracebin</h2>
        <p style="margin-bottom: 1.5rem; color: #8b949e;">
          Ephemeral OpenTelemetry ingest for development. Create an inbox to get
          started.
        </p>
        <form action="/api/demo" method="post" style="margin-bottom: 1.5rem;">
          <button
            type="submit"
            style="background: #238636; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: 500;"
          >
            Try Demo
          </button>
          <span style="margin-left: 1rem; color: #8b949e; font-size: 0.9rem;">
            Creates an inbox with sample traces and logs
          </span>
        </form>
        <div class="endpoints">
          <h3>Quick Start</h3>
          <div class="endpoint">
            <span class="method">POST</span>
            <code>/api/inboxes</code>
          </div>
          <p style="margin-top: 0.75rem; color: #8b949e; font-size: 0.9rem;">
            Creates a new inbox and returns ingest URLs.
          </p>
        </div>
      </section>

      <section>
        <h2>Example Usage</h2>
        <pre>{exampleUsage}</pre>
      </section>

      <section>
        <h2>Configure OpenTelemetry SDK</h2>
        <pre>{sdkConfig}</pre>
      </section>

      <section>
        <h2>Effect (TypeScript)</h2>
        <pre>{effectConfig}</pre>
      </section>
    </Layout>
  );
});

export default app;
