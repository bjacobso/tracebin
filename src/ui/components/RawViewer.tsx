import type { FC } from "hono/jsx";
import type { StoredEvent } from "../../lib/types.ts";

interface RawViewerProps {
  event: StoredEvent;
  inboxId: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const RawViewer: FC<RawViewerProps> = ({ event, inboxId }) => {
  // Try to decode payload if JSON
  let content: string;
  const isJson = event.contentType.includes("json");

  if (isJson) {
    try {
      const json = JSON.parse(new TextDecoder().decode(event.payload));
      content = JSON.stringify(json, null, 2);
    } catch {
      content = new TextDecoder().decode(event.payload);
    }
  } else {
    content = `[Binary ${event.contentType} - ${formatSize(event.payload.length)}]`;
  }

  return (
    <div>
      <div class="detail-header">
        <a href={`/i/${inboxId}/ui/events`} class="back-link">
          &larr; Back to events
        </a>
        <span class={`event-type ${event.eventType}`}>{event.eventType}</span>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="label">Event ID</div>
          <div class="value">{event.id}</div>
        </div>
        <div class="info-item">
          <div class="label">Timestamp</div>
          <div class="value">{formatTime(event.timestamp)}</div>
        </div>
        <div class="info-item">
          <div class="label">Content-Type</div>
          <div class="value">{event.contentType}</div>
        </div>
        <div class="info-item">
          <div class="label">Size</div>
          <div class="value">{formatSize(event.payload.length)}</div>
        </div>
        {event.metadata?.spanCount && (
          <div class="info-item">
            <div class="label">Span Count</div>
            <div class="value">{event.metadata.spanCount}</div>
          </div>
        )}
        {event.metadata?.serviceNames?.length && (
          <div class="info-item">
            <div class="label">Services</div>
            <div class="value">{event.metadata.serviceNames.join(", ")}</div>
          </div>
        )}
        {event.metadata?.traceId && (
          <div class="info-item">
            <div class="label">Trace ID</div>
            <div class="value">{event.metadata.traceId}</div>
          </div>
        )}
      </div>

      <section>
        <h2>
          Payload
          {!isJson && (
            <a
              href={`/i/${inboxId}/api/events/${event.id}/raw`}
              class="btn btn-primary"
              style="margin-left: 1rem; font-size: 0.8rem; padding: 0.25rem 0.5rem;"
            >
              Download
            </a>
          )}
        </h2>
        <pre>{content}</pre>
      </section>
    </div>
  );
};
