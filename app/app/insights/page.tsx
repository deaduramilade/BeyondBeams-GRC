import { requireSession } from "@/lib/authz";
import { getLatestAnalyticsSnapshot, getPortfolioAnalytics, levelForScore } from "@/lib/analytics";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatEnum } from "@/lib/utils";
import { SnapshotTrigger } from "@/components/snapshot-trigger";

export default async function Insights() {
  const session = await requireSession();
  const [analytics, latestSnapshot] = await Promise.all([
    getPortfolioAnalytics(session.user.tenantId),
    getLatestAnalyticsSnapshot(session.user.tenantId),
  ]);

  const categories = Object.entries(analytics.categoryDistribution).sort((a, b) => b[1] - a[1]);
  const businessUnits = Object.entries(analytics.businessUnitDistribution ?? {}).sort((a, b) => b[1] - a[1]);
  const objectives = Object.entries(analytics.objectiveDistribution ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          eyebrow="Risk analytics"
          title="Risk insights"
          description="A reconciled view of current exposure, governance work, control coverage, and appetite pressure."
        />
        <div className="mb-6">
          <SnapshotTrigger lastSnapshotAt={latestSnapshot?.createdAt ? latestSnapshot.createdAt.toISOString() : null} />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active risks" value={analytics.activeRiskCount} note={`${analytics.reconciliation.residualCount} with residual assessment`} />
        <Metric label="Total exposure" value={analytics.totalExposure} note={`Average ${analytics.averageExposure}`} />
        <Metric label="Appetite pressure" value={analytics.appetiteBreachCount} note="Open or actively managed breaches" />
        <Metric label="Overdue work" value={analytics.overdueReviewCount + analytics.overdueActionCount} note={`${analytics.overdueReviewCount} reviews · ${analytics.overdueActionCount} actions`} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold">Exposure heat map</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Residual exposure where available; inherent exposure is used only when residual assessment is absent.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-xs">
                <caption className="sr-only">Risk count by likelihood and impact</caption>
                <thead>
                  <tr>
                    <th className="p-2 text-left font-semibold">Likelihood \ Impact</th>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <th className="p-2 text-center font-semibold" key={value}>
                        {value}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[5, 4, 3, 2, 1].map((likelihood) => (
                    <tr key={likelihood}>
                      <th className="border p-2 text-left font-semibold">{likelihood}</th>
                      {[1, 2, 3, 4, 5].map((impact) => {
                        const cell = analytics.heatMap.find((item) => item.likelihood === likelihood && item.impact === impact)!;
                        return (
                          <td
                            className={`border p-3 text-center font-bold ${
                              cell.count ? levelClass(levelForScore(likelihood * impact)) : "bg-muted/30 text-muted-foreground"
                            }`}
                            key={impact}
                            aria-label={`${cell.count} risks, likelihood ${likelihood}, impact ${impact}`}
                          >
                            {cell.count || "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {["Low", "Moderate", "High", "Critical"].map((level) => (
                <span className="flex items-center gap-1.5" key={level}>
                  <span className={`size-2.5 rounded-sm ${levelClass(level)}`} />
                  {level}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold">Governance coverage</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <Coverage label="Treatment plans" value={analytics.treatmentCoveragePercent} />
            <Coverage label="Effective controls" value={analytics.controlEffectivenessPercent} />
            <div className="border-t pt-4">
              <p className="text-xs font-semibold">Reconciliation</p>
              <p className="mt-2 text-xs text-muted-foreground leading-5">
                {analytics.reconciliation.scoredRiskCount} of {analytics.reconciliation.registerCount} active register records have a valid score ({analytics.reconciliation.residualCount} residual, {analytics.reconciliation.inherentOnlyCount} inherent-only). {analytics.reconciliation.unscoredRiskCount} require initial scoring.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold">Category concentration</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {categories.map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{formatEnum(key)}</span>
                  <strong>{value}</strong>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(value / Math.max(analytics.activeRiskCount, 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold">Business unit distribution</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessUnits.map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-muted">
                  <div className="h-full bg-sky-400" style={{ width: `${(value / Math.max(analytics.activeRiskCount, 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="font-display text-4xl">{value}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function Coverage({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-muted">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function levelClass(level: string) {
  return level === "Critical"
    ? "bg-red-500/80 text-white font-bold"
    : level === "High"
    ? "bg-orange-500/80 text-white font-bold"
    : level === "Moderate"
    ? "bg-yellow-500/80 text-black font-bold"
    : "bg-emerald-500/80 text-white font-bold";
}
