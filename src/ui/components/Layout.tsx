import type { FC } from "hono/jsx";

interface LayoutProps {
  title: string;
  inboxId?: string;
  children: unknown;
}

export const Layout: FC<LayoutProps> = ({ title, inboxId, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} - Tracebin</title>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0d1117;
          color: #c9d1d9;
          line-height: 1.5;
        }
        header {
          background: #161b22;
          border-bottom: 1px solid #30363d;
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          gap: 2rem;
        }
        header h1 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #58a6ff;
        }
        header nav {
          display: flex;
          gap: 1.5rem;
        }
        header nav a {
          color: #8b949e;
          text-decoration: none;
          font-size: 0.9rem;
        }
        header nav a:hover { color: #c9d1d9; }
        header nav a.active { color: #58a6ff; }
        .inbox-id {
          margin-left: auto;
          font-family: monospace;
          font-size: 0.85rem;
          background: #21262d;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          color: #8b949e;
        }
        main {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }
        section { margin-bottom: 2rem; }
        section h2 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #c9d1d9;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }
        .stat {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 1rem;
        }
        .stat .label {
          font-size: 0.75rem;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat .value {
          font-size: 1.5rem;
          font-weight: 600;
          color: #c9d1d9;
        }
        .event-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .event-item {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.15s;
        }
        .event-item:hover { border-color: #58a6ff; }
        .event-type {
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
          min-width: 60px;
          text-align: center;
        }
        .event-type.trace { background: #388bfd33; color: #58a6ff; }
        .event-type.log { background: #3fb95033; color: #3fb950; }
        .event-type.metric { background: #d29922aa; color: #d29922; }
        .event-time {
          font-family: monospace;
          font-size: 0.85rem;
          color: #8b949e;
        }
        .event-meta {
          font-size: 0.85rem;
          color: #8b949e;
          flex: 1;
        }
        .event-size {
          font-family: monospace;
          font-size: 0.8rem;
          color: #6e7681;
        }
        .endpoints {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 1rem;
        }
        .endpoints h3 {
          font-size: 0.9rem;
          margin-bottom: 0.75rem;
          color: #c9d1d9;
        }
        .endpoint {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .endpoint .method {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.2rem 0.4rem;
          background: #238636;
          color: #fff;
          border-radius: 3px;
        }
        .endpoint code {
          font-family: monospace;
          font-size: 0.85rem;
          color: #c9d1d9;
          word-break: break-all;
        }
        .btn {
          display: inline-block;
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 6px;
          text-decoration: none;
          cursor: pointer;
          border: none;
        }
        .btn-primary {
          background: #238636;
          color: #fff;
        }
        .btn-primary:hover { background: #2ea043; }
        .empty {
          text-align: center;
          padding: 3rem;
          color: #8b949e;
        }
        pre {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 1rem;
          overflow-x: auto;
          font-family: monospace;
          font-size: 0.85rem;
          line-height: 1.4;
        }
        .detail-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .back-link {
          color: #58a6ff;
          text-decoration: none;
          font-size: 0.9rem;
        }
        .back-link:hover { text-decoration: underline; }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .info-item .label {
          font-size: 0.75rem;
          color: #8b949e;
          text-transform: uppercase;
        }
        .info-item .value {
          font-family: monospace;
          color: #c9d1d9;
        }
      `}</style>
    </head>
    <body>
      <header>
        <h1>Tracebin</h1>
        {inboxId && (
          <>
            <nav>
              <a href={`/i/${inboxId}/ui`}>Dashboard</a>
              <a href={`/i/${inboxId}/ui/events`}>Events</a>
            </nav>
            <code class="inbox-id">{inboxId}</code>
          </>
        )}
        {!inboxId && (
          <nav>
            <a href="/api/inboxes">API</a>
          </nav>
        )}
      </header>
      <main>{children}</main>
    </body>
  </html>
);
