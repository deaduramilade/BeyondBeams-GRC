"use client";

import { useState } from "react";
import { Mail, LoaderCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailReportForm({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.get("type"),
          format: data.get("format"),
          recipients: String(data.get("recipients"))
            .split(/[;,]/)
            .map((x) => x.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Failed to email report.");
      } else {
        setMessage(`Report emailed to ${result.recipients} recipient(s) with single-use secure download link.`);
      }
    } catch {
      setError("Network error while delivering report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          Report
          <select name="type" className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="RISK_REGISTER">Risk Register</option>
            <option value="BOARD_REPORT">Board-Ready Risk Report (PDF)</option>
            <option value="GAP_ANALYSIS">Framework Gap Analysis</option>
            <option value="TREATMENT_STATUS">Treatment Status & Action Progress</option>
            <option value="CONTROL_EFFECTIVENESS">Control Effectiveness Summary</option>
            <option value="OVERDUE_ITEMS">Overdue Items (Reviews & Actions)</option>
            <option value="EXPOSURE_SUMMARY">Portfolio Exposure Summary</option>
            <option value="AUDIT_TRAIL">Audit Activity Trail</option>
          </select>
        </label>
        <label className="text-xs font-semibold">
          Format
          <select name="format" className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="PDF">PDF</option>
            <option value="XLSX">Excel (.xlsx)</option>
            <option value="CSV">CSV</option>
          </select>
        </label>
      </div>
      <label className="text-xs font-semibold">
        Recipients (comma separated)
        <Input name="recipients" type="text" defaultValue={email} className="mt-2" required />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} size="sm" className="gap-1.5">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Email secure report
        </Button>
        {message && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}