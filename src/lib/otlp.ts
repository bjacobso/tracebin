import type { EventMetadata } from "./types.ts";

/**
 * Extract metadata from OTLP JSON trace payload
 */
export function extractTraceMetadata(payload: Uint8Array, contentType: string): EventMetadata | null {
  if (!contentType.includes("json")) {
    return null;
  }

  try {
    const json = JSON.parse(new TextDecoder().decode(payload));
    const resourceSpans = json.resourceSpans || [];
    let spanCount = 0;
    const serviceNames = new Set<string>();

    for (const rs of resourceSpans) {
      // Extract service name from resource attributes
      const attrs = rs.resource?.attributes || [];
      const serviceName = attrs.find((a: { key: string }) => a.key === "service.name");
      if (serviceName?.value?.stringValue) {
        serviceNames.add(serviceName.value.stringValue);
      }

      // Count spans
      for (const ss of rs.scopeSpans || []) {
        spanCount += (ss.spans || []).length;
      }
    }

    return {
      spanCount,
      serviceNames: Array.from(serviceNames),
    };
  } catch {
    return null;
  }
}

/**
 * Extract metadata from OTLP JSON log payload
 */
export function extractLogMetadata(payload: Uint8Array, contentType: string): EventMetadata | null {
  if (!contentType.includes("json")) {
    return null;
  }

  try {
    const json = JSON.parse(new TextDecoder().decode(payload));
    const resourceLogs = json.resourceLogs || [];
    const serviceNames = new Set<string>();
    let traceId: string | undefined;

    for (const rl of resourceLogs) {
      // Extract service name from resource attributes
      const attrs = rl.resource?.attributes || [];
      const serviceName = attrs.find((a: { key: string }) => a.key === "service.name");
      if (serviceName?.value?.stringValue) {
        serviceNames.add(serviceName.value.stringValue);
      }

      // Try to get traceId from first log record
      for (const sl of rl.scopeLogs || []) {
        for (const lr of sl.logRecords || []) {
          if (lr.traceId && !traceId) {
            traceId = lr.traceId;
          }
        }
      }
    }

    return {
      serviceNames: Array.from(serviceNames),
      traceId,
    };
  } catch {
    return null;
  }
}
