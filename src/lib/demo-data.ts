// Demo data generators for realistic OTLP traces and logs

// Generate random hex string of specified byte length
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert milliseconds to nanoseconds string
function msToNano(ms: number): string {
  return (BigInt(ms) * BigInt(1_000_000)).toString();
}

// OTLP span kinds
const SpanKind = {
  INTERNAL: 1,
  SERVER: 2,
  CLIENT: 3,
} as const;

// OTLP status codes
const StatusCode = {
  UNSET: 0,
  OK: 1,
  ERROR: 2,
} as const;

// OTLP severity numbers
const SeverityNumber = {
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
} as const;

interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeMs: number;
  endTimeMs: number;
  status: { code: number; message?: string };
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string } }>;
}

interface ServiceSpans {
  serviceName: string;
  spans: SpanData[];
}

function createResourceSpan(service: ServiceSpans) {
  return {
    resource: {
      attributes: [
        { key: "service.name", value: { stringValue: service.serviceName } },
        { key: "service.version", value: { stringValue: "1.0.0" } },
      ],
    },
    scopeSpans: [
      {
        scope: { name: "tracebin-demo", version: "1.0.0" },
        spans: service.spans.map((span) => ({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          name: span.name,
          kind: span.kind,
          startTimeUnixNano: msToNano(span.startTimeMs),
          endTimeUnixNano: msToNano(span.endTimeMs),
          status: span.status,
          attributes: span.attributes || [],
        })),
      },
    ],
  };
}

interface LogData {
  serviceName: string;
  traceId?: string;
  spanId?: string;
  timeMs: number;
  severityNumber: number;
  severityText: string;
  body: string;
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string } }>;
}

function createResourceLog(log: LogData) {
  return {
    resource: {
      attributes: [
        { key: "service.name", value: { stringValue: log.serviceName } },
      ],
    },
    scopeLogs: [
      {
        scope: { name: "tracebin-demo" },
        logRecords: [
          {
            timeUnixNano: msToNano(log.timeMs),
            severityNumber: log.severityNumber,
            severityText: log.severityText,
            body: { stringValue: log.body },
            traceId: log.traceId,
            spanId: log.spanId,
            attributes: log.attributes || [],
          },
        ],
      },
    ],
  };
}

export function generateDemoTraces(): Array<{ resourceSpans: unknown[] }> {
  const now = Date.now();
  const traces: Array<{ resourceSpans: unknown[] }> = [];

  // Trace 1: Successful checkout flow (api-gateway → order-service → payment-service → user-service)
  const trace1Id = randomHex(16);
  const t1_gatewaySpan = randomHex(8);
  const t1_orderSpan = randomHex(8);
  const t1_paymentSpan = randomHex(8);
  const t1_userSpan = randomHex(8);
  const t1_start = now - 4 * 60 * 1000; // 4 minutes ago

  traces.push({
    resourceSpans: [
      createResourceSpan({
        serviceName: "api-gateway",
        spans: [
          {
            traceId: trace1Id,
            spanId: t1_gatewaySpan,
            name: "POST /api/checkout",
            kind: SpanKind.SERVER,
            startTimeMs: t1_start,
            endTimeMs: t1_start + 220,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "http.method", value: { stringValue: "POST" } },
              { key: "http.url", value: { stringValue: "/api/checkout" } },
              { key: "http.status_code", value: { intValue: "200" } },
              { key: "user.id", value: { stringValue: "user_abc123" } },
            ],
          },
        ],
      }),
      createResourceSpan({
        serviceName: "order-service",
        spans: [
          {
            traceId: trace1Id,
            spanId: t1_orderSpan,
            parentSpanId: t1_gatewaySpan,
            name: "CreateOrder",
            kind: SpanKind.SERVER,
            startTimeMs: t1_start + 10,
            endTimeMs: t1_start + 200,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "order.id", value: { stringValue: "order_xyz789" } },
              { key: "order.total", value: { stringValue: "99.99" } },
            ],
          },
        ],
      }),
      createResourceSpan({
        serviceName: "payment-service",
        spans: [
          {
            traceId: trace1Id,
            spanId: t1_paymentSpan,
            parentSpanId: t1_orderSpan,
            name: "ProcessPayment",
            kind: SpanKind.SERVER,
            startTimeMs: t1_start + 30,
            endTimeMs: t1_start + 150,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "payment.method", value: { stringValue: "credit_card" } },
              { key: "payment.amount", value: { stringValue: "99.99" } },
              { key: "payment.currency", value: { stringValue: "USD" } },
            ],
          },
        ],
      }),
      createResourceSpan({
        serviceName: "user-service",
        spans: [
          {
            traceId: trace1Id,
            spanId: t1_userSpan,
            parentSpanId: t1_orderSpan,
            name: "GetUserProfile",
            kind: SpanKind.CLIENT,
            startTimeMs: t1_start + 160,
            endTimeMs: t1_start + 190,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "user.id", value: { stringValue: "user_abc123" } },
            ],
          },
        ],
      }),
    ],
  });

  // Trace 2: Simple user lookup
  const trace2Id = randomHex(16);
  const t2_gatewaySpan = randomHex(8);
  const t2_userSpan = randomHex(8);
  const t2_start = now - 3 * 60 * 1000; // 3 minutes ago

  traces.push({
    resourceSpans: [
      createResourceSpan({
        serviceName: "api-gateway",
        spans: [
          {
            traceId: trace2Id,
            spanId: t2_gatewaySpan,
            name: "GET /api/users/me",
            kind: SpanKind.SERVER,
            startTimeMs: t2_start,
            endTimeMs: t2_start + 45,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "http.method", value: { stringValue: "GET" } },
              { key: "http.url", value: { stringValue: "/api/users/me" } },
              { key: "http.status_code", value: { intValue: "200" } },
            ],
          },
        ],
      }),
      createResourceSpan({
        serviceName: "user-service",
        spans: [
          {
            traceId: trace2Id,
            spanId: t2_userSpan,
            parentSpanId: t2_gatewaySpan,
            name: "GetUserById",
            kind: SpanKind.SERVER,
            startTimeMs: t2_start + 5,
            endTimeMs: t2_start + 40,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "db.system", value: { stringValue: "postgresql" } },
              { key: "db.operation", value: { stringValue: "SELECT" } },
            ],
          },
        ],
      }),
    ],
  });

  // Trace 3: Failed payment
  const trace3Id = randomHex(16);
  const t3_gatewaySpan = randomHex(8);
  const t3_orderSpan = randomHex(8);
  const t3_paymentSpan = randomHex(8);
  const t3_start = now - 2 * 60 * 1000; // 2 minutes ago

  traces.push({
    resourceSpans: [
      createResourceSpan({
        serviceName: "api-gateway",
        spans: [
          {
            traceId: trace3Id,
            spanId: t3_gatewaySpan,
            name: "POST /api/checkout",
            kind: SpanKind.SERVER,
            startTimeMs: t3_start,
            endTimeMs: t3_start + 160,
            status: { code: StatusCode.ERROR, message: "Payment failed" },
            attributes: [
              { key: "http.method", value: { stringValue: "POST" } },
              { key: "http.url", value: { stringValue: "/api/checkout" } },
              { key: "http.status_code", value: { intValue: "402" } },
              { key: "error", value: { stringValue: "true" } },
            ],
          },
        ],
      }),
      createResourceSpan({
        serviceName: "order-service",
        spans: [
          {
            traceId: trace3Id,
            spanId: t3_orderSpan,
            parentSpanId: t3_gatewaySpan,
            name: "CreateOrder",
            kind: SpanKind.SERVER,
            startTimeMs: t3_start + 10,
            endTimeMs: t3_start + 150,
            status: { code: StatusCode.ERROR, message: "Payment declined" },
          },
        ],
      }),
      createResourceSpan({
        serviceName: "payment-service",
        spans: [
          {
            traceId: trace3Id,
            spanId: t3_paymentSpan,
            parentSpanId: t3_orderSpan,
            name: "ProcessPayment",
            kind: SpanKind.SERVER,
            startTimeMs: t3_start + 30,
            endTimeMs: t3_start + 140,
            status: { code: StatusCode.ERROR, message: "Insufficient funds" },
            attributes: [
              { key: "payment.method", value: { stringValue: "credit_card" } },
              { key: "payment.amount", value: { stringValue: "1299.99" } },
              { key: "error.type", value: { stringValue: "InsufficientFundsError" } },
            ],
          },
        ],
      }),
    ],
  });

  // Trace 4: Database query with internal spans
  const trace4Id = randomHex(16);
  const t4_orderSpan = randomHex(8);
  const t4_dbConnSpan = randomHex(8);
  const t4_dbQuerySpan = randomHex(8);
  const t4_start = now - 90 * 1000; // 90 seconds ago

  traces.push({
    resourceSpans: [
      createResourceSpan({
        serviceName: "order-service",
        spans: [
          {
            traceId: trace4Id,
            spanId: t4_orderSpan,
            name: "ListRecentOrders",
            kind: SpanKind.SERVER,
            startTimeMs: t4_start,
            endTimeMs: t4_start + 35,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "orders.count", value: { intValue: "25" } },
            ],
          },
          {
            traceId: trace4Id,
            spanId: t4_dbConnSpan,
            parentSpanId: t4_orderSpan,
            name: "pg.connect",
            kind: SpanKind.INTERNAL,
            startTimeMs: t4_start + 2,
            endTimeMs: t4_start + 8,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "db.system", value: { stringValue: "postgresql" } },
              { key: "net.peer.name", value: { stringValue: "db.example.com" } },
            ],
          },
          {
            traceId: trace4Id,
            spanId: t4_dbQuerySpan,
            parentSpanId: t4_orderSpan,
            name: "SELECT orders",
            kind: SpanKind.CLIENT,
            startTimeMs: t4_start + 10,
            endTimeMs: t4_start + 30,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "db.system", value: { stringValue: "postgresql" } },
              { key: "db.statement", value: { stringValue: "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25" } },
              { key: "db.operation", value: { stringValue: "SELECT" } },
            ],
          },
        ],
      }),
    ],
  });

  // Trace 5: Cache hit (fast response)
  const trace5Id = randomHex(16);
  const t5_gatewaySpan = randomHex(8);
  const t5_cacheSpan = randomHex(8);
  const t5_start = now - 30 * 1000; // 30 seconds ago

  traces.push({
    resourceSpans: [
      createResourceSpan({
        serviceName: "api-gateway",
        spans: [
          {
            traceId: trace5Id,
            spanId: t5_gatewaySpan,
            name: "GET /api/products/featured",
            kind: SpanKind.SERVER,
            startTimeMs: t5_start,
            endTimeMs: t5_start + 8,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "http.method", value: { stringValue: "GET" } },
              { key: "http.url", value: { stringValue: "/api/products/featured" } },
              { key: "http.status_code", value: { intValue: "200" } },
              { key: "cache.hit", value: { stringValue: "true" } },
            ],
          },
          {
            traceId: trace5Id,
            spanId: t5_cacheSpan,
            parentSpanId: t5_gatewaySpan,
            name: "redis.get",
            kind: SpanKind.CLIENT,
            startTimeMs: t5_start + 1,
            endTimeMs: t5_start + 4,
            status: { code: StatusCode.OK },
            attributes: [
              { key: "db.system", value: { stringValue: "redis" } },
              { key: "db.operation", value: { stringValue: "GET" } },
              { key: "cache.hit", value: { stringValue: "true" } },
            ],
          },
        ],
      }),
    ],
  });

  return traces;
}

