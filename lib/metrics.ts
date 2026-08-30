type MetricCounter = Record<string, number>;

class MetricsRegistry {
  private counters: Map<string, number> = new Map();
  private startedAt = new Date();

  increment(metricName: string, labels: Record<string, string> = {}, value = 1) {
    const key = this.formatKey(metricName, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
  }

  private formatKey(name: string, labels: Record<string, string>): string {
    const sorted = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return sorted ? `${name}{${sorted}}` : name;
  }

  getSnapshot() {
    const countersObj: MetricCounter = {};
    for (const [k, v] of this.counters.entries()) {
      countersObj[k] = v;
    }
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt.toISOString(),
      timestamp: new Date().toISOString(),
      counters: countersObj,
    };
  }

  reset() {
    this.counters.clear();
    this.startedAt = new Date();
  }
}

export const metrics = new MetricsRegistry();

export function recordLoginAttempt(status: "SUCCESS" | "FAILURE", method: "CREDENTIALS" | "MAGIC_LINK" | "MFA" = "CREDENTIALS") {
  metrics.increment("auth_login_attempts_total", { status, method });
}

export function recordReportGeneration(reportType: string, format: string, success: boolean) {
  metrics.increment("report_generations_total", {
    type: reportType,
    format,
    status: success ? "SUCCESS" : "FAILURE",
  });
}

export function recordJobExecution(jobType: string, status: "COMPLETED" | "FAILED" | "RETRY") {
  metrics.increment("job_executions_total", { type: jobType, status });
}

export function recordNotificationDelivery(notificationType: string, status: "SENT" | "FAILED" | "BOUNCED") {
  metrics.increment("notification_deliveries_total", { type: notificationType, status });
}

export function recordRetentionPurge(entityType: string, count: number) {
  metrics.increment("retention_purged_records_total", { entityType }, count);
}
