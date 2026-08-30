"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import {
  createAssessment, createEvidence, createTreatment, createTreatmentAction,
  decideAssessment, decideTreatment, escalateOverdueActions, recordControlTest,
  recordRiskReview, submitAssessment, transitionRisk, updateTreatmentAction,
  upsertControlProfile, upsertReviewSchedule, updateReassessmentRequest,
} from "@/app/actions/governance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };
type Result = { error?: string; success?: boolean; id?: string };

function ActionForm({ children, action, submitLabel = "Save", allowed = true, disabledReason }: { children: React.ReactNode; action: (data: FormData) => Promise<Result>; submitLabel?: string; allowed?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const result = await action(new FormData(event.currentTarget));
    setMessage(result.error ?? "Saved successfully."); setBusy(false);
    if (!result.error) { event.currentTarget.reset(); router.refresh(); }
  }
  return <form onSubmit={submit} className="grid gap-3"><fieldset disabled={!allowed || busy} className="grid gap-3">{children}<Button disabled={busy || !allowed} title={!allowed ? disabledReason : undefined}>{busy ? <LoaderCircle className="size-4 animate-spin"/> : <Check className="size-4"/>}{allowed ? submitLabel : `${submitLabel} unavailable`}</Button></fieldset>{!allowed && <p className="text-xs text-muted-foreground" role="note">{disabledReason}</p>}{message && <p role="status" aria-live="polite" className={message === "Saved successfully." ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{message}</p>}</form>;
}

export function Field({ name, label, type = "text", required = true, min, max }: { name: string; label: string; type?: string; required?: boolean; min?: number; max?: number }) {
  return <div className="grid gap-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} min={min} max={max}/></div>;
}

export function SelectField({ name, label, options, required = true }: { name: string; label: string; options: Option[]; required?: boolean }) {
  return <div className="grid gap-1.5"><Label htmlFor={name}>{label}</Label><select id={name} name={name} required={required} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

export function AssessmentCreateForm({ risks, allowed = true }: { risks: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Assessment creation requires risk update permission." action={(data) => createAssessment({ riskId: data.get("riskId"), type: data.get("type"), likelihood: data.get("likelihood"), impact: data.get("impact"), rationale: data.get("rationale") })} submitLabel="Create draft assessment"><SelectField name="riskId" label="Risk" options={risks}/><SelectField name="type" label="Assessment type" options={[{ value: "INHERENT", label: "Inherent" }, { value: "RESIDUAL", label: "Residual" }]}/><div className="grid grid-cols-2 gap-3"><Field name="likelihood" label="Likelihood" type="number" min={1} max={5}/><Field name="impact" label="Impact" type="number" min={1} max={5}/></div><Field name="rationale" label="Assessment rationale"/></ActionForm>;
}

export function AssessmentDecisionForm({ assessmentId, status, canSubmit, canDecide }: { assessmentId: string; status: string; canSubmit: boolean; canDecide: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<Result>) {
    setBusy(true);
    const result = await action();
    setMessage(result.error ?? "Saved successfully.");
    setBusy(false);
    if (!result.error) router.refresh();
  }
  return (
    <div className="grid gap-3">
      {["DRAFT", "REJECTED"].includes(status) && (
        canSubmit ? (
          <Button disabled={busy} onClick={() => run(() => submitAssessment(assessmentId))}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
            Submit for independent decision
          </Button>
        ) : (
          <div className="space-y-2">
            <Button disabled title="Assessment submission requires risk update permission.">Submit unavailable</Button>
            <p className="text-xs text-muted-foreground" role="note">Assessment submission requires risk update permission.</p>
          </div>
        )
      )}
      {status === "SUBMITTED" && (
        canDecide ? (
          <>
            <div>
              <Label htmlFor={`decision-${assessmentId}`}>Decision rationale</Label>
              <Input id={`decision-${assessmentId}`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Document the approval or rejection basis" />
            </div>
            <div className="flex gap-2">
              <Button disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAssessment(assessmentId, "APPROVED", reason))}>Approve</Button>
              <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => run(() => decideAssessment(assessmentId, "REJECTED", reason))}>Reject</Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground" role="note">Deciding assessments requires assessment approval permission (Owner or Risk Manager).</p>
        )
      )}
      {status === "APPROVED" && (
        <p className="text-xs text-muted-foreground">This assessment is approved and locked.</p>
      )}
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

export function TreatmentPlanForm({ risks, allowed = true }: { risks: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Treatment changes require treatment management permission." action={(data) => createTreatment({ riskId: data.get("riskId"), strategy: data.get("strategy"), summary: data.get("summary"), targetDate: data.get("targetDate") })} submitLabel="Create treatment plan"><SelectField name="riskId" label="Risk" options={risks}/><SelectField name="strategy" label="Strategy" options={["ACCEPT", "MITIGATE", "TRANSFER", "AVOID"].map((value) => ({ value, label: value }))}/><Field name="summary" label="Measurable treatment outcome"/><Field name="targetDate" label="Target date" type="date"/></ActionForm>;
}

export function TreatmentActionForm({ plans, users, allowed = true }: { plans: Option[]; users: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Treatment actions require treatment management permission." action={(data) => createTreatmentAction({ treatmentPlanId: data.get("treatmentPlanId"), title: data.get("title"), description: data.get("description"), ownerId: data.get("ownerId"), dueDate: data.get("dueDate"), priority: data.get("priority") })} submitLabel="Add treatment action"><SelectField name="treatmentPlanId" label="Treatment plan" options={plans}/><Field name="title" label="Action title"/><Field name="description" label="Required outcome"/><SelectField name="ownerId" label="Owner" options={users}/><div className="grid grid-cols-2 gap-3"><Field name="dueDate" label="Due date" type="date"/><SelectField name="priority" label="Priority" options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ value, label: value }))}/></div></ActionForm>;
}

export function TreatmentDecision({ planId, allowed = true }: { planId: string; allowed?: boolean }) {
  const router = useRouter(); const [reason, setReason] = useState(""); const [message, setMessage] = useState("");
  async function decide(status: "APPROVED" | "REJECTED") { const result = await decideTreatment(planId, status, reason); setMessage(result.error ?? "Saved successfully."); if (!result.error) router.refresh(); }
  return <fieldset disabled={!allowed} className="grid gap-2">{!allowed && <p className="text-xs text-muted-foreground" role="note">Decision authority requires treatment approval permission.</p>}<Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Decision rationale (minimum 10 characters)"/><div className="flex gap-2"><Button size="sm" disabled={reason.length < 10 || !allowed} onClick={() => decide("APPROVED")}>Approve</Button><Button size="sm" variant="destructive" disabled={reason.length < 10 || !allowed} onClick={() => decide("REJECTED")}>Reject</Button></div>{message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}</fieldset>;
}

export function TreatmentActionUpdate({ actionId, currentStatus, allowed = true }: { actionId: string; currentStatus: string; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Action updates require treatment management permission." action={(data) => updateTreatmentAction(actionId, String(data.get("status")) as never, String(data.get("note") ?? ""))} submitLabel="Update action"><SelectField name="status" label="Status" options={["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"].map((value) => ({ value, label: value.replaceAll("_", " ") }))}/><Field name="note" label={currentStatus === "COMPLETED" ? "History note" : "Completion or status note"}/></ActionForm>;
}

export function OverdueEscalationButton({ allowed = true }: { allowed?: boolean }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  return <div>{allowed ? <Button variant="outline" onClick={async () => { const result = await escalateOverdueActions(); setMessage(`${result.count ?? 0} overdue action(s) escalated.`); router.refresh(); }}>Run overdue escalation</Button> : <p className="text-xs text-muted-foreground" role="note">Escalation requires treatment management permission.</p>}{message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}</div>;
}

export function ControlProfileForm({ controls, users, allowed = true }: { controls: Option[]; users: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Control changes require control management permission." action={(data) => upsertControlProfile({ frameworkControlId: data.get("frameworkControlId"), ownerId: data.get("ownerId") || undefined, implementationStatus: data.get("implementationStatus"), effectiveness: data.get("effectiveness"), frequency: data.get("frequency"), notes: data.get("notes") || undefined })} submitLabel="Save control profile"><SelectField name="frameworkControlId" label="Framework control" options={controls}/><SelectField name="ownerId" label="Control owner" options={users} required={false}/><SelectField name="implementationStatus" label="Implementation" options={["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"].map((value) => ({ value, label: value.replaceAll("_", " ") }))}/><SelectField name="effectiveness" label="Effectiveness" options={["NOT_ASSESSED", "INEFFECTIVE", "PARTIALLY_EFFECTIVE", "EFFECTIVE"].map((value) => ({ value, label: value.replaceAll("_", " ") }))}/><Field name="frequency" label="Testing frequency"/><Field name="notes" label="Control notes" required={false}/></ActionForm>;
}

export function ControlTestForm({ profiles, evidence, allowed = true }: { profiles: Option[]; evidence: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Recording control test results requires control management permission." action={(data) => recordControlTest({ controlProfileId: data.get("controlProfileId"), testDate: data.get("testDate"), result: data.get("result"), notes: data.get("notes") || undefined, evidenceId: data.get("evidenceId") || undefined })} submitLabel="Record test result"><SelectField name="controlProfileId" label="Control profile" options={profiles}/><Field name="testDate" label="Test date" type="date"/><SelectField name="result" label="Result" options={["PASS", "PARTIAL", "FAIL", "NOT_TESTED"].map((value) => ({ value, label: value }))}/><SelectField name="evidenceId" label="Evidence" options={evidence} required={false}/><Field name="notes" label="Test notes"/></ActionForm>;
}

export function ReviewForm({ risks, allowed = true }: { risks: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Recording review outcomes requires risk update permission." action={(data) => recordRiskReview({ riskId: data.get("riskId"), scheduledFor: data.get("scheduledFor"), outcome: data.get("outcome"), notes: data.get("notes"), nextReviewDate: data.get("nextReviewDate") })} submitLabel="Record review outcome"><SelectField name="riskId" label="Risk" options={risks}/><Field name="scheduledFor" label="Scheduled review date" type="date"/><SelectField name="outcome" label="Outcome" options={["CONTINUE", "REASSESS", "CLOSE", "ESCALATE"].map((value) => ({ value, label: value }))}/><Field name="notes" label="Review rationale"/><Field name="nextReviewDate" label="Next review date" type="date"/></ActionForm>;
}

export function ReviewScheduleForm({ risks, allowed = true }: { risks: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Setting a review schedule requires risk update permission." action={(data) => upsertReviewSchedule({ riskId: data.get("riskId"), cadenceMonths: data.get("cadenceMonths") })} submitLabel="Save review schedule"><SelectField name="riskId" label="Risk" options={risks}/><Field name="cadenceMonths" label="Cadence in months" type="number" min={1} max={24}/></ActionForm>;
}

export function ReassessmentUpdateForm({ requestId, status, users, allowed = true }: { requestId: string; status: string; users: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Updating reassessment requests requires risk update permission." action={(data) => updateReassessmentRequest({ requestId, status: data.get("status"), assignedToId: data.get("assignedToId") || undefined, notes: data.get("notes") || undefined })} submitLabel={`Mark ${status.toLowerCase().replaceAll("_", " ")}`}><SelectField name="status" label="Status" options={status === "OPEN" ? [{ value: "IN_PROGRESS", label: "In progress" }, { value: "CANCELLED", label: "Cancelled" }] : [{ value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" }]}/><SelectField name="assignedToId" label="Assignee" options={users} required={false}/><Field name="notes" label="Notes" required={false}/></ActionForm>;
}

export function LifecycleTransitionForm({ riskId, options, allowed = true }: { riskId: string; options: string[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Lifecycle transitions require risk update permission." action={(data) => transitionRisk(riskId, String(data.get("status")) as never, String(data.get("reason")))} submitLabel="Apply transition"><SelectField name="status" label="Next status" options={options.map((value) => ({ value, label: value.replaceAll("_", " ") }))}/><Field name="reason" label="Transition rationale"/></ActionForm>;
}

export function EvidenceForm({ risks, plans, actions, controls, allowed = true }: { risks: Option[]; plans: Option[]; actions: Option[]; controls: Option[]; allowed?: boolean }) {
  return <ActionForm allowed={allowed} disabledReason="Evidence registration requires evidence management permission." action={(data) => createEvidence({ title: data.get("title"), description: data.get("description") || undefined, fileName: data.get("fileName") || undefined, mimeType: data.get("mimeType") || undefined, riskId: data.get("riskId") || undefined, treatmentPlanId: data.get("treatmentPlanId") || undefined, treatmentActionId: data.get("treatmentActionId") || undefined, controlProfileId: data.get("controlProfileId") || undefined, accessLevel: data.get("accessLevel"), expiresAt: data.get("expiresAt") || undefined, retentionUntil: data.get("retentionUntil") || undefined })} submitLabel="Register evidence metadata"><Field name="title" label="Evidence title"/><Field name="description" label="Description"/><div className="grid grid-cols-2 gap-3"><Field name="fileName" label="File name" required={false}/><Field name="mimeType" label="MIME type" required={false}/></div><SelectField name="riskId" label="Risk link" options={risks} required={false}/><SelectField name="treatmentPlanId" label="Treatment plan link" options={plans} required={false}/><SelectField name="treatmentActionId" label="Action link" options={actions} required={false}/><SelectField name="controlProfileId" label="Control link" options={controls} required={false}/><SelectField name="accessLevel" label="Access level" options={[{ value: "WORKSPACE", label: "Workspace" }, { value: "RESTRICTED", label: "Restricted" }]}/><div className="grid grid-cols-2 gap-3"><Field name="expiresAt" label="Expires" type="date" required={false}/><Field name="retentionUntil" label="Retain until" type="date" required={false}/></div></ActionForm>;
}
