import { RiskCategory, RiskStatus, RiskTreatment } from "@prisma/client";
import { z } from "zod";

const rating = z.coerce.number().int().min(1).max(5);
export const riskSchema = z.object({
  title: z.string().trim().min(3).max(120), description: z.string().trim().min(10).max(2000),
  category: z.nativeEnum(RiskCategory), ownerId: z.string().cuid(), inherentLikelihood: rating, inherentImpact: rating,
  businessUnitId: z.string().cuid().nullable().optional(), objectiveId: z.string().cuid().nullable().optional(),
  riskSourceId: z.string().cuid().nullable().optional(), regulatoryDomainId: z.string().cuid().nullable().optional(),
  residualLikelihood: rating.nullable().optional(), residualImpact: rating.nullable().optional(),
  treatment: z.nativeEnum(RiskTreatment), status: z.nativeEnum(RiskStatus), nextReviewDate: z.coerce.date(),
}).refine((data) => (data.residualLikelihood === null) === (data.residualImpact === null), { message: "Residual likelihood and impact must be supplied together.", path: ["residualLikelihood"] });
export type RiskInput = z.infer<typeof riskSchema>;