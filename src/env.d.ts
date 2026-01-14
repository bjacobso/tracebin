import type { InboxDO } from "./durable-objects/inbox.ts";
import type { DirectoryDO } from "./durable-objects/directory.ts";

declare global {
  interface Env {
    INBOX_DO: DurableObjectNamespace<InboxDO>;
    DIRECTORY_DO: DurableObjectNamespace<DirectoryDO>;
  }
}

export {};