export function generateDemoLogs(): Array<{ resourceLogs: unknown[] }> {
  const now = Date.now();
  const logs: Array<{ resourceLogs: unknown[] }> = [];

  // Get trace IDs from demo traces for correlation
  const trace1Id = randomHex(16);
  const trace3Id = randomHex(16);

  const logData: LogData[] = [
    {
      serviceName: "api-gateway",
      timeMs: now - 4 * 60 * 1000 + 5,
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "Incoming request: POST /api/checkout from user_abc123",
      traceId: trace1Id,
      attributes: [
        { key: "http.method", value: { stringValue: "POST" } },
        { key: "user.id", value: { stringValue: "user_abc123" } },
      ],
    },
    {
      serviceName: "order-service",
      timeMs: now - 4 * 60 * 1000 + 15,
      severityNumber: SeverityNumber.DEBUG,
      severityText: "DEBUG",
      body: "Cache miss for user session, fetching from database",
      traceId: trace1Id,
    },
    {
      serviceName: "payment-service",
      timeMs: now - 4 * 60 * 1000 + 100,
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "Payment authorized for $99.99 USD via credit_card",
      traceId: trace1Id,
      attributes: [
        { key: "payment.amount", value: { stringValue: "99.99" } },
        { key: "payment.currency", value: { stringValue: "USD" } },
      ],
    },
    {
      serviceName: "order-service",
      timeMs: now - 4 * 60 * 1000 + 180,
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "Order created successfully: order_xyz789",
      traceId: trace1Id,
      attributes: [
        { key: "order.id", value: { stringValue: "order_xyz789" } },
      ],
    },
    {
      serviceName: "api-gateway",
      timeMs: now - 2 * 60 * 1000 + 5,
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "Incoming request: POST /api/checkout from user_def456",
      traceId: trace3Id,
    },
    {
      serviceName: "payment-service",
      timeMs: now - 2 * 60 * 1000 + 130,
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: "Payment failed: Insufficient funds for transaction of $1299.99",
      traceId: trace3Id,
      attributes: [
        { key: "error.type", value: { stringValue: "InsufficientFundsError" } },
        { key: "payment.amount", value: { stringValue: "1299.99" } },
      ],
    },
    {
      serviceName: "api-gateway",
      timeMs: now - 60 * 1000,
      severityNumber: SeverityNumber.WARN,
      severityText: "WARN",
      body: "Rate limit threshold approaching: 85% of 1000 req/min for api-key-prod-xyz",
      attributes: [
        { key: "rate_limit.current", value: { intValue: "850" } },
        { key: "rate_limit.max", value: { intValue: "1000" } },
      ],
    },
    {
      serviceName: "user-service",
      timeMs: now - 45 * 1000,
      severityNumber: SeverityNumber.DEBUG,
      severityText: "DEBUG",
      body: "Database connection pool stats: active=5, idle=15, waiting=0",
      attributes: [
        { key: "pool.active", value: { intValue: "5" } },
        { key: "pool.idle", value: { intValue: "15" } },
      ],
    },
    {
      serviceName: "order-service",
      timeMs: now - 20 * 1000,
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "Scheduled job completed: cleanup_expired_carts removed 42 abandoned carts",
      attributes: [
        { key: "job.name", value: { stringValue: "cleanup_expired_carts" } },
        { key: "job.items_processed", value: { intValue: "42" } },
      ],
    },
    {
      serviceName: "api-gateway",
      timeMs: now - 5 * 1000,
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "Health check passed: all downstream services responding",
    },
  ];

  for (const log of logData) {
    logs.push({ resourceLogs: [createResourceLog(log)] });
  }

  return logs;
}
