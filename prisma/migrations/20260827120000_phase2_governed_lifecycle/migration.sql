-- Phase 2 governed lifecycle foundation. Additive and forward-only.
ALTER TYPE "RiskStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
CREATE TYPE "ReviewOutcome" AS ENUM ('CONTINUE', 'REASSESS', 'CLOSE', 'ESCALATE');
CREATE TYPE "ControlTestResult" AS ENUM ('NOT_TESTED', 'PASS', 'PARTIAL', 'FAIL');

ALTER TABLE "Evidence" ADD COLUMN "riskId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN "accessLevel" TEXT NOT NULL DEFAULT 'WORKSPACE';
ALTER TABLE "Evidence" ADD COLUMN "retentionUntil" TIMESTAMP(3);

CREATE TABLE "RiskReview" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "riskId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL, "scheduledFor" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3), "outcome" "ReviewOutcome", "notes" TEXT,
  "reassessmentRequested" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreatmentActionHistory" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "treatmentActionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "fromStatus" "TreatmentActionStatus",
  "toStatus" "TreatmentActionStatus" NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreatmentActionHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ControlTest" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "controlProfileId" TEXT NOT NULL,
  "testDate" TIMESTAMP(3) NOT NULL, "result" "ControlTestResult" NOT NULL,
  "testerId" TEXT NOT NULL, "notes" TEXT, "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ControlTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScoringPolicy" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL, "bandsJson" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoringPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskReview_tenantId_scheduledFor_idx" ON "RiskReview"("tenantId", "scheduledFor");
CREATE INDEX "RiskReview_tenantId_riskId_completedAt_idx" ON "RiskReview"("tenantId", "riskId", "completedAt");
CREATE INDEX "TreatmentActionHistory_tenantId_treatmentActionId_createdAt_idx" ON "TreatmentActionHistory"("tenantId", "treatmentActionId", "createdAt");
CREATE INDEX "ControlTest_tenantId_controlProfileId_testDate_idx" ON "ControlTest"("tenantId", "controlProfileId", "testDate");
CREATE UNIQUE INDEX "ScoringPolicy_tenantId_version_key" ON "ScoringPolicy"("tenantId", "version");
CREATE INDEX "ScoringPolicy_tenantId_active_effectiveAt_idx" ON "ScoringPolicy"("tenantId", "active", "effectiveAt");

ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskReview" ADD CONSTRAINT "RiskReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskReview" ADD CONSTRAINT "RiskReview_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskReview" ADD CONSTRAINT "RiskReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "TreatmentActionHistory" ADD CONSTRAINT "TreatmentActionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentActionHistory" ADD CONSTRAINT "TreatmentActionHistory_treatmentActionId_fkey" FOREIGN KEY ("treatmentActionId") REFERENCES "TreatmentAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentActionHistory" ADD CONSTRAINT "TreatmentActionHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_controlProfileId_fkey" FOREIGN KEY ("controlProfileId") REFERENCES "ControlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScoringPolicy" ADD CONSTRAINT "ScoringPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoringPolicy" ADD CONSTRAINT "ScoringPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;