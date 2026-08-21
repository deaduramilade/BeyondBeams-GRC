import { db } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { BoardTranslator } from "@/components/board-translator";
export default async function TranslatorPage(){const session=await requireSession();const user=await db.user.findFirstOrThrow({where:{id:session.user.id,tenantId:session.user.tenantId},select:{translatorUses:true,paidPlan:true}});return <><PageHeader eyebrow="Executive communication" title="Technical-to-board language translator" description="Convert specialist risk and compliance language into concise business exposure, decision context, and management action. Outputs remain subject to human review."/><BoardTranslator uses={user.translatorUses} paid={user.paidPlan}/></>}