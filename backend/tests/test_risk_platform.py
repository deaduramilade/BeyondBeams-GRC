from fastapi.testclient import TestClient

from app.domain import RiskLevel, score_risk
from app.main import app

client = TestClient(app)


def test_score_boundaries_are_explainable() -> None:
    assert score_risk(1, 1) == (1, RiskLevel.LOW)
    assert score_risk(2, 3) == (6, RiskLevel.MODERATE)
    assert score_risk(3, 4) == (12, RiskLevel.HIGH)
    assert score_risk(4, 5) == (20, RiskLevel.CRITICAL)


def test_register_dashboard_heatmap_and_report_reconcile() -> None:
    risks = client.get("/api/v1/risks").json()
    dashboard = client.get("/api/v1/dashboard").json()
    heat_map = client.get("/api/v1/heat-map?assessment=residual").json()
    report = client.get("/api/v1/reports/executive-summary").json()

    assert dashboard["total_risks"] == len(risks)
    assert sum(cell["count"] for cell in heat_map) == len([risk for risk in risks if risk["residual"]])
    assert report["metrics"] == dashboard
    assert len(report["risks"]) == len(risks)


def test_create_risk_and_residual_validation() -> None:
    payload = {
        "title": "Unauthorized finance system access",
        "description": "Excessive privileges may enable unauthorized changes to financial records.",
        "category": "Cybersecurity",
        "business_unit": "Finance",
        "owner": "Alex Morgan",
        "status": "Open",
        "treatment_strategy": "Reduce",
        "review_date": "2026-12-01",
        "inherent": {"likelihood": 4, "impact": 5, "rationale": "Privileged access pathways and material financial impact are credible."},
        "residual": {"likelihood": 2, "impact": 4, "rationale": "Access reviews and monitoring reduce likelihood but not full impact."},
    }
    response = client.post("/api/v1/risks", json=payload, headers={"X-Actor-Name": "Test manager"})
    assert response.status_code == 201
    assert response.json()["inherent"]["score"] == 20
    assert response.json()["residual"]["score"] == 8
    assert client.get("/api/v1/audit").json()[0]["action"] == "risk.created"

    payload["residual"] = {"likelihood": 5, "impact": 5, "rationale": "This intentionally invalid residual score exceeds inherent exposure."}
    assert client.post("/api/v1/risks", json=payload).status_code == 422