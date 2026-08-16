from __future__ import annotations

import csv
import io
from collections import Counter
from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Query, Response, status

from app.domain import (
    AssessmentInput,
    AssessmentType,
    Control,
    DashboardMetrics,
    HeatMapCell,
    ReportSummary,
    Risk,
    RiskInput,
    TreatmentAction,
    score_risk,
)
from app.store import store

router = APIRouter(prefix="/v1", tags=["risk management"])


def actor_name(x_actor_name: str | None = Header(default=None)) -> str:
    return x_actor_name or "Local workspace user"


def require_risk(risk_id: str) -> Risk:
    risk = store.get(risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    return risk


def metrics() -> DashboardMetrics:
    risks = store.list()
    today = date.today()
    levels = Counter((risk.residual or risk.inherent).level.value for risk in risks)
    categories = Counter(risk.category for risk in risks)
    inherent_total = sum(risk.inherent.score for risk in risks)
    residual_total = sum((risk.residual or risk.inherent).score for risk in risks)
    treated = sum(bool(risk.controls or risk.actions) for risk in risks)
    return DashboardMetrics(
        total_risks=len(risks),
        critical_risks=levels["Critical"],
        outside_appetite=sum((risk.residual or risk.inherent).score >= 12 for risk in risks),
        overdue_actions=sum(action.due_date < today and action.status != "Complete" for risk in risks for action in risk.actions),
        treatment_coverage=round(treated / len(risks) * 100) if risks else 0,
        residual_reduction=round((inherent_total - residual_total) / inherent_total * 100) if inherent_total else 0,
        level_distribution=dict(levels),
        category_distribution=dict(categories),
    )


@router.get("/risks", response_model=list[Risk])
def list_risks(q: str = "", level: str = "", category: str = "") -> list[Risk]:
    risks = store.list()
    if q:
        needle = q.casefold()
        risks = [risk for risk in risks if needle in f"{risk.reference} {risk.title} {risk.owner} {risk.category}".casefold()]
    if level:
        risks = [risk for risk in risks if (risk.residual or risk.inherent).level.value == level]
    if category:
        risks = [risk for risk in risks if risk.category == category]
    return risks


@router.post("/risks", response_model=Risk, status_code=status.HTTP_201_CREATED)
def create_risk(data: RiskInput, actor: str = Header(default="Local workspace user", alias="X-Actor-Name")) -> Risk:
    return store.create(data, actor)


@router.get("/risks/{risk_id}", response_model=Risk)
def get_risk(risk_id: str) -> Risk:
    return require_risk(risk_id)


@router.post("/risks/{risk_id}/assessments/{kind}", response_model=Risk)
def assess_risk(risk_id: str, kind: AssessmentType, data: AssessmentInput, actor: str = Header(default="Local workspace user", alias="X-Actor-Name")) -> Risk:
    try:
        return store.add_assessment(require_risk(risk_id), kind, data, actor)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/risks/{risk_id}/controls", response_model=Risk, status_code=201)
def add_control(risk_id: str, data: Control, actor: str = Header(default="Local workspace user", alias="X-Actor-Name")) -> Risk:
    if any(control.id == data.id for risk in store.list() for control in risk.controls):
        data.id = f"CTL-{uuid4().hex[:8].upper()}"
    return store.add_control(require_risk(risk_id), data, actor)


@router.post("/risks/{risk_id}/actions", response_model=Risk, status_code=201)
def add_action(risk_id: str, data: TreatmentAction, actor: str = Header(default="Local workspace user", alias="X-Actor-Name")) -> Risk:
    if any(action.id == data.id for risk in store.list() for action in risk.actions):
        data.id = f"ACT-{uuid4().hex[:8].upper()}"
    return store.add_action(require_risk(risk_id), data, actor)


@router.get("/dashboard", response_model=DashboardMetrics)
def get_dashboard() -> DashboardMetrics:
    return metrics()


@router.get("/heat-map", response_model=list[HeatMapCell])
def get_heat_map(assessment: AssessmentType = Query(default=AssessmentType.RESIDUAL)) -> list[HeatMapCell]:
    grouped: dict[tuple[int, int], list[str]] = {}
    for risk in store.list():
        selected = risk.inherent if assessment is AssessmentType.INHERENT else risk.residual
        if not selected:
            continue
        grouped.setdefault((selected.likelihood, selected.impact), []).append(risk.id)
    cells = []
    for likelihood in range(1, 6):
        for impact in range(1, 6):
            _, level = score_risk(likelihood, impact)
            ids = grouped.get((likelihood, impact), [])
            cells.append(HeatMapCell(likelihood=likelihood, impact=impact, count=len(ids), risk_ids=ids, level=level))
    return cells


@router.get("/audit")
def get_audit(limit: int = Query(default=50, ge=1, le=200)):
    return store.audit[:limit]


@router.get("/reports/executive-summary", response_model=ReportSummary)
def executive_summary() -> ReportSummary:
    return ReportSummary(title="Executive risk summary", scope="Current organizational risk profile", metrics=metrics(), risks=store.list())


@router.get("/reports/risk-register.csv")
def risk_register_csv() -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Reference", "Risk", "Category", "Business unit", "Owner", "Status", "Inherent score", "Residual score", "Treatment", "Review date"])
    for risk in store.list():
        writer.writerow([risk.reference, risk.title, risk.category, risk.business_unit, risk.owner, risk.status.value, risk.inherent.score, risk.residual.score if risk.residual else "", risk.treatment_strategy.value, risk.review_date.isoformat()])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=northstar-risk-register.csv"})