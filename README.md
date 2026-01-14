# Tracebin

**Ephemeral OpenTelemetry ingest for development.**

Tracebin is a disposable telemetry collector that gives you instant visibility into your traces, logs, and metrics during development. Think "pastebin for OTel" - create an inbox, point your app at it, and watch your telemetry flow in real-time.

Perfect for:
- Debugging traces in local development
- Inspecting telemetry from PR preview environments
- Quick ad-hoc tracing without setting up a full observability stack
- Teaching and learning OpenTelemetry

## Features

- **OTLP-native** - Standard OpenTelemetry Protocol over HTTP (JSON and Protobuf)
- **Zero config** - Create an inbox and start sending telemetry immediately
- **Real-time dashboard** - Server-rendered UI with live updates via htmx
- **Auto-expiring** - Inboxes automatically clean up after 7 days of inactivity
- **Edge-deployed** - Runs on Cloudflare Workers for global low-latency ingest
- **SQLite storage** - Durable Objects with SQL for fast queries

## Quick Start

### Using the Hosted Version

```bash
# Create an inbox
curl -X POST https://tracebin.bjacobso.workers.dev/api/inboxes
```

Response:
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "urls": {
    "ui": "https://tracebin.bjacobso.workers.dev/i/a1b2c3d4e5f6g7h8/ui",
    "traces": "https://tracebin.bjacobso.workers.dev/i/a1b2c3d4e5f6g7h8/v1/traces",
    "logs": "https://tracebin.bjacobso.workers.dev/i/a1b2c3d4e5f6g7h8/v1/logs"
  },
  "secretToken": "..."
}
```

### Configure Your OpenTelemetry SDK

Set these environment variables in your application:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://tracebin.bjacobso.workers.dev/i/<inboxId>
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

Or configure programmatically:

```typescript
// Node.js with @opentelemetry/sdk-node
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'https://tracebin.bjacobso.workers.dev/i/<inboxId>/v1/traces',
  }),
});

sdk.start();
```

```python
# Python with opentelemetry-sdk
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(
    endpoint="https://tracebin.bjacobso.workers.dev/i/<inboxId>/v1/traces"
))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
```

```typescript
// Effect with @effect/opentelemetry
import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { Effect } from "effect"

const TracingLive = NodeSdk.layer(() => ({
  resource: { serviceName: "my-service" },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: "https://tracebin.bjacobso.workers.dev/i/<inboxId>/v1/traces",
    })
  ),
}))

// Use in your program
const program = Effect.gen(function* () {
  // Your effectful code with automatic tracing
})

Effect.runPromise(program.pipe(Effect.provide(TracingLive)))
```

### Send a Test Trace

```bash
curl -X POST https://tracebin.bjacobso.workers.dev/i/<inboxId>/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [
          {"key": "service.name", "value": {"stringValue": "my-service"}}
        ]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "5B8EFFF798038103D269B633813FC60C",
          "spanId": "EEE19B7EC3C1B174",
          "name": "GET /api/users",
          "startTimeUnixNano": "1544712660000000000",
          "endTimeUnixNano": "1544712661000000000",
          "kind": 2,
          "status": {"code": 1}
        }]
      }]
    }]
  }'
```

Then open the dashboard URL to see your trace!

## API Reference

### Control Plane

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inboxes` | POST | Create a new inbox |
| `/api/inboxes` | GET | List all inboxes |
| `/api/inboxes/:id` | GET | Get inbox details |
| `/api/inboxes/:id` | DELETE | Delete an inbox |

### OTLP Ingest (per inbox)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/i/:inboxId/v1/traces` | POST | Ingest OTLP traces |
| `/i/:inboxId/v1/logs` | POST | Ingest OTLP logs |
| `/i/:inboxId/v1/metrics` | POST | Ingest OTLP metrics |

Supports both `application/json` (OTLP/JSON) and `application/x-protobuf` (OTLP/Proto) content types.

### Data API (per inbox)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/i/:inboxId/api/events` | GET | List stored events |
| `/i/:inboxId/api/events/:eventId` | GET | Get event with payload |
| `/i/:inboxId/api/events/:eventId/raw` | GET | Download raw payload |
| `/i/:inboxId/api/stats` | GET | Get inbox statistics |

#### Query Parameters for `/api/events`

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max events to return (default: 100) |
| `offset` | number | Pagination offset |
| `type` | string | Filter by event type: `trace`, `log`, `metric` |
| `since` | number | Only events after this timestamp (ms) |

### Dashboard UI

| Endpoint | Description |
|----------|-------------|
| `/i/:inboxId/ui` | Main dashboard with stats and recent events |
| `/i/:inboxId/ui/events` | Full event list view |
| `/i/:inboxId/ui/events/:eventId` | Event detail with payload viewer |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Hono.js    │───▶│   InboxDO    │    │ DirectoryDO  │      │
│  │   Router     │    │  (per inbox) │    │  (singleton) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         │            ┌──────┴──────┐     ┌──────┴──────┐       │
│         │            │   SQLite    │     │   SQLite    │       │
│         │            │   Storage   │     │   Storage   │       │
│         │            └─────────────┘     └─────────────┘       │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │  Hono JSX    │                                              │
│  │  Components  │                                              │
│  └──────────────┘                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

- **Hono.js** - Ultrafast web framework optimized for edge runtimes
- **InboxDO** - Durable Object storing events for a single inbox (SQLite)
- **DirectoryDO** - Singleton Durable Object managing inbox registry and TTL cleanup
- **Hono JSX** - Server-side JSX rendering for the dashboard UI
- **htmx** - Lightweight library for real-time UI updates

### Storage Schema

**InboxDO (events table)**
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,      -- 'trace', 'log', 'metric'
  content_type TEXT NOT NULL,    -- MIME type
  payload BLOB NOT NULL,         -- Raw OTLP payload
  metadata TEXT,                 -- Extracted JSON metadata
  created_at INTEGER NOT NULL
);
```

**DirectoryDO (inboxes table)**
```sql
CREATE TABLE inboxes (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_ingest_at INTEGER,
  last_ui_at INTEGER,
  secret_token TEXT NOT NULL,
  display_name TEXT
);
```

## Self-Hosting

### Prerequisites

- Node.js 20+
- Cloudflare account with Workers enabled
- [Alchemy](https://alchemy.run) for deployment

### Installation

```bash
git clone https://github.com/bjacobso/tracebin.git
cd tracebin
npm install
```

### Configuration

Create a `.dev.vars` file for local development:

```bash
# Optional: Configure Cloudflare credentials
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

### Development

```bash
# Run locally with Alchemy
npx tsx alchemy.run.ts

# Or use npm script
npm run dev
```

### Deployment

```bash
# Deploy to production
npm run deploy

# Or with a specific stage
npx tsx alchemy.run.ts --stage production
```

### Teardown

```bash
# Remove all resources
npm run destroy
```

## Project Structure

```
tracebin/
├── alchemy.run.ts              # Infrastructure as Code (Alchemy)
├── src/
│   ├── worker.tsx              # Main worker entry point
│   ├── durable-objects/
│   │   ├── inbox.ts            # InboxDO - event storage
│   │   └── directory.ts        # DirectoryDO - inbox registry
│   ├── routes/
│   │   ├── api.ts              # Control plane routes
│   │   ├── ingest.ts           # OTLP ingest handlers
│   │   ├── inbox-api.ts        # Per-inbox data API
│   │   └── ui.tsx              # Dashboard routes
│   ├── ui/components/
│   │   ├── Layout.tsx          # Base layout with styles
│   │   ├── EventList.tsx       # Event listing component
│   │   └── RawViewer.tsx       # Payload viewer component
│   └── lib/
│       ├── types.ts            # TypeScript types
│       └── otlp.ts             # OTLP metadata extraction
├── package.json
└── tsconfig.json
```

## Configuration Options

### Retention

- **Event limit**: 5,000 events per inbox (oldest events are deleted)
- **Inactivity TTL**: 7 days (configurable in `src/durable-objects/directory.ts`)

### Authentication

By default, inboxes are accessible without authentication for ease of use in development. Each inbox has a `secretToken` that can optionally be passed as:
- Bearer token: `Authorization: Bearer <token>`
- Query parameter: `?token=<token>`

## Limitations

- **Not for production** - Tracebin is designed for development and debugging, not production observability
- **No protobuf parsing** - Binary protobuf payloads are stored raw; only JSON payloads get metadata extraction
- **Single region** - Data is stored in a single Cloudflare region (determined by first access)
- **No alerting** - This is a viewer, not a monitoring system

## Roadmap

- [ ] Trace waterfall visualization
- [ ] Log search and filtering
- [ ] Metrics charts
- [ ] Span attributes viewer
- [ ] Service map
- [ ] CI integration (auto-create inbox per PR)
- [ ] Protobuf parsing in UI
- [ ] Data export

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [OpenTelemetry](https://opentelemetry.io/) - The observability framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge compute platform
- [Hono](https://hono.dev/) - Web framework for the edge
- [Alchemy](https://alchemy.run/) - Infrastructure as TypeScript
- [htmx](https://htmx.org/) - High power tools for HTML

---

**Made with [Claude Code](https://claude.com/claude-code)**
