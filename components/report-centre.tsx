"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  LockKeyhole,
  Mail,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmailReportForm } from "@/components/email-report-form";
import { cn, formatEnum } from "@/lib/utils";

export type ReportAllowanceInfo = {
  allowed: boolean;
  used: number;
  limit: number;
  plan: string;
};

export type ReportCentreProps = {
  allowance: ReportAllowanceInfo;
  userEmail: string;
  reconciliation: {
    activeRiskCount: number;
    scoredRiskCount: number;
    openTreatmentCount: number;
    effectiveControlCount: number;
    overdueItemCount: number;
  };
};

const reportCards = [
  {
    type: "RISK_REGISTER",
    title: "Risk Register",
    eyebrow: "Operations",
    description: "Complete inventory of active risks with taxonomy joins, scores, status, owners, and review dates.",
    formats: ["CSV", "XLSX", "PDF"],
    icon: FileText,
  },
  {
    type: "BOARD_REPORT",
    title: "Board Risk Report",
    eyebrow: "Executive",
    description: "Executive risk briefing with visual 5×5 residual exposure heat map, top exposures, and treatment momentum.",
    formats: ["PDF"],
    icon: BarChart3,
  },
  {
    type: "GAP_ANALYSIS",
    title: "Framework Gap Analysis",
    eyebrow: "Compliance",
    description: "Coverage analysis across enabled standards, unmapped controls, unmapped risks, and high-exposure gaps.",
    formats: ["PDF", "XLSX"],
    icon: Scale,
  },
  {
    type: "TREATMENT_STATUS",
    title: "Treatment Status & Actions",
    eyebrow: "Operations",
    description: "Action progress, owner accountability, target completion dates, and overdue treatment action rollups.",
    formats: ["CSV", "XLSX", "PDF"],
    icon: Layers,
  },
  {
    type: "CONTROL_EFFECTIVENESS",
    title: "Control Effectiveness Summary",
    eyebrow: "Governance",
    description: "Control catalogue profiles, implementation status, test frequencies, and latest testing outcomes.",
    formats: ["CSV", "XLSX", "PDF"],
    icon: ShieldCheck,
  },
  {
    type: "OVERDUE_ITEMS",
    title: "Overdue Items Report",
    eyebrow: "Assurance",
    description: "Consolidated register of overdue risk reviews and overdue treatment actions requiring immediate management intervention.",
    formats: ["CSV", "XLSX", "PDF"],
    icon: Clock,
  },
  {
    type: "EXPOSURE_SUMMARY",
    title: "Portfolio Exposure Summary",
    eyebrow: "Intelligence",
    description: "Exposure distribution bands, appetite breach pressures, category breakdowns, and ranked residual risk table.",
    formats: ["CSV", "XLSX", "PDF"],
    icon: ShieldAlert,
  },
  {
    type: "AUDIT_TRAIL",
    title: "Audit Activity Trail",
    eyebrow: "Assurance",
    description: "Chronological immutable event ledger of creations, mutations, approvals, and deletions across the workspace.",
    formats: ["CSV", "XLSX", "PDF"],
    icon: History,
  },
];

export function ReportCentre({ allowance, userEmail, reconciliation }: ReportCentreProps) {
  const [activeTab, setActiveTab] = useState<"catalogue" | "email">("catalogue");

  const isUnlimited = !Number.isFinite(allowance.limit);
  const remaining = isUnlimited ? "Unlimited" : Math.max(0, allowance.limit - allowance.used);

  return (
    <div className="space-y-6">
      {/* Quota & Reconciliation Row */}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Monthly export quota</p>
          <p className="mt-1 font-display text-2xl text-primary">
            {allowance.used} / {isUnlimited ? "∞" : allowance.limit}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{remaining} exports remaining this month</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Active risk inventory</p>
          <p className="mt-1 font-display text-2xl text-foreground">{reconciliation.activeRiskCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{reconciliation.scoredRiskCount} with scored assessments</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Active treatments</p>
          <p className="mt-1 font-display text-2xl text-foreground">{reconciliation.openTreatmentCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Approved treatment plans</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Overdue items</p>
          <p className={cn("mt-1 font-display text-2xl", reconciliation.overdueItemCount > 0 ? "text-destructive" : "text-emerald-400")}>
            {reconciliation.overdueItemCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Overdue reviews and actions</p>
        </div>
      </section>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("catalogue")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
            activeTab === "catalogue" ? "bg-primary text-[#052b31]" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <FileText className="size-3.5" />
          Report Catalogue ({reportCards.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("email")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
            activeTab === "email" ? "bg-primary text-[#052b31]" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Mail className="size-3.5" />
          Email Secure Delivery
        </button>
      </div>

      {/* TAB 1: REPORT CATALOGUE */}
      {activeTab === "catalogue" && (
        <div className="grid gap-4 md:grid-cols-2">
          {reportCards.map((report) => {
            const Icon = report.icon;
            return (
              <Card key={report.type} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-primary">{report.eyebrow}</p>
                        <h3 className="text-sm font-bold text-foreground">{report.title}</h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-5">{report.description}</p>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase mr-1">Download:</span>
                    {report.formats.includes("PDF") && (
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1">
                        <a href={`/api/reports?type=${report.type}&format=PDF`} target="_blank" rel="noreferrer">
                          <FileText className="size-3 text-red-400" />
                          PDF
                        </a>
                      </Button>
                    )}
                    {report.formats.includes("XLSX") && (
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1">
                        <a href={`/api/reports?type=${report.type}&format=XLSX`} download>
                          <FileSpreadsheet className="size-3 text-emerald-400" />
                          Excel (.xlsx)
                        </a>
                      </Button>
                    )}
                    {report.formats.includes("CSV") && (
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1">
                        <a href={`/api/reports?type=${report.type}&format=CSV`} download>
                          <Download className="size-3 text-sky-400" />
                          CSV
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 2: EMAIL SECURE DELIVERY */}
      {activeTab === "email" && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold">Deliver secure reports to stakeholders</h2>
            <p className="text-xs text-muted-foreground">
              Generated reports are delivered via email with a time-limited, single-use download link that expires in 24 hours.
            </p>
          </CardHeader>
          <CardContent>
            <EmailReportForm email={userEmail} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
