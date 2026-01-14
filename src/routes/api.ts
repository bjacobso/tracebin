import { Hono } from "hono";
import type { InboxDO } from "../durable-objects/inbox.ts";
import type { DirectoryDO } from "../durable-objects/directory.ts";

type Bindings = {
  INBOX_DO: DurableObjectNamespace<InboxDO>;
  DIRECTORY_DO: DurableObjectNamespace<DirectoryDO>;
};

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Create inbox
apiRoutes.post("/inboxes", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const displayName = body.displayName as string | undefined;

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  const inbox = await dirStub.createInbox(displayName);

  // Build URLs based on request origin
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
apiRoutes.get("/inboxes", async (c) => {
  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  const inboxes = await dirStub.listInboxes();

  // Don't expose secret tokens in list
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

// Get inbox info (by ID)
apiRoutes.get("/inboxes/:id", async (c) => {
  const inboxId = c.req.param("id");

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  const inbox = await dirStub.getInbox(inboxId);

  if (!inbox) {
    return c.json({ error: "Inbox not found" }, 404);
  }

  // Don't expose secret token via GET
  return c.json({
    id: inbox.id,
    displayName: inbox.displayName,
    createdAt: inbox.createdAt,
    lastIngestAt: inbox.lastIngestAt,
    lastUiAt: inbox.lastUiAt,
  });
});

// Delete inbox
apiRoutes.delete("/inboxes/:id", async (c) => {
  const inboxId = c.req.param("id");

  const dirId = c.env.DIRECTORY_DO.idFromName("global");
  const dirStub = c.env.DIRECTORY_DO.get(dirId);

  await dirStub.deleteInbox(inboxId);

  return c.json({ success: true });
});
