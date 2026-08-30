"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Building2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEnum } from "@/lib/utils";

export type RiskTableRow = {
  id: string;
  reference: string;
  title: string;
  category: string;
  status: string;
  residualScore: number | null;
  inherentScore: number;
  nextReviewDate: string;
  updatedAt: string;
  owner: { name: string };
  businessUnit?: { name: string } | null;
  objective?: { name: string } | null;
  riskSource?: { name: string } | null;
  regulatoryDomain?: { name: string } | null;
};

export function RiskTable({ risks }: { risks: RiskTableRow[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [businessUnitFilter, setBusinessUnitFilter] = useState("all");
  const [ascending, setAscending] = useState(false);

  // Extract unique business units
  const businessUnits = useMemo(() => {
    const set = new Set<string>();
    risks.forEach((r) => {
      if (r.businessUnit?.name) set.add(r.businessUnit.name);
    });
    return Array.from(set).sort();
  }, [risks]);

  const rows = useMemo(
    () =>
      risks
        .filter((r) => {
          const text = `${r.reference} ${r.title} ${r.owner.name} ${r.category} ${r.businessUnit?.name ?? ""} ${
            r.objective?.name ?? ""
          } ${r.riskSource?.name ?? ""} ${r.regulatoryDomain?.name ?? ""}`.toLowerCase();
          return text.includes(query.toLowerCase());
        })
        .filter((r) => {
          const s = r.residualScore ?? r.inherentScore;
          if (level === "high") return s >= 15;
          if (level === "medium") return s >= 7 && s < 15;
          if (level === "low") return s < 7;
          return true;
        })
        .filter((r) => {
          if (businessUnitFilter === "all") return true;
          return r.businessUnit?.name === businessUnitFilter;
        })
        .sort((a, b) => {
          const scoreA = a.residualScore ?? a.inherentScore;
          const scoreB = b.residualScore ?? b.inherentScore;
          return ascending ? scoreA - scoreB : scoreB - scoreA;
        }),
    [risks, query, level, businessUnitFilter, ascending]
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search risks, owners, business units, objectives..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by exposure"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-xs outline-none focus:border-primary"
          >
            <option value="all">All exposure</option>
            <option value="high">High exposure</option>
            <option value="medium">Medium exposure</option>
            <option value="low">Low exposure</option>
          </select>

          {businessUnits.length > 0 && (
            <select
              aria-label="Filter by business unit"
              value={businessUnitFilter}
              onChange={(e) => setBusinessUnitFilter(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-xs outline-none focus:border-primary"
            >
              <option value="all">All Business Units</option>
              {businessUnits.map((bu) => (
                <option key={bu} value={bu}>
                  {bu}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setAscending((x) => !x)}
            className="flex h-10 items-center gap-2 rounded-md border px-3 text-xs font-semibold hover:bg-muted/50"
          >
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            Score {ascending ? "↑" : "↓"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-[.1em] text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Risk</th>
              <th className="px-5 py-3">Business Unit & Category</th>
              <th className="px-5 py-3">Owner</th>
              <th className="px-5 py-3">Strategic Context</th>
              <th className="px-5 py-3">Exposure</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Next review</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-accent/30">
                <td className="px-5 py-4">
                  <Link href={`/app/risks/${r.id}`} className="block">
                    <span className="text-[10px] font-bold text-primary">{r.reference}</span>
                    <p className="mt-1 max-w-xs truncate text-sm font-semibold">{r.title}</p>
                  </Link>
                </td>
                <td className="px-5 py-4 text-xs">
                  <p className="font-medium text-foreground">
                    {r.businessUnit?.name ?? <span className="text-muted-foreground">General</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatEnum(r.category)}</p>
                </td>
                <td className="px-5 py-4 text-xs">{r.owner.name}</td>
                <td className="px-5 py-4 text-xs">
                  {r.objective?.name ? (
                    <p className="max-w-[180px] truncate text-foreground font-medium" title={r.objective.name}>
                      {r.objective.name}
                    </p>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {r.regulatoryDomain?.name && (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {r.regulatoryDomain.name}
                    </p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <RiskBadge score={r.residualScore} />
                </td>
                <td className="px-5 py-4">
                  <Badge className="border-border bg-muted text-muted-foreground font-semibold">
                    {formatEnum(r.status)}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-xs text-muted-foreground">
                  {formatDate(new Date(r.nextReviewDate))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="p-10 text-center text-sm text-muted-foreground">No risks match these filters.</p>
      )}
    </div>
  );
}