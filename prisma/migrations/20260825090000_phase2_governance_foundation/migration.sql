-- Governance models that were present in the Prisma schema but missing from
-- the original PostgreSQL migration chain. This migration must precede Phase 3.

ALTER TABLE "User" ADD COLUMN "securityOnboardingCompletedAt" TIMESTAMP(3);

CREATE TYPE "AssessmentType" AS ENUM ('INHERENT', 'RESIDUAL');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "TreatmentActionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ControlEffectiveness" AS ENUM ('NOT_ASSESSED', 'INEFFECTIVE', 'PARTIALLY_EFFECTIVE', 'EFFECTIVE');
CREATE TYPE "EvidenceStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "AppetiteBreachStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'TREATING', 'ACCEPTED', 'RESOLVED');
CREATE TYPE "TaxonomyType" AS ENUM ('RISK_CATEGORY', 'BUSINESS_UNIT', 'OBJECTIVE', 'RISK_SOURCE', 'REGULATORY_DOMAIN', 'TAG');

CREATE TABLE "Assessment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "type" "AssessmentType" NOT NULL,
  "revision" INTEGER NOT NULL,
  "likelihood" INTEGER NOT NULL,
  "impact" INTEGER NOT NULL,
  "score" INTEGER NOT NULL,
  "rationale" TEXT NOT NULL,
  "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "authorId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreatmentPlan" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "strategy" "RiskTreatment" NOT NULL,
  "summary" TEXT NOT NULL,
  "targetDate" TIMESTAMP(3) NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalDecision" (
  "id" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL,
  "rationale" TEXT NOT NULL,
  "decidedById" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreatmentAction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" "TreatmentActionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreatmentAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ControlProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "frameworkControlId" TEXT NOT NULL,
  "ownerId" TEXT,
  "implementationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "effectiveness" "ControlEffectiveness" NOT NULL DEFAULT 'NOT_ASSESSED',
  "frequency" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "nextTestDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ControlProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxonomyItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" "TaxonomyType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxonomyItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "storageKey" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "checksum" TEXT,
  "status" "EvidenceStatus" NOT NULL DEFAULT 'DRAFT',
  "validFrom" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "uploadedById" TEXT NOT NULL,
  "treatmentPlanId" TEXT,
  "treatmentActionId" TEXT,
  "controlProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppetiteStatement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "RiskCategory",
  "taxonomyItemId" TEXT,
  "maximumScore" INTEGER NOT NULL,
  "rationale" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppetiteStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppetiteBreach" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "riskId" TEXT NOT NULL,
  "appetiteStatementId" TEXT NOT NULL,
  "observedScore" INTEGER NOT NULL,
  "status" "AppetiteBreachStatus" NOT NULL DEFAULT 'OPEN',
  "ownerId" TEXT NOT NULL,
  "response" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppetiteBreach_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Assessment_riskId_type_revision_key" ON "Assessment"("riskId", "type", "revision");
CREATE INDEX "Assessment_tenantId_riskId_status_idx" ON "Assessment"("tenantId", "riskId", "status");
CREATE INDEX "TreatmentPlan_tenantId_riskId_status_idx" ON "TreatmentPlan"("tenantId", "riskId", "status");
CREATE INDEX "ApprovalDecision_treatmentPlanId_kind_decidedAt_idx" ON "ApprovalDecision"("treatmentPlanId", "kind", "decidedAt");
CREATE INDEX "TreatmentAction_tenantId_ownerId_status_dueDate_idx" ON "TreatmentAction"("tenantId", "ownerId", "status", "dueDate");
CREATE UNIQUE INDEX "ControlProfile_tenantId_frameworkControlId_key" ON "ControlProfile"("tenantId", "frameworkControlId");
CREATE INDEX "ControlProfile_tenantId_ownerId_effectiveness_idx" ON "ControlProfile"("tenantId", "ownerId", "effectiveness");
CREATE INDEX "Evidence_tenantId_status_expiresAt_idx" ON "Evidence"("tenantId", "status", "expiresAt");
CREATE INDEX "AppetiteStatement_tenantId_active_category_idx" ON "AppetiteStatement"("tenantId", "active", "category");
CREATE UNIQUE INDEX "AppetiteBreach_riskId_appetiteStatementId_status_key" ON "AppetiteBreach"("riskId", "appetiteStatementId", "status");
CREATE INDEX "AppetiteBreach_tenantId_status_ownerId_idx" ON "AppetiteBreach"("tenantId", "status", "ownerId");
CREATE UNIQUE INDEX "TaxonomyItem_tenantId_type_name_key" ON "TaxonomyItem"("tenantId", "type", "name");
CREATE INDEX "TaxonomyItem_tenantId_type_active_sortOrder_idx" ON "TaxonomyItem"("tenantId", "type", "active", "sortOrder");

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "TreatmentAction" ADD CONSTRAINT "TreatmentAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentAction" ADD CONSTRAINT "TreatmentAction_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentAction" ADD CONSTRAINT "TreatmentAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "ControlProfile" ADD CONSTRAINT "ControlProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ControlProfile" ADD CONSTRAINT "ControlProfile_frameworkControlId_fkey" FOREIGN KEY ("frameworkControlId") REFERENCES "FrameworkControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ControlProfile" ADD CONSTRAINT "ControlProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxonomyItem" ADD CONSTRAINT "TaxonomyItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_treatmentActionId_fkey" FOREIGN KEY ("treatmentActionId") REFERENCES "TreatmentAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_controlProfileId_fkey" FOREIGN KEY ("controlProfileId") REFERENCES "ControlProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppetiteStatement" ADD CONSTRAINT "AppetiteStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppetiteStatement" ADD CONSTRAINT "AppetiteStatement_taxonomyItemId_fkey" FOREIGN KEY ("taxonomyItemId") REFERENCES "TaxonomyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppetiteBreach" ADD CONSTRAINT "AppetiteBreach_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppetiteBreach" ADD CONSTRAINT "AppetiteBreach_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppetiteBreach" ADD CONSTRAINT "AppetiteBreach_appetiteStatementId_fkey" FOREIGN KEY ("appetiteStatementId") REFERENCES "AppetiteStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppetiteBreach" ADD CONSTRAINT "AppetiteBreach_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON UPDATE CASCADE;