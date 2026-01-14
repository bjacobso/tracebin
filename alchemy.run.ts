import alchemy from "alchemy";
import { Worker, DurableObjectNamespace } from "alchemy/cloudflare";

const app = await alchemy("tracebin");

// Durable Object namespaces
const inboxDO = DurableObjectNamespace("inbox-do", {
  className: "InboxDO",
  sqlite: true,
});

const directoryDO = DurableObjectNamespace("directory-do", {
  className: "DirectoryDO",
  sqlite: true,
});

// Main worker
export const worker = await Worker("tracebin-worker", {
  name: "tracebin",
  entrypoint: "./src/worker.tsx",
  url: true,
  bindings: {
    INBOX_DO: inboxDO,
    DIRECTORY_DO: directoryDO,
  },
});

console.log(`Tracebin URL: ${worker.url}`);

await app.finalize();
