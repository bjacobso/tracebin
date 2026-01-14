import type { FC } from "hono/jsx";
import type { StoredEvent } from "../../lib/types.ts";

interface EventListProps {
  events: StoredEvent[];
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

function formatMetadata(event: StoredEvent): string {
  if (!event.metadata) return "";

  const parts: string[] = [];
  if (event.metadata.spanCount) {
    parts.push(`${event.metadata.spanCount} spans`);
  }
  if (event.metadata.serviceNames?.length) {
    parts.push(event.metadata.serviceNames.join(", "));
  }
  if (event.metadata.traceId) {
    parts.push(`trace:${event.metadata.traceId.slice(0, 8)}...`);
  }
  return parts.join(" | ");
}

export const EventList: FC<EventListProps> = ({ events, inboxId }) => {
  if (events.length === 0) {
    return (
      <div class="empty">
        <p>No events yet. Send some telemetry to get started!</p>
      </div>
    );
  }

  return (
    <div class="event-list">
      {events.map((event) => (
        <a
          href={`/i/${inboxId}/ui/events/${event.id}`}
          class="event-item"
          key={event.id}
        >
          <span class={`event-type ${event.eventType}`}>{event.eventType}</span>
          <span class="event-time">{formatTime(event.timestamp)}</span>
          <span class="event-meta">{formatMetadata(event)}</span>
          <span class="event-size">{formatSize(event.payload.length)}</span>
        </a>
      ))}
    </div>
  );
};
