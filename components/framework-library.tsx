"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  LoaderCircle,
  LockKeyhole,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { setFrameworkEnabled } from "@/app/actions/frameworks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatEnum } from "@/lib/utils";
import { frameworkChangelog } from "@/lib/frameworks";

export type ControlMapping = {
  risk: { id: string; reference: string; title: string };
};

export type Control = {
  id: string;
  controlId: string;
  title: string;
  description: string;
  category: string;
  mappings: ControlMapping[];
};

export type FrameworkItem = {
  id: string;
  name: string;
  version: string;
  description: string;
  industryTags: string;
  sourceUrl?: string | null;
  contentOwner?: string | null;
  applicability?: string | null;
  publicationDate?: Date | string | null;
  lastReviewedAt?: Date | string | null;
  enabled: boolean;
  controls: Control[];
};

export type HighUncoveredRisk = {
  id: string;
  reference: string;
  title: string;
  residualScore: number | null;
  treatment: string;
};

export function FrameworkLibrary({
  frameworks,
  canManage,
  plan,
  frameworkLimit,
  enabledCount,
  mappingCount,
  mappingLimit,
  unmappedRisks,
  highUncoveredRisks = [],
  applicabilityBreakdown = { applicable: 0, partiallyApplicable: 0, notApplicable: 0, pending: 0 },
}: {
  frameworks: FrameworkItem[];
  canManage: boolean;
  plan: string;
  frameworkLimit: number;
  enabledCount: number;
  mappingCount: number;
  mappingLimit: number | null;
  unmappedRisks: { id: string; reference: string; title: string }[];
  highUncoveredRisks?: HighUncoveredRisk[];
  applicabilityBreakdown?: {
    applicable: number;
    partiallyApplicable: number;
    notApplicable: number;
    pending: number;
  };
}) {
  const [activeTab, setActiveTab] = useState<"catalog" | "gap_analysis" | "changelog">("catalog");
  const [expanded, setExpanded] = useState<string | null>(frameworks.find((f) => f.enabled)?.id ?? null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function toggle(framework: FrameworkItem) {
    start(async () => {
      setMessage("");
      const result = await setFrameworkEnabled(framework.id, !framework.enabled);
      if ("error" in result) setMessage(result.error ?? "Unable to update this framework.");
    });
  }

  const enabledList = frameworks.filter((f) => f.enabled);

  return (
    <div className="space-y-6">
      {/* Governance & Legal Disclaimer Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[.06] p-4 text-xs leading-5 text-slate-200">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <strong className="text-teal-200">Governance & Reference Aid:</strong> The seeded control catalogues (ISO
          27001, NIST CSF 2.0, SOC 2, HIPAA Security Rule, Fintech/Payments) and mapping recommendations are provided
          solely as reference frameworks for accountable internal governance. They do not constitute legal advice,
          official regulatory certification, or an authoritative conformance finding.
        </div>
      </div>

      {/* Metrics Row */}
      <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        <Metric label="Enabled frameworks" value={`${enabledCount} / ${frameworkLimit}`} />
        <Metric
          label="Control mappings"
          value={mappingLimit === null ? `${mappingCount} · Unlimited` : `${mappingCount} / ${mappingLimit}`}
        />
        <Metric label="Risks awaiting mapping" value={String(unmappedRisks.length)} />
        <Metric label="High exposure uncovered" value={String(highUncoveredRisks.length)} accent={highUncoveredRisks.length > 0} />
      </section>

      {message && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center">
          <LockKeyhole className="size-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-xs">{message}</p>
          <Button asChild size="sm">
            <Link href="/#pricing">View plans</Link>
          </Button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              activeTab === "catalog"
                ? "bg-primary text-[#052b31]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <BookOpen className="size-3.5" />
            Catalogues & Controls
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gap_analysis")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              activeTab === "gap_analysis"
                ? "bg-primary text-[#052b31]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ShieldAlert className="size-3.5" />
            Interactive Gap Analysis
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("changelog")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              activeTab === "changelog"
                ? "bg-primary text-[#052b31]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <History className="size-3.5" />
            Version History & Changelog
          </button>
        </div>

        {activeTab === "catalog" && (
          <label className="flex w-full items-center gap-2 sm:w-64">
            <Search className="size-4 text-muted-foreground" />
            <span className="sr-only">Search controls</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search controls..."
              className="h-8 text-xs"
            />
          </label>
        )}

        {activeTab === "gap_analysis" && (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <a href="/api/reports?type=GAP_ANALYSIS&format=PDF" target="_blank" rel="noreferrer">
                <FileText className="size-3.5 text-primary" />
                Export PDF
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <a href="/api/reports?type=GAP_ANALYSIS&format=XLSX" download>
                <FileSpreadsheet className="size-3.5 text-emerald-400" />
                Export Excel (.xlsx)
              </a>
            </Button>
          </div>
        )}
      </div>

      {/* TAB 1: CATALOGUES & CONTROLS */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="space-y-3">
            {frameworks.map((framework) => {
              const open = expanded === framework.id;
              const controls = framework.controls.filter(
                (control) =>
                  !query ||
                  `${control.controlId} ${control.title} ${control.description} ${control.category}`
                    .toLowerCase()
                    .includes(query.toLowerCase())
              );
              const covered = framework.controls.filter((control) => control.mappings.length).length;

              return (
                <section
                  key={framework.id}
                  className={cn("overflow-hidden rounded-lg border bg-card", framework.enabled && "border-primary/40")}
                >
                  <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : framework.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 text-muted-foreground">
                        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </span>
                      <span>
                        <span className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm">{framework.name}</strong>
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-mono">
                            {framework.version}
                          </span>
                          {framework.enabled && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                              Enabled
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block max-w-3xl text-xs leading-5 text-muted-foreground">
                          {framework.description}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
                          {framework.contentOwner && <span>Owner: {framework.contentOwner}</span>}
                          {framework.publicationDate && (
                            <span>Published: {formatDate(new Date(framework.publicationDate))}</span>
                          )}
                          {framework.lastReviewedAt && (
                            <span>Last reviewed: {formatDate(new Date(framework.lastReviewedAt))}</span>
                          )}
                          {framework.sourceUrl && (
                            <a
                              href={framework.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              Official source <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </span>
                      </span>
                    </button>

                    <div className="flex items-center gap-5 pl-7 md:pl-0">
                      <div className="text-right">
                        <p className="text-xs font-bold font-mono">
                          {covered} / {framework.controls.length}
                        </p>
                        <p className="text-[10px] text-muted-foreground">controls mapped</p>
                      </div>
                      {canManage && (
                        <Button
                          type="button"
                          size="sm"
                          variant={framework.enabled ? "outline" : "default"}
                          disabled={pending}
                          onClick={() => toggle(framework)}
                        >
                          {pending ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : framework.enabled ? (
                            "Disable"
                          ) : (
                            "Enable"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div className="border-t bg-muted/20 p-3 sm:p-5">
                      {framework.applicability && (
                        <p className="mb-4 rounded border border-white/10 bg-background/50 p-2.5 text-xs text-muted-foreground italic">
                          <strong>Applicability note:</strong> {framework.applicability}
                        </p>
                      )}

                      <div className="overflow-x-auto rounded-md border bg-background">
                        <table className="w-full min-w-[760px] text-left">
                          <thead className="border-b bg-muted/50 text-[10px] uppercase text-muted-foreground">
                            <tr>
                              <th className="w-28 p-3">Control</th>
                              <th className="p-3">Requirement</th>
                              <th className="w-36 p-3">Category</th>
                              <th className="w-48 p-3">Mapped risks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {controls.map((control) => (
                              <tr key={control.id} className="align-top">
                                <td className="p-3 text-xs font-bold text-primary font-mono">{control.controlId}</td>
                                <td className="p-3">
                                  <p className="text-xs font-bold">{control.title}</p>
                                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                    {control.description}
                                  </p>
                                </td>
                                <td className="p-3 text-[11px] text-muted-foreground">{control.category}</td>
                                <td className="p-3">
                                  {control.mappings.length ? (
                                    control.mappings.slice(0, 3).map(({ risk }) => (
                                      <Link
                                        key={risk.id}
                                        href={`/app/risks/${risk.id}`}
                                        className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                                      >
                                        {risk.reference}
                                        <ExternalLink className="size-2.5" />
                                      </Link>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">No mapped risks</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {!controls.length && (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">
                                  No controls match this search.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {unmappedRisks.length > 0 && (
            <section className="border-t pt-5">
              <h2 className="text-sm font-bold">Risks without framework coverage</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These active risks are not yet mapped to any controls in your enabled standards.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {unmappedRisks.slice(0, 8).map((risk) => (
                  <Link
                    key={risk.id}
                    href={`/app/risks/${risk.id}`}
                    className="flex items-center justify-between rounded-md border bg-card p-3 text-xs hover:border-primary/40"
                  >
                    <span>
                      <strong className="text-primary">{risk.reference}</strong>
                      <span className="ml-2 text-muted-foreground">{risk.title}</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE GAP ANALYSIS */}
      {activeTab === "gap_analysis" && (
        <div className="space-y-6">
          {/* Framework Coverage Progress Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {enabledList.map((framework) => {
              const total = framework.controls.length;
              const mapped = framework.controls.filter((c) => c.mappings.length > 0).length;
              const percent = total > 0 ? Math.round((mapped / total) * 100) : 0;

              return (
                <div key={framework.id} className="rounded-lg border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{framework.name}</h3>
                      <p className="text-xs text-muted-foreground">{framework.version}</p>
                    </div>
                    <span className="font-display text-xl text-primary">{percent}%</span>
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {mapped} of {total} controls mapped
                    </span>
                    <span>{total - mapped} unmapped</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* High Exposure Risks without Control Coverage */}
          {highUncoveredRisks.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/[.04] p-5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" />
                <h3 className="text-sm font-bold">High residual exposure risks lacking control coverage</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                These risks have a high residual score (≥ 15) but have zero mapped framework controls. Prioritise control
                mapping or treatment.
              </p>
              <div className="mt-3 divide-y rounded-md border bg-background">
                {highUncoveredRisks.map((risk) => (
                  <div key={risk.id} className="flex items-center justify-between p-3 text-xs">
                    <div>
                      <Link
                        href={`/app/risks/${risk.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {risk.reference}
                      </Link>
                      <span className="ml-2 font-medium text-foreground">{risk.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded bg-destructive/15 px-2 py-0.5 font-bold text-destructive">
                        Score: {risk.residualScore}
                      </span>
                      <Badge className="border-border bg-muted/50 text-muted-foreground">{formatEnum(risk.treatment)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmapped Controls across Enabled Standards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground">Unmapped controls in enabled frameworks</h3>
            <div className="divide-y rounded-lg border bg-card">
              {enabledList.flatMap((f) =>
                f.controls
                  .filter((c) => c.mappings.length === 0)
                  .map((control) => (
                    <div key={control.id} className="p-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-primary font-bold">
                          {f.name} · {control.controlId}
                        </span>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {control.category}
                        </span>
                      </div>
                      <p className="mt-1 font-bold text-foreground">{control.title}</p>
                      <p className="mt-1 text-muted-foreground leading-5">{control.description}</p>
                    </div>
                  ))
              )}
              {enabledList.every((f) => f.controls.every((c) => c.mappings.length > 0)) && (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  All controls in your enabled frameworks have at least one mapped risk!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VERSION HISTORY & CHANGELOG */}
      {activeTab === "changelog" && (
        <div className="space-y-5">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground">Catalogue governance & traceable version history</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              BeyondBeams tracks authoritative source publications and updates reference control baselines to align with
              standards bodies and supervisory guidelines.
            </p>

            <div className="mt-6 space-y-6">
              {frameworkChangelog.map((entry, idx) => (
                <div key={idx} className="relative border-l border-primary/30 pl-6 last:border-0">
                  <span className="absolute -left-1.5 top-0 size-3 rounded-full border-2 border-card bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <strong className="text-sm text-foreground">{entry.frameworkName}</strong>
                    <span className="font-mono text-xs text-primary font-semibold">{entry.version}</span>
                    <span className="text-[10px] text-muted-foreground">Released {entry.releasedAt}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-300">{entry.sourceAuthority}</p>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">{entry.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card p-4">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-2xl", accent ? "text-destructive" : "text-primary")}>{value}</p>
    </div>
  );
}