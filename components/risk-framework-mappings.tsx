"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, HelpCircle, LoaderCircle, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { addRiskControlMapping, removeRiskControlMapping, reviewRiskControlMapping } from "@/app/actions/frameworks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEnum } from "@/lib/utils";
import type { FrameworkControlOption } from "@/components/framework-control-picker";

export type MappingItem = {
  id: string;
  notes: string | null;
  applicability: string | null;
  reviewedAt: Date | null;
  reviewedBy?: { name: string } | null;
  frameworkControl: FrameworkControlOption;
};

export function RiskFrameworkMappings({
  riskId,
  mappings,
  controls,
  editable,
}: {
  riskId: string;
  mappings: MappingItem[];
  controls: FrameworkControlOption[];
  editable: boolean;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<string>("APPLICABLE");
  const [reviewRationale, setReviewRationale] = useState<string>("");
  const [pending, start] = useTransition();

  const mapped = new Set(mappings.map((mapping) => mapping.frameworkControl.id));
  const available = controls
    .filter(
      (control) =>
        !mapped.has(control.id) &&
        (!query.trim() ||
          `${control.framework.name} ${control.controlId} ${control.title} ${control.description}`
            .toLowerCase()
            .includes(query.toLowerCase()))
    )
    .slice(0, 8);

  function add(controlId: string) {
    start(async () => {
      setError("");
      const result = await addRiskControlMapping(riskId, controlId);
      if ("error" in result) setError(result.error ?? "Unable to add this mapping.");
    });
  }

  function remove(mappingId: string) {
    start(async () => {
      setError("");
      const result = await removeRiskControlMapping(mappingId);
      if ("error" in result) setError(result.error ?? "Unable to remove this mapping.");
    });
  }

  function submitReview(mappingId: string) {
    start(async () => {
      setError("");
      const result = await reviewRiskControlMapping(mappingId, reviewDecision, reviewRationale);
      if ("error" in result) {
        setError(result.error ?? "Unable to save applicability decision.");
      } else {
        setActiveReviewId(null);
        setReviewRationale("");
      }
    });
  }

  const applicabilityVariant = (status: string | null) => {
    switch (status) {
      case "APPLICABLE":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "PARTIALLY_APPLICABLE":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "NOT_APPLICABLE":
        return "bg-slate-500/15 text-slate-300 border-slate-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-4">
      {mappings.length ? (
        <div className="divide-y rounded-md border">
          {mappings.map((mapping) => {
            const isReviewing = activeReviewId === mapping.id;
            return (
              <article key={mapping.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-bold uppercase text-primary">
                          {mapping.frameworkControl.framework.name} · {mapping.frameworkControl.controlId}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${applicabilityVariant(
                            mapping.applicability
                          )}`}
                        >
                          {mapping.applicability ? formatEnum(mapping.applicability) : "Pending applicability review"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold">{mapping.frameworkControl.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {mapping.frameworkControl.description}
                      </p>

                      {mapping.notes && (
                        <p className="mt-2 rounded bg-muted/40 p-2 text-xs text-foreground italic">
                          Rationale: {mapping.notes}
                        </p>
                      )}

                      {mapping.reviewedAt && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Reviewed {formatDate(mapping.reviewedAt)}
                          {mapping.reviewedBy?.name ? ` by ${mapping.reviewedBy.name}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {editable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          if (isReviewing) {
                            setActiveReviewId(null);
                          } else {
                            setActiveReviewId(mapping.id);
                            setReviewDecision(mapping.applicability || "APPLICABLE");
                            setReviewRationale(mapping.notes || "");
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isReviewing ? "Cancel" : "Review"}
                      </Button>
                    )}
                    {editable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        onClick={() => remove(mapping.id)}
                        aria-label={`Remove ${mapping.frameworkControl.controlId}`}
                        title="Remove mapping"
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Inline Applicability Decision Review Form */}
                {isReviewing && editable && (
                  <div className="mt-3 rounded-md border border-primary/20 bg-primary/[.04] p-3 text-xs">
                    <p className="font-semibold text-foreground">Record applicability decision & rationale</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-[160px_1fr]">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground">
                          Applicability
                        </label>
                        <select
                          value={reviewDecision}
                          onChange={(e) => setReviewDecision(e.target.value)}
                          className="mt-1 w-full rounded border border-border bg-background p-2 text-xs outline-none focus:border-primary"
                        >
                          <option value="APPLICABLE">Applicable</option>
                          <option value="PARTIALLY_APPLICABLE">Partially applicable</option>
                          <option value="NOT_APPLICABLE">Not applicable</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground">
                          Decision rationale & scope notes
                        </label>
                        <input
                          type="text"
                          value={reviewRationale}
                          onChange={(e) => setReviewRationale(e.target.value)}
                          placeholder="State why this control applies or why it is excluded/modified..."
                          className="mt-1 w-full rounded border border-border bg-background p-2 text-xs outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => setActiveReviewId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => submitReview(mapping.id)}
                      >
                        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : "Save decision"}
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          No framework controls mapped to this risk.
        </p>
      )}

      {editable && (
        <div className="rounded-md border bg-muted/30 p-3">
          <label className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <span className="sr-only">Search enabled controls</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find an enabled control to map"
              className="h-9 bg-background"
            />
          </label>
          {query && (
            <div className="mt-2 divide-y rounded-md border bg-background">
              {available.map((control) => (
                <div key={control.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase text-primary">
                      {control.framework.name} · {control.controlId}
                    </p>
                    <p className="truncate text-xs font-semibold">{control.title}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => add(control.id)}
                    aria-label={`Map ${control.controlId}`}
                    title="Add mapping"
                  >
                    {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </Button>
                </div>
              ))}
              {!available.length && (
                <p className="p-4 text-center text-xs text-muted-foreground">No available controls match.</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}