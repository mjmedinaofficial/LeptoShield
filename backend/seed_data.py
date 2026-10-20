"""Seed LeptoShield with DOH baselines and a synthetic live clinic queue.

Run directly for a fresh demo:
    python seed_data.py --reset
"""
from __future__ import annotations

import argparse
from datetime import timedelta
from typing import Any, Dict, List, Optional

from sqlmodel import Session, SQLModel, select

from database import engine, init_db
from models import (
    AuditEvent,
    Counter,
    InventoryItem,
    InventoryTxn,
    SurveillanceRegion,
    SurveillanceWeek,
    TriageTicket,
    WeatherSnapshot,
    utcnow,
)
from triage_engine import compute_priority, evaluate_triage


def minutes_ago(minutes: float):
    return utcnow() - timedelta(minutes=minutes)


def _event(
    session: Session,
    kind: str,
    message: str,
    *,
    token: Optional[str] = None,
    actor: str = "system",
    ago: float = 0,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    session.add(
        AuditEvent(
            kind=kind,
            message=message,
            ticket_token=token,
            actor=actor,
            meta=meta or {},
            created_at=minutes_ago(ago),
        )
    )


def _seed_surveillance(session: Session) -> None:
    regions = [
        {
            "code": "NCR",
            "name": "National Capital Region",
            "short_name": "NCR",
            "current_week": "MW38",
            "cases_current": 310,
            "alert_threshold": 120,
            "epidemic_threshold": 250,
            "flagged_cities": ["Muntinlupa", "Pasay", "Malabon"],
            "history": [("MW36", 118), ("MW37", 203), ("MW38", 310)],
        },
        {
            "code": "R3",
            "name": "Central Luzon",
            "short_name": "Region III",
            "current_week": "MW38",
            "cases_current": 220,
            "alert_threshold": 90,
            "epidemic_threshold": 180,
            "flagged_cities": ["Calumpit", "Malolos", "San Fernando"],
            "history": [("MW36", 74), ("MW37", 132), ("MW38", 220)],
        },
        {
            "code": "R4A",
            "name": "CALABARZON",
            "short_name": "Region IV-A",
            "current_week": "MW38",
            "cases_current": 140,
            "alert_threshold": 80,
            "epidemic_threshold": 150,
            "flagged_cities": ["Calamba", "Los Baños", "San Pedro"],
            "history": [("MW36", 52), ("MW37", 96), ("MW38", 140)],
        },
    ]
    for region in regions:
        session.add(
            SurveillanceRegion(
                code=region["code"],
                name=region["name"],
                short_name=region["short_name"],
                current_week=region["current_week"],
                cases_current=region["cases_current"],
                alert_threshold=region["alert_threshold"],
                epidemic_threshold=region["epidemic_threshold"],
                flagged_cities=region["flagged_cities"],
                updated_at=minutes_ago(45),
            )
        )
        for week_label, cases in region["history"]:
            session.add(
                SurveillanceWeek(
                    region_code=region["code"],
                    week_label=week_label,
                    cases=cases,
                    alert_threshold=region["alert_threshold"],
                    epidemic_threshold=region["epidemic_threshold"],
                )
            )

    session.add(
        WeatherSnapshot(
            locality="Metro Manila",
            rainfall_24h_mm=186.4,
            forecast_24h_mm=120.0,
            river_level_m=14.82,
            river_critical_m=16.0,
            advisory=(
                "Orange rainfall warning. Floodwater remains in low-lying barangays. "
                "Avoid wading; cover open wounds."
            ),
            source="PAGASA-style seeded feed (synthetic)",
            observed_at=minutes_ago(35),
        )
    )


def _seed_counters(session: Session, active: Dict[int, str]) -> None:
    counters = [
        Counter(
            id=1,
            name="Counter 1",
            mode="high",
            staff="Nurse A. Reyes",
            location="Fast-track room, left of pharmacy",
            active_ticket_id=active.get(1),
        ),
        Counter(
            id=2,
            name="Counter 2",
            mode="flexible",
            staff="Dr. L. Santos",
            location="Assessment bay, beside triage desk",
            active_ticket_id=active.get(2),
        ),
        Counter(
            id=3,
            name="Counter 3",
            mode="flexible",
            staff="Nurse J. Cruz",
            location="Assessment bay, window side",
            active_ticket_id=active.get(3),
        ),
    ]
    for counter in counters:
        session.add(counter)


def _seed_inventory(session: Session) -> None:
    item = InventoryItem(
        id=1,
        sku="DOXY-100-CAP",
        name="Doxycycline 100 mg capsules",
        unit="capsules",
        stock=1500,
        reorder_threshold=500,
        par_level=2000,
        projected_daily_use=38.0,
        updated_at=minutes_ago(30),
    )
    session.add(item)
    session.flush()

    session.add(
        InventoryTxn(
            item_id=item.id,
            delta=1706,
            reason="Stock transfer from DOH regional warehouse",
            actor="DOH supply",
            created_at=minutes_ago(8 * 24 * 60),
        )
    )
    session.add(
        InventoryTxn(
            item_id=item.id,
            delta=-120,
            reason="Weekly prophylaxis dispensing",
            actor="Clinic pharmacy",
            created_at=minutes_ago(5 * 24 * 60),
        )
    )
    session.add(
        InventoryTxn(
            item_id=item.id,
            delta=-84,
            reason="Weekly prophylaxis dispensing",
            actor="Clinic pharmacy",
            created_at=minutes_ago(2 * 24 * 60),
        )
    )
    session.add(
        InventoryTxn(
            item_id=item.id,
            delta=-2,
            reason="Doxycycline 2 caps · H001",
            ticket_token="H001",
            actor="Dr. L. Santos",
            created_at=minutes_ago(90),
        )
    )


def _make_ticket(
    session: Session,
    *,
    token: str,
    created_min: float,
    status: str,
    name: str,
    age: int,
    sex: str,
    exposure_type: str,
    exposure_hours: float,
    open_cuts: bool,
    symptoms: List[str],
    blood_pressure: str,
    barangay: str,
    exposure_recency_hours: float,
    pregnant: bool = False,
    comorbidities: Optional[List[str]] = None,
    called_min: Optional[float] = None,
    completed_min: Optional[float] = None,
    counter_id: Optional[int] = None,
    dispensed: int = 0,
    notes: Optional[str] = None,
) -> TriageTicket:
    comorbidities = comorbidities or []
    payload = {
        "exposure_type": exposure_type,
        "exposure_hours": exposure_hours,
        "open_cuts": open_cuts,
        "symptoms": symptoms,
        "age": age,
        "pregnant": pregnant,
        "comorbidities": comorbidities,
    }
    xai = evaluate_triage(payload)
    expected = token[0]
    if {"H": "high", "M": "moderate", "L": "low"}[expected] != xai["tier"]:
        raise ValueError(f"Seed profile for {token} scored {xai['tier']} ({xai['score']})")

    created_at = minutes_ago(created_min)
    called_at = minutes_ago(called_min) if called_min is not None else None
    completed_at = minutes_ago(completed_min) if completed_min is not None else None
    xai["blood_pressure"] = blood_pressure

    ticket = TriageTicket(
        token=token,
        tier=xai["tier"],
        risk_score=xai["score"],
        priority_score=compute_priority(
            xai["tier"],
            xai["score"],
            created_at,
            age=age,
            pregnant=pregnant,
            comorbidities=comorbidities,
            severe="severe_symptom" in xai["flags"],
            now=created_at,
        ),
        status=status,
        name=name,
        age=age,
        sex=sex,
        pregnant=pregnant,
        barangay=barangay,
        exposure_type=exposure_type,
        exposure_hours=exposure_hours,
        exposure_recency_hours=exposure_recency_hours,
        open_cuts=open_cuts,
        symptoms=symptoms,
        comorbidities=comorbidities,
        xai=xai,
        counter_id=counter_id,
        dispensed=dispensed > 0,
        dispensed_qty=dispensed,
        notes=notes,
        created_at=created_at,
        called_at=called_at,
        completed_at=completed_at,
    )
    session.add(ticket)
    return ticket


def _seed_tickets(session: Session) -> None:
    _make_ticket(
        session,
        token="H001",
        created_min=108,
        status="completed",
        name="Maria Santos",
        age=34,
        sex="female",
        exposure_type="flood_wade",
        exposure_hours=3,
        open_cuts=True,
        symptoms=["fever", "muscle_pain", "red_eyes"],
        blood_pressure="118/76",
        barangay="Barangay Tumana, Marikina",
        exposure_recency_hours=18,
        called_min=98,
        completed_min=90,
        counter_id=1,
        dispensed=2,
        notes="Completed physician review; prophylaxis dispensed.",
    )
    _make_ticket(
        session,
        token="H002",
        created_min=55,
        status="serving",
        name="Liza Mendoza",
        age=61,
        sex="female",
        exposure_type="flood_wade",
        exposure_hours=4,
        open_cuts=True,
        symptoms=["fever", "red_eyes"],
        blood_pressure="142/88",
        barangay="Barangay 176, Caloocan",
        exposure_recency_hours=10,
        called_min=7,
        counter_id=1,
        notes="Fast-track review in progress.",
    )
    _make_ticket(
        session,
        token="H003",
        created_min=18,
        status="waiting",
        name="Paolo Garcia",
        age=28,
        sex="male",
        exposure_type="flood_swim",
        exposure_hours=1.5,
        open_cuts=False,
        symptoms=["fever", "muscle_pain"],
        blood_pressure="124/80",
        barangay="Barangay Poblacion, Makati",
        exposure_recency_hours=6,
    )
    _make_ticket(
        session,
        token="H004",
        created_min=11,
        status="waiting",
        name="Danilo Reyes",
        age=57,
        sex="male",
        exposure_type="rodent_urine",
        exposure_hours=2,
        open_cuts=True,
        symptoms=["headache", "chills"],
        blood_pressure="136/84",
        barangay="Barangay San Andres, Manila",
        exposure_recency_hours=30,
    )
    _make_ticket(
        session,
        token="M001",
        created_min=96,
        status="completed",
        name="Joel Ramos",
        age=45,
        sex="male",
        exposure_type="cleanup",
        exposure_hours=3,
        open_cuts=False,
        symptoms=["fever"],
        blood_pressure="126/82",
        barangay="Barangay Malanday, Valenzuela",
        exposure_recency_hours=28,
        called_min=86,
        completed_min=78,
        counter_id=2,
        notes="Reviewed; advised return precautions.",
    )
    _make_ticket(
        session,
        token="M002",
        created_min=45,
        status="serving",
        name="Ana Villanueva",
        age=52,
        sex="female",
        exposure_type="mud_contact",
        exposure_hours=2,
        open_cuts=False,
        symptoms=["muscle_pain", "headache"],
        blood_pressure="130/86",
        barangay="Barangay Bagong Silangan, Quezon City",
        exposure_recency_hours=22,
        called_min=5,
        counter_id=2,
        notes="Clinician assessment in progress.",
    )
    _make_ticket(
        session,
        token="M003",
        created_min=27,
        status="waiting",
        name="Carlo Bautista",
        age=30,
        sex="male",
        exposure_type="flood_wade",
        exposure_hours=1,
        open_cuts=False,
        symptoms=["fever"],
        blood_pressure="122/78",
        barangay="Barangay Dela Paz, Pasig",
        exposure_recency_hours=18,
    )
    _make_ticket(
        session,
        token="M004",
        created_min=14,
        status="waiting",
        name="Elena Cruz",
        age=24,
        sex="female",
        exposure_type="cleanup",
        exposure_hours=4,
        open_cuts=False,
        symptoms=["chills", "nausea"],
        blood_pressure="110/72",
        barangay="Barangay Batasan Hills, Quezon City",
        exposure_recency_hours=40,
    )
    _make_ticket(
        session,
        token="L001",
        created_min=72,
        status="completed",
        name="Grace Lim",
        age=24,
        sex="female",
        exposure_type="cleanup",
        exposure_hours=0.25,
        open_cuts=False,
        symptoms=[],
        blood_pressure="112/74",
        barangay="Barangay Plainview, Mandaluyong",
        exposure_recency_hours=50,
        called_min=64,
        completed_min=56,
        counter_id=3,
        notes="Low-risk advice given; no prophylaxis indicated.",
    )
    _make_ticket(
        session,
        token="L002",
        created_min=32,
        status="waiting",
        name="Ramon Aquino",
        age=40,
        sex="male",
        exposure_type="none",
        exposure_hours=0,
        open_cuts=False,
        symptoms=["headache"],
        blood_pressure="128/84",
        barangay="Barangay Addition Hills, San Juan",
        exposure_recency_hours=12,
    )
    _make_ticket(
        session,
        token="L003",
        created_min=18,
        status="waiting",
        name="Bea Navarro",
        age=19,
        sex="female",
        exposure_type="cleanup",
        exposure_hours=0.25,
        open_cuts=False,
        symptoms=[],
        blood_pressure="108/70",
        barangay="Barangay San Antonio, Pasig",
        exposure_recency_hours=6,
    )
    _make_ticket(
        session,
        token="L004",
        created_min=9,
        status="waiting",
        name="Tomas dela Cruz",
        age=66,
        sex="male",
        exposure_type="mud_contact",
        exposure_hours=0.5,
        open_cuts=False,
        symptoms=[],
        blood_pressure="134/80",
        barangay="Barangay 105, Manila",
        exposure_recency_hours=20,
    )

    _event(
        session,
        "completed",
        "H001 completed; 2 doxycycline capsules dispensed.",
        token="H001",
        actor="Dr. L. Santos",
        ago=90,
        meta={"dispensed": 2},
    )
    _event(
        session,
        "completed",
        "M001 completed clinician review.",
        token="M001",
        actor="Dr. L. Santos",
        ago=78,
    )
    _event(
        session,
        "completed",
        "L001 completed; no prophylaxis indicated.",
        token="L001",
        actor="Nurse J. Cruz",
        ago=56,
    )
    _event(
        session,
        "called",
        "H002 called to Counter 1 (fast-track).",
        token="H002",
        actor="Nurse A. Reyes",
        ago=7,
    )
    _event(
        session,
        "called",
        "M002 called to Counter 2.",
        token="M002",
        actor="Dr. L. Santos",
        ago=5,
    )


def seed_database(reset: bool = False) -> str:
    init_db()
    if reset:
        SQLModel.metadata.drop_all(engine)
        SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        has_regions = session.exec(select(SurveillanceRegion)).first() is not None
        has_inventory = session.exec(select(InventoryItem)).first() is not None
        has_counters = session.exec(select(Counter)).first() is not None
        has_tickets = session.exec(select(TriageTicket)).first() is not None

        if not has_regions:
            _seed_surveillance(session)
        if not has_inventory:
            _seed_inventory(session)
        if not has_tickets:
            # Counters need the serving ticket IDs; seed tickets first, then bind.
            _seed_tickets(session)
            session.flush()
            serving = session.exec(
                select(TriageTicket).where(TriageTicket.status == "serving")
            ).all()
            active = {ticket.counter_id: ticket.id for ticket in serving if ticket.counter_id}
            if not has_counters:
                _seed_counters(session, active)
            else:
                for counter in session.exec(select(Counter)).all():
                    counter.active_ticket_id = active.get(counter.id or 0)
                    session.add(counter)
        elif not has_counters:
            _seed_counters(session, {})

        session.commit()

    return "LeptoShield seed complete."


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the LeptoShield demo database.")
    parser.add_argument("--reset", action="store_true", help="Drop all data and reseed.")
    args = parser.parse_args()
    print(seed_database(reset=args.reset))
