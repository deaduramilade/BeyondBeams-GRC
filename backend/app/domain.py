from __future__ import annotations

from datetime import date, datetime, timezone
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class RiskLevel(StrEnum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    CRITICAL = "Critical"


class AssessmentType(StrEnum):
    INHERENT = "inherent"
    RESIDUAL = "residual"


class TreatmentStrategy(StrEnum):
    AVOID = "Avoid"
    REDUCE = "Reduce"
    TRANSFER = "Transfer"
    ACCEPT = "Accept"


class RiskStatus(StrEnum):
    OPEN = "Open"
    TREATMENT = "Treatment in progress"
    MONITORING = "Monitoring"
    ACCEPTED = "Accepted"
    CLOSED = "Closed"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def score_risk(likelihood: int, impact: int) -> tuple[int, RiskLevel]:
    if not 1 <= likelihood <= 5 or not 1 <= impact <= 5:
        raise ValueError("Likelihood and impact must be between 1 and 5")
    score = likelihood * impact
    if score >= 20:
        return score, RiskLevel.CRITICAL
    if score >= 12:
        return score, RiskLevel.HIGH
    if score >= 6:
        return score, RiskLevel.MODERATE
    return score, RiskLevel.LOW


class AssessmentInput(BaseModel):
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    rationale: str = Field(min_length=10, max_length=2000)


class Assessment(AssessmentInput):
    type: AssessmentType
    score: int
    level: RiskLevel
    assessed_at: datetime = Field(default_factory=utc_now)
    assessor: str = "Current user"


class Control(BaseModel):
    id: str
    title: str = Field(min_length=3, max_length=160)
    owner: str = Field(min_length=2, max_length=100)
    type: Literal["Preventive", "Detective", "Corrective", "Directive"]
    effectiveness: Literal["Not assessed", "Ineffective", "Partially effective", "Largely effective", "Effective"]
    status: Literal["Planned", "Implemented", "Needs improvement"] = "Implemented"


class TreatmentAction(BaseModel):
    id: str
    title: str = Field(min_length=3, max_length=180)
    owner: str = Field(min_length=2, max_length=100)
    due_date: date
    status: Literal["Planned", "In progress", "Blocked", "Complete"] = "Planned"
    progress: int = Field(default=0, ge=0, le=100)


class RiskInput(BaseModel):
    title: str = Field(min_length=5, max_length=180)
    description: str = Field(min_length=10, max_length=3000)
    category: str = Field(min_length=2, max_length=80)
    business_unit: str = Field(min_length=2, max_length=100)
    owner: str = Field(min_length=2, max_length=100)
    status: RiskStatus = RiskStatus.OPEN
    treatment_strategy: TreatmentStrategy
    review_date: date
    inherent: AssessmentInput
    residual: AssessmentInput | None = None

    @model_validator(mode="after")
    def validate_residual(self) -> "RiskInput":
        if self.residual and self.residual.likelihood * self.residual.impact > self.inherent.likelihood * self.inherent.impact:
            raise ValueError("Residual score cannot exceed inherent score without reassessment")
        return self


class Risk(RiskInput):
    id: str
    reference: str
    inherent: Assessment
    residual: Assessment | None = None
    controls: list[Control] = Field(default_factory=list)
    actions: list[TreatmentAction] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    version: int = 1


class AuditEvent(BaseModel):
    id: str
    occurred_at: datetime = Field(default_factory=utc_now)
    actor: str
    action: str
    resource: str
    detail: str


class HeatMapCell(BaseModel):
    likelihood: int
    impact: int
    count: int
    risk_ids: list[str]
    level: RiskLevel


class DashboardMetrics(BaseModel):
    total_risks: int
    critical_risks: int
    outside_appetite: int
    overdue_actions: int
    treatment_coverage: int
    residual_reduction: int
    level_distribution: dict[str, int]
    category_distribution: dict[str, int]


class ReportSummary(BaseModel):
    generated_at: datetime = Field(default_factory=utc_now)
    title: str
    scope: str
    metrics: DashboardMetrics
    risks: list[Risk]