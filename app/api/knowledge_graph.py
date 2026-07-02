from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from collections import defaultdict

from app.database import get_db
from app.models.care_hub_models import Patient, Report, ReportEntity
from app.services.entity_extraction import extract_entities

router = APIRouter(
    prefix="/knowledge-graph",
    tags=["Knowledge Graph"]
)


@router.post("/extract/{report_id}")
async def extract_report_entities(report_id: int, db: Session = Depends(get_db)):
    """
    Run entity extraction on a single report and store the results.
    Call this once after saving a report (or batch-call for existing reports).
    Safe to call twice — clears old entities for this report first.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    import json
    tests = json.loads(report.recommended_tests or "[]")
    treatments = json.loads(report.treatment_suggestions or "[]")

    entities = extract_entities(
        diagnosis=report.diagnosis or "",
        tests=tests,
        treatments=treatments,
    )

    # Clear any previous extraction for this report (idempotent re-run)
    db.query(ReportEntity).filter(ReportEntity.report_id == report_id).delete()

    rows = []
    for cond in entities["conditions"]:
        rows.append(ReportEntity(
            report_id=report.id, patient_id=report.patient_id,
            entity_type="condition", entity_name=cond
        ))
    for test in entities["tests"]:
        rows.append(ReportEntity(
            report_id=report.id, patient_id=report.patient_id,
            entity_type="test", entity_name=test
        ))
    for tx in entities["treatments"]:
        rows.append(ReportEntity(
            report_id=report.id, patient_id=report.patient_id,
            entity_type="treatment", entity_name=tx
        ))

    db.add_all(rows)
    db.commit()

    return {
        "status": "success",
        "report_id": report_id,
        "entities_extracted": len(rows),
        "entities": entities,
    }


def _build_graph(entity_rows, patients_by_id, include_patient_nodes=True):
    """
    Shared graph builder. Takes ReportEntity rows + a patient_id->Patient map,
    returns {"nodes": [...], "edges": [...]}.

    Node id scheme: "patient:1", "condition:hyperthyroidism", "test:tsh", "treatment:levothyroxine"
    Edge: connects patient -> entity, weighted by how many times it appears.
    """
    nodes = {}
    edge_weights = defaultdict(int)

    def node_id(entity_type, name):
        return f"{entity_type}:{name.strip().lower()}"

    for row in entity_rows:
        patient = patients_by_id.get(row.patient_id)
        if not patient:
            continue

        p_id = f"patient:{patient.id}"
        if include_patient_nodes and p_id not in nodes:
            nodes[p_id] = {
                "id": p_id,
                "label": patient.name,
                "type": "patient",
            }

        e_id = node_id(row.entity_type, row.entity_name)
        if e_id not in nodes:
            nodes[e_id] = {
                "id": e_id,
                "label": row.entity_name,
                "type": row.entity_type,
            }

        if include_patient_nodes:
            edge_key = (p_id, e_id)
            edge_weights[edge_key] += 1

    edges = [
        {"source": src, "target": tgt, "weight": weight}
        for (src, tgt), weight in edge_weights.items()
    ]

    return {"nodes": list(nodes.values()), "edges": edges}


@router.get("/patients/{patient_id}")
async def get_patient_graph(patient_id: int, db: Session = Depends(get_db)):
    """Knowledge graph scoped to one patient — their conditions/tests/treatments over time."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    entity_rows = db.query(ReportEntity).filter(ReportEntity.patient_id == patient_id).all()

    if not entity_rows:
        return {
            "nodes": [{"id": f"patient:{patient.id}", "label": patient.name, "type": "patient"}],
            "edges": [],
            "note": "No entities extracted yet. Call /knowledge-graph/extract/{report_id} for this patient's reports first.",
        }

    graph = _build_graph(entity_rows, {patient.id: patient})
    return graph


@router.get("/global")
async def get_global_graph(db: Session = Depends(get_db)):
    """
    Knowledge graph across ALL patients — spot shared conditions, common test
    patterns, and treatment overlaps across the whole patient population.
    """
    entity_rows = db.query(ReportEntity).all()

    if not entity_rows:
        return {
            "nodes": [],
            "edges": [],
            "note": "No entities extracted yet across any patient.",
        }

    patients = db.query(Patient).all()
    patients_by_id = {p.id: p for p in patients}

    graph = _build_graph(entity_rows, patients_by_id)
    return graph


@router.get("/entities/top")
async def get_top_entities(db: Session = Depends(get_db)):
    """
    Most common conditions/tests/treatments across all patients —
    useful for a quick 'population trends' view alongside the graph.
    """
    rows = (
        db.query(
            ReportEntity.entity_type,
            ReportEntity.entity_name,
            func.count(ReportEntity.id).label("count")
        )
        .group_by(ReportEntity.entity_type, ReportEntity.entity_name)
        .order_by(func.count(ReportEntity.id).desc())
        .limit(20)
        .all()
    )

    return {
        "top_entities": [
            {"type": r[0], "name": r[1], "count": r[2]} for r in rows
        ]
    }