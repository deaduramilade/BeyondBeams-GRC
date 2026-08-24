-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'RISK_MANAGER', 'ASSESSOR', 'VIEWER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "RiskTreatment" AS ENUM ('ACCEPT', 'MITIGATE', 'TRANSFER', 'AVOID', 'NONE');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_REVIEW', 'TREATMENT', 'IN_MONITORING', 'ACCEPTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('CYBERSECURITY', 'COMPLIANCE', 'OPERATIONAL', 'STRATEGIC', 'FINANCIAL', 'PEOPLE', 'THIRD_PARTY', 'RESILIENCE', 'PRIVACY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('RISK_REGISTER', 'BOARD_REPORT', 'GAP_ANALYSIS', 'AUDIT_TRAIL');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "reviewRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewReminderCadence" TEXT NOT NULL DEFAULT '7,1,0',

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "translatorUses" INTEGER NOT NULL DEFAULT 0,
    "paidPlan" BOOLEAN NOT NULL DEFAULT false,
    "reviewEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "assignmentEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "exportEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "inviteEmail" TEXT,
    "inviteToken" TEXT,
    "inviteExpires" TIMESTAMP(3),
    "invitedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "inherentLikelihood" INTEGER NOT NULL,
    "inherentImpact" INTEGER NOT NULL,
    "inherentScore" INTEGER NOT NULL,
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualScore" INTEGER,
    "treatment" "RiskTreatment" NOT NULL DEFAULT 'NONE',
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "nextReviewDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industryTags" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkControl" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "FrameworkControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFramework" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFrameworkMapping" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "frameworkControlId" TEXT NOT NULL,
    "mappedBy" TEXT NOT NULL,
    "mappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "RiskFrameworkMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrcRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrcRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "metric" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "categories" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskComplianceLink" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskComplianceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergingRisk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "indicators" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MONITORING',
    "ownerId" TEXT NOT NULL,
    "nextReviewDate" TIMESTAMP(3) NOT NULL,
    "settlementDecision" TEXT,
    "settledAt" TIMESTAMP(3),
    "promotedRiskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergingRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "riskId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'Risk',
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "artifactBase64" TEXT,
    "downloadTokenHash" TEXT,
    "downloadExpires" TIMESTAMP(3),

    CONSTRAINT "ExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "provider" TEXT NOT NULL DEFAULT 'local-preview',
    "dedupeKey" TEXT,
    "previewTokenHash" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleFrequency" TEXT,
    "recipientsJson" JSONB NOT NULL DEFAULT '[]',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_email_idx" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_inviteToken_key" ON "Membership"("inviteToken");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_inviteEmail_idx" ON "Membership"("inviteEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_inviteEmail_key" ON "Membership"("tenantId", "inviteEmail");

-- CreateIndex
CREATE INDEX "Risk_tenantId_idx" ON "Risk"("tenantId");

-- CreateIndex
CREATE INDEX "Risk_tenantId_deletedAt_idx" ON "Risk"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Risk_tenantId_status_idx" ON "Risk"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Risk_tenantId_residualScore_idx" ON "Risk"("tenantId", "residualScore");

-- CreateIndex
CREATE INDEX "Risk_ownerId_idx" ON "Risk"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_tenantId_reference_key" ON "Risk"("tenantId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_name_key" ON "Framework"("name");

-- CreateIndex
CREATE INDEX "Framework_name_idx" ON "Framework"("name");

-- CreateIndex
CREATE INDEX "FrameworkControl_frameworkId_idx" ON "FrameworkControl"("frameworkId");

-- CreateIndex
CREATE INDEX "FrameworkControl_controlId_idx" ON "FrameworkControl"("controlId");

-- CreateIndex
CREATE INDEX "FrameworkControl_title_idx" ON "FrameworkControl"("title");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkControl_frameworkId_controlId_key" ON "FrameworkControl"("frameworkId", "controlId");

-- CreateIndex
CREATE INDEX "TenantFramework_tenantId_enabled_idx" ON "TenantFramework"("tenantId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFramework_tenantId_frameworkId_key" ON "TenantFramework"("tenantId", "frameworkId");

-- CreateIndex
CREATE INDEX "RiskFrameworkMapping_riskId_idx" ON "RiskFrameworkMapping"("riskId");

-- CreateIndex
CREATE INDEX "RiskFrameworkMapping_frameworkControlId_idx" ON "RiskFrameworkMapping"("frameworkControlId");

-- CreateIndex
CREATE INDEX "RiskFrameworkMapping_mappedBy_idx" ON "RiskFrameworkMapping"("mappedBy");

-- CreateIndex
CREATE UNIQUE INDEX "RiskFrameworkMapping_riskId_frameworkControlId_key" ON "RiskFrameworkMapping"("riskId", "frameworkControlId");

-- CreateIndex
CREATE INDEX "GrcRecord_tenantId_module_idx" ON "GrcRecord"("tenantId", "module");

-- CreateIndex
CREATE INDEX "ComplianceReference_tenantId_framework_idx" ON "ComplianceReference"("tenantId", "framework");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceReference_tenantId_framework_reference_key" ON "ComplianceReference"("tenantId", "framework", "reference");

-- CreateIndex
CREATE INDEX "RiskComplianceLink_riskId_idx" ON "RiskComplianceLink"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskComplianceLink_riskId_referenceId_key" ON "RiskComplianceLink"("riskId", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergingRisk_promotedRiskId_key" ON "EmergingRisk"("promotedRiskId");

-- CreateIndex
CREATE INDEX "EmergingRisk_tenantId_status_idx" ON "EmergingRisk"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "AuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityId_idx" ON "AuditEvent"("tenantId", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_riskId_idx" ON "AuditEvent"("riskId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ExportHistory_downloadTokenHash_key" ON "ExportHistory"("downloadTokenHash");

-- CreateIndex
CREATE INDEX "ExportHistory_tenantId_createdAt_idx" ON "ExportHistory"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportHistory_tenantId_status_createdAt_idx" ON "ExportHistory"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExportHistory_generatedById_idx" ON "ExportHistory"("generatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_previewTokenHash_key" ON "Notification"("previewTokenHash");

-- CreateIndex
CREATE INDEX "Notification_tenantId_type_createdAt_idx" ON "Notification"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_recipient_idx" ON "Notification"("tenantId", "recipient");

-- CreateIndex
CREATE INDEX "Notification_relatedEntityType_relatedEntityId_idx" ON "Notification"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "SavedReport_tenantId_createdAt_idx" ON "SavedReport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedReport_tenantId_scheduleEnabled_nextRunAt_idx" ON "SavedReport"("tenantId", "scheduleEnabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "SavedReport_createdById_idx" ON "SavedReport"("createdById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkControl" ADD CONSTRAINT "FrameworkControl_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFramework" ADD CONSTRAINT "TenantFramework_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFramework" ADD CONSTRAINT "TenantFramework_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFrameworkMapping" ADD CONSTRAINT "RiskFrameworkMapping_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFrameworkMapping" ADD CONSTRAINT "RiskFrameworkMapping_frameworkControlId_fkey" FOREIGN KEY ("frameworkControlId") REFERENCES "FrameworkControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFrameworkMapping" ADD CONSTRAINT "RiskFrameworkMapping_mappedBy_fkey" FOREIGN KEY ("mappedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrcRecord" ADD CONSTRAINT "GrcRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReference" ADD CONSTRAINT "ComplianceReference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskComplianceLink" ADD CONSTRAINT "RiskComplianceLink_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskComplianceLink" ADD CONSTRAINT "RiskComplianceLink_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "ComplianceReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergingRisk" ADD CONSTRAINT "EmergingRisk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergingRisk" ADD CONSTRAINT "EmergingRisk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergingRisk" ADD CONSTRAINT "EmergingRisk_promotedRiskId_fkey" FOREIGN KEY ("promotedRiskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

