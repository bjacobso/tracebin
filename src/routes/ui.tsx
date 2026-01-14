import { Hono } from "hono";
import type { InboxDO } from "../durable-objects/inbox.ts";
import type { DirectoryDO } from "../durable-objects/directory.ts";
import { Layout } from "../ui/components/Layout.tsx";
import { EventList } from "../ui/components/EventList.tsx";
import { RawViewer } from "../ui/components/RawViewer.tsx";

type Bindings = {
  INBOX_DO: DurableObjectNamespace<InboxDO>;
  DIRECTORY_DO: DurableObjectNamespace<DirectoryDO>;
};

export const uiRoutes = new Hono<{ Bindings: Bindings }>();

// Dashboard
uiRoutes.get("/ui", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const [events, stats] = await Promise.all([
    stub.getEvents({ limit: 20 }),
    stub.getStats(),
  ]);

  // Touch for UI activity
  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);
  c.executionCtx.waitUntil(dirStub.touchInbox(inboxId, "ui"));

  // Build URLs based on request origin
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
uiRoutes.get("/ui/events", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const events = await stub.getEvents({ limit: 100 });

  // Touch for UI activity
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
uiRoutes.get("/ui/events-partial", async (c) => {
  const inboxId = c.req.param("inboxId")!;

  const id = c.env.INBOX_DO.idFromName(inboxId);
  const stub = c.env.INBOX_DO.get(id);

  const events = await stub.getEvents({ limit: 20 });

  return c.html(<EventList events={events} inboxId={inboxId} />);
});

// Single event detail
uiRoutes.get("/ui/events/:eventId", async (c) => {
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
