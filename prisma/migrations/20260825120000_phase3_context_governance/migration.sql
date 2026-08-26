ALTER TABLE "Risk" ADD COLUMN "businessUnitId" TEXT;
ALTER TABLE "Risk" ADD COLUMN "objectiveId" TEXT;
ALTER TABLE "Risk" ADD COLUMN "riskSourceId" TEXT;
ALTER TABLE "Risk" ADD COLUMN "regulatoryDomainId" TEXT;
ALTER TABLE "Framework" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Framework" ADD COLUMN "publicationDate" TIMESTAMP(3);
ALTER TABLE "Framework" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "Framework" ADD COLUMN "contentOwner" TEXT;
ALTER TABLE "Framework" ADD COLUMN "applicability" TEXT;
ALTER TABLE "RiskFrameworkMapping" ADD COLUMN "applicability" TEXT;
ALTER TABLE "RiskFrameworkMapping" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "RiskFrameworkMapping" ADD COLUMN "reviewedById" TEXT;

CREATE INDEX "Risk_tenantId_businessUnitId_idx" ON "Risk"("tenantId", "businessUnitId");
CREATE INDEX "Risk_tenantId_objectiveId_idx" ON "Risk"("tenantId", "objectiveId");
CREATE INDEX "Risk_tenantId_riskSourceId_idx" ON "Risk"("tenantId", "riskSourceId");
CREATE INDEX "Risk_tenantId_regulatoryDomainId_idx" ON "Risk"("tenantId", "regulatoryDomainId");
CREATE INDEX "RiskFrameworkMapping_reviewedById_idx" ON "RiskFrameworkMapping"("reviewedById");

ALTER TABLE "Risk" ADD CONSTRAINT "Risk_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "TaxonomyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "TaxonomyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_riskSourceId_fkey" FOREIGN KEY ("riskSourceId") REFERENCES "TaxonomyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_regulatoryDomainId_fkey" FOREIGN KEY ("regulatoryDomainId") REFERENCES "TaxonomyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskFrameworkMapping" ADD CONSTRAINT "RiskFrameworkMapping_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;