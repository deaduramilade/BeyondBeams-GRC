from __future__ import annotations

from datetime import date
from threading import RLock
from uuid import uuid4

from app.domain import (
    Assessment,
    AssessmentInput,
    AssessmentType,
    AuditEvent,
    Control,
    Risk,
    RiskInput,
    RiskStatus,
    TreatmentAction,
    TreatmentStrategy,
    score_risk,
    utc_now,
)


def make_assessment(data: AssessmentInput, kind: AssessmentType, assessor: str = "Maya Chen") -> Assessment:
    score, level = score_risk(data.likelihood, data.impact)
    return Assessment(**data.model_dump(), type=kind, score=score, level=level, assessor=assessor)


class RiskStore:
    """Thread-safe demo store. Replace with the PostgreSQL repository at deployment."""

    def __init__(self) -> None:
        self._lock = RLock()
        self.risks: dict[str, Risk] = {}
        self.audit: list[AuditEvent] = []
        self._seed()

    def _seed(self) -> None:
        seeds = [
            ("Third-party data exposure", "A critical supplier may expose regulated customer data through weak access controls.", "Cybersecurity", "Technology", "Maya Chen", 5, 5, 3, 4, "2026-09-15"),
            ("Regulatory reporting delay", "Incomplete source data may delay mandatory submissions and trigger supervisory action.", "Compliance", "Legal & Compliance", "Jon Bell", 4, 4, 2, 3, "2026-08-28"),
            ("Key person dependency", "Loss of specialist knowledge may interrupt financial close and assurance activities.", "People", "Finance", "Priya Shah", 3, 4, 2, 3, "2026-10-10"),
            ("Cloud service interruption", "A regional cloud outage may make customer operations unavailable beyond tolerance.", "Resilience", "Technology", "Maya Chen", 3, 5, 2, 3, "2026-09-30"),
            ("Revenue forecast volatility", "Rapid market changes may materially reduce forecast accuracy and investment capacity.", "Strategic", "Executive", "Elena Rossi", 3, 3, 2, 2, "2026-11-01"),
            ("Vendor concentration", "Dependence on one logistics provider may disrupt service delivery during peak demand.", "Third party", "Operations", "Owen Wright", 4, 3, 3, 2, "2026-09-05"),
        ]
        for index, row in enumerate(seeds, start=21):
            title, description, category, unit, owner, il, ii, rl, ri, review = row
            data = RiskInput(
                title=title,
                description=description,
                category=category,
                business_unit=unit,
                owner=owner,
                status=RiskStatus.TREATMENT if index % 2 else RiskStatus.MONITORING,
                treatment_strategy=TreatmentStrategy.REDUCE,
                review_date=date.fromisoformat(review),
                inherent=AssessmentInput(likelihood=il, impact=ii, rationale="Assessment based on current exposure, operating context, and credible impact scenarios."),
                residual=AssessmentInput(likelihood=rl, impact=ri, rationale="Residual exposure reflects the documented control environment and active treatment plan."),
            )
            risk = self.create(data, actor="System seed")
            risk.controls.append(Control(id=f"CTL-{index:03d}", title="Quarterly control assurance", owner=owner, type="Detective", effectiveness="Largely effective"))
            risk.actions.append(TreatmentAction(id=f"ACT-{index:03d}", title="Complete treatment effectiveness review", owner=owner, due_date=date.fromisoformat(review), status="In progress", progress=60))

    def _record(self, actor: str, action: str, resource: str, detail: str) -> None:
        self.audit.insert(0, AuditEvent(id=str(uuid4()), actor=actor, action=action, resource=resource, detail=detail))

    def list(self) -> list[Risk]:
        return sorted(self.risks.values(), key=lambda risk: risk.updated_at, reverse=True)

    def get(self, risk_id: str) -> Risk | None:
        return self.risks.get(risk_id)

    def create(self, data: RiskInput, actor: str) -> Risk:
        with self._lock:
            risk_id = str(uuid4())
            reference = f"RSK-{len(self.risks) + 1:04d}"
            inherent = make_assessment(data.inherent, AssessmentType.INHERENT, actor)
            residual = make_assessment(data.residual, AssessmentType.RESIDUAL, actor) if data.residual else None
            risk = Risk(**data.model_dump(exclude={"inherent", "residual"}), id=risk_id, reference=reference, inherent=inherent, residual=residual)
            self.risks[risk_id] = risk
            self._record(actor, "risk.created", reference, f"Created {data.title}")
            return risk

    def add_assessment(self, risk: Risk, kind: AssessmentType, data: AssessmentInput, actor: str) -> Risk:
        with self._lock:
            assessment = make_assessment(data, kind, actor)
            if kind is AssessmentType.RESIDUAL and assessment.score > risk.inherent.score:
                raise ValueError("Residual score cannot exceed inherent score without reassessment")
            setattr(risk, kind.value, assessment)
            risk.updated_at = utc_now()
            risk.version += 1
            self._record(actor, "assessment.recorded", risk.reference, f"Recorded {kind.value} assessment at {assessment.score}")
            return risk

    def add_control(self, risk: Risk, control: Control, actor: str) -> Risk:
        with self._lock:
            risk.controls.append(control)
            risk.updated_at = utc_now()
            risk.version += 1
            self._record(actor, "control.linked", risk.reference, control.title)
            return risk

    def add_action(self, risk: Risk, action: TreatmentAction, actor: str) -> Risk:
        with self._lock:
            risk.actions.append(action)
            risk.updated_at = utc_now()
            risk.version += 1
            self._record(actor, "treatment.action.created", risk.reference, action.title)
            return risk


store = RiskStore()