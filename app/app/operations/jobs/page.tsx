import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, formatEnum } from "@/lib/utils";
import { uiCapabilities } from "@/lib/ui-capabilities";
import { JobRetryButton } from "@/components/job-retry-button";

export default async function JobsPage() {
  const session = await requireSession();
  const tenantId = session.user.tenantId;
  const capabilities = uiCapabilities(session.user.role);
  if (!capabilities["settings:manage"] && !capabilities["audit:read"]) {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Job queue" description="Durable background work for this workspace." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Job status requires Owner, Risk Manager, or Auditor access.
          </CardContent>
        </Card>
      </>
    );
  }
  const jobs = await db.job.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 200 });
  const counts = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});

  const canRetry = Boolean(capabilities["settings:manage"]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Job queue"
        description="Durable, tenant-scoped background work. Queue execution in production is owned by bounded worker processes with retry and backoff."
      />
      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(counts).map(([status, count]) => (
          <Card key={status}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground">{formatEnum(status)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <CardHeader>
          <h2 className="text-sm font-bold">Recent jobs</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Attempts</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Run after</th>
                  <th className="p-4">Error</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/20">
                    <td className="p-4 font-semibold">{formatEnum(job.type)}</td>
                    <td className="p-4">
                      <Badge
                        className={
                          job.status === "FAILED"
                            ? "border-red-500/40 bg-red-500/10 text-red-600"
                            : job.status === "COMPLETED"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                            : "border-border bg-muted text-muted-foreground"
                        }
                      >
                        {formatEnum(job.status)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="p-4">{formatDate(job.createdAt)}</td>
                    <td className="p-4">{formatDate(job.runAfter)}</td>
                    <td className="p-4 text-destructive font-mono text-[11px] max-w-xs truncate">{job.error ?? "—"}</td>
                    <td className="p-4 text-right">
                      {["FAILED", "CANCELLED"].includes(job.status) && (
                        <JobRetryButton jobId={job.id} disabled={!canRetry} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!jobs.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">No background jobs recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}