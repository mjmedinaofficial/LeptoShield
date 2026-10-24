from __future__ import annotations

import asyncio
import random
import statistics
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import engine, get_session
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
from seed_data import seed_database
from triage_engine import (
    COMORBIDITIES,
    COUNTER_RULES,
    DISCLAIMER,
    EXPOSURE_TYPES,
    MODEL_VERSION,
    QUEUE_FORMULA,
    SEX_OPTIONS,
    SYMPTOMS,
    TIER_PREFIX,
    TIER_THRESHOLDS,
    compute_priority,
    engine_contract,
    evaluate_triage,
    pick_next,
    preemption_candidate,
    queue_position,
    sort_waiting,
    therapeutic_window,
    ticket_priority,
)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
MANILA_TZ = timezone(timedelta(hours=8))
TERMINAL_COMPLETE = {"completed", "referred"}


# --------------------------------------------------------------------------- #
# Pydantic request bodies
# --------------------------------------------------------------------------- #
class TriageIn(BaseModel):
    exposure_type: str
    exposure_hours: float = Field(default=0, ge=0, le=168)
    exposure_recency_hours: float = Field(default=24, ge=0, le=720)
    open_cuts: bool = False
    symptoms: List[str] = Field(default_factory=list)
    symptom_onset_hours: Optional[float] = Field(default=None, ge=0, le=720)
    age: Optional[int] = Field(default=None, ge=0, le=120)
    sex: Optional[str] = None
    pregnant: bool = False
    comorbidities: List[str] = Field(default_factory=list)
    name: Optional[str] = Field(default=None, max_length=120)
    barangay: Optional[str] = Field(default=None, max_length=120)
    contact: Optional[str] = Field(default=None, max_length=80)
    consent: bool = True


class CallIn(BaseModel):
    counter_id: int
    actor: str = Field(default="Triage desk", max_length=120)
    preempt: bool = False


class CompleteIn(BaseModel):
    ticket_id: str
    outcome: str = "completed"
    dispense: Optional[bool] = None
    quantity: Optional[int] = Field(default=None, ge=1, le=30)
    notes: Optional[str] = Field(default=None, max_length=1000)
    actor: str = Field(default="Triage desk", max_length=120)


class OverrideIn(BaseModel):
    ticket_id: str
    tier: str
    reason: str = Field(min_length=8, max_length=500)
    actor: str = Field(default="Duty nurse", max_length=120)


class RestockIn(BaseModel):
    quantity: int = Field(ge=1, le=10000)
    reason: str = Field(default="Restock delivery", max_length=240)
    actor: str = Field(default="Clinic pharmacy", max_length=120)


class DispenseIn(BaseModel):
    ticket_id: str
    quantity: int = Field(default=2, ge=1, le=30)
    actor: str = Field(default="Duty physician", max_length=120)


class SurgeIn(BaseModel):
    count: int = Field(default=5, ge=1, le=12)


# --------------------------------------------------------------------------- #
# App + websocket manager
# --------------------------------------------------------------------------- #
@asynccontextmanager
async def lifespan(_app: FastAPI):
    seed_database()
    yield


app = FastAPI(
    title="LeptoShield API",
    description=(
        "AI-assisted leptospirosis triage, dynamic fast-track queueing, and DOH "
        "surveillance prototype. Synthetic demo data only."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        async with self._lock:
            dead: List[WebSocket] = []
            for connection in list(self.active):
                try:
                    await connection.send_json(payload)
                except Exception:
                    dead.append(connection)
            for connection in dead:
                self.disconnect(connection)


manager = ConnectionManager()


async def broadcast_state(event: Optional[Dict[str, Any]] = None) -> None:
    payload = {"type": "state", "event": event, "data": _snapshot_sync()}
    await manager.broadcast(payload)


# --------------------------------------------------------------------------- #
# Serialization helpers
# --------------------------------------------------------------------------- #
def iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _minutes(seconds: float) -> float:
    return round(max(0.0, seconds) / 60.0, 1)


def _display_name(name: Optional[str]) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        return "Anonymous guest"
    parts = cleaned.split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


def _initials(name: Optional[str]) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        return "AG"
    parts = cleaned.split()
    if len(parts) == 1:
        return parts[0][:1].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _tier_label(tier: str) -> str:
    return {"high": "High risk", "moderate": "Moderate risk", "low": "Low risk"}.get(
        tier, tier.title()
    )


def _wait_seconds(ticket: TriageTicket, now: datetime) -> float:
    if ticket.status == "waiting":
        return max(0.0, (now - ticket.created_at).total_seconds())
    if ticket.called_at:
        return max(0.0, (ticket.called_at - ticket.created_at).total_seconds())
    if ticket.completed_at:
        return max(0.0, (ticket.completed_at - ticket.created_at).total_seconds())
    return max(0.0, (now - ticket.created_at).total_seconds())


def _ticket_summary(
    ticket: TriageTicket,
    now: datetime,
    *,
    private: bool = False,
    position: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    xai = ticket.xai or {}
    wait_s = _wait_seconds(ticket, now)
    serving_s = 0.0
    if ticket.status == "serving" and ticket.called_at:
        serving_s = max(0.0, (now - ticket.called_at).total_seconds())
    position = position or {
        "position": 0,
        "people_ahead": 0,
        "estimated_wait_minutes": 0,
        "tier_queue_length": 0,
    }
    return {
        "id": ticket.id,
        "token": ticket.token,
        "tier": ticket.tier,
        "tier_label": _tier_label(ticket.tier),
        "risk_score": round(float(ticket.risk_score or 0), 3),
        "priority_score": ticket_priority(ticket, now)
        if ticket.status in {"waiting", "serving"}
        else round(float(ticket.priority_score or 0), 2),
        "status": ticket.status,
        "display_name": ticket.name if private and ticket.name else _display_name(ticket.name),
        "initials": _initials(ticket.name),
        "name": ticket.name if private else None,
        "age": ticket.age,
        "sex": ticket.sex,
        "barangay": ticket.barangay,
        "exposure_type": ticket.exposure_type,
        "exposure_label": EXPOSURE_TYPES.get(ticket.exposure_type, {}).get(
            "short", ticket.exposure_type
        ),
        "exposure_hours": ticket.exposure_hours,
        "open_cuts": ticket.open_cuts,
        "symptoms": ticket.symptoms,
        "symptom_labels": [
            SYMPTOMS[key]["short"] for key in ticket.symptoms if key in SYMPTOMS
        ],
        "flags": xai.get("flags", []),
        "created_at": iso(ticket.created_at),
        "called_at": iso(ticket.called_at),
        "completed_at": iso(ticket.completed_at),
        "wait_seconds": round(wait_s),
        "wait_minutes": _minutes(wait_s),
        "serving_seconds": round(serving_s),
        "counter_id": ticket.counter_id,
        "counter_name": None,
        "position": position.get("position", 0),
        "people_ahead": position.get("people_ahead", 0),
        "estimated_wait_minutes": position.get("estimated_wait_minutes", 0),
        "tier_queue_length": position.get("tier_queue_length", 0),
        "preempted_count": ticket.preempted_count,
        "dispensed": ticket.dispensed,
        "dispensed_qty": ticket.dispensed_qty,
        "therapeutic": therapeutic_window(ticket.exposure_recency_hours),
        "priority_reviewed": bool(ticket.original_tier),
    }


def _counter_dict(
    counter: Counter,
    tickets_by_id: Dict[str, TriageTicket],
    now: datetime,
) -> Dict[str, Any]:
    active = tickets_by_id.get(counter.active_ticket_id or "")
    active_summary = _ticket_summary(active, now) if active else None
    if active_summary:
        active_summary["counter_name"] = counter.name
    return {
        "id": counter.id,
        "name": counter.name,
        "mode": counter.mode,
        "mode_label": "High-risk only" if counter.mode == "high" else "Flexible",
        "staff": counter.staff,
        "location": counter.location,
        "status": "serving" if active else "idle",
        "active": active_summary,
    }


def _start_of_today_utc(now: datetime) -> datetime:
    local = _as_aware(now).astimezone(MANILA_TZ)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def _as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _region_status(cases: int, alert: int, epidemic: int) -> str:
    if cases >= epidemic:
        return "epidemic"
    if cases >= alert:
        return "alert"
    return "normal"


def _inventory_summary(session: Session, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or utcnow()
    item = session.exec(select(InventoryItem)).first()
    if item is None:
        return {
            "available": False,
            "status": "unknown",
            "stock": 0,
            "reorder_threshold": 0,
            "days_remaining": None,
        }

    recent = session.exec(
        select(InventoryTxn)
        .where(InventoryTxn.item_id == item.id, InventoryTxn.created_at >= now - timedelta(days=7))
        .order_by(InventoryTxn.created_at.desc())
    ).all()
    dispensed_7d = sum(-txn.delta for txn in recent if txn.delta < 0 and txn.ticket_token)
    actual_daily = round(dispensed_7d / 7.0, 1)
    projected = float(item.projected_daily_use or 0)
    days_remaining = round(item.stock / projected, 1) if projected > 0 else None
    days_to_reorder = (
        max(0.0, (item.stock - item.reorder_threshold) / projected) if projected > 0 else None
    )
    if item.stock <= item.reorder_threshold:
        status = "critical"
    elif item.stock <= item.reorder_threshold * 1.5:
        status = "watch"
    else:
        status = "ok"

    return {
        "available": True,
        "id": item.id,
        "sku": item.sku,
        "name": item.name,
        "unit": item.unit,
        "stock": item.stock,
        "reorder_threshold": item.reorder_threshold,
        "par_level": item.par_level,
        "status": status,
        "days_remaining": days_remaining,
        "days_to_reorder": round(days_to_reorder, 1) if days_to_reorder is not None else None,
        "projected_daily_use": projected,
        "actual_daily_dispensed_7d": actual_daily,
        "pct_of_par": round(min(100.0, item.stock / max(1, item.par_level) * 100), 1),
        "updated_at": iso(item.updated_at),
    }


def _weather_payload(weather: Optional[WeatherSnapshot]) -> Optional[Dict[str, Any]]:
    if weather is None:
        return None
    return {
        "locality": weather.locality,
        "rainfall_24h_mm": weather.rainfall_24h_mm,
        "forecast_24h_mm": weather.forecast_24h_mm,
        "river_level_m": weather.river_level_m,
        "river_critical_m": weather.river_critical_m,
        "advisory": weather.advisory,
        "source": weather.source,
        "observed_at": iso(weather.observed_at),
    }


def _region_rows(session: Session) -> tuple[List[Dict[str, Any]], Optional[WeatherSnapshot]]:
    regions = session.exec(select(SurveillanceRegion).order_by(SurveillanceRegion.id)).all()
    weeks = session.exec(select(SurveillanceWeek)).all()
    weather = session.exec(select(WeatherSnapshot).order_by(WeatherSnapshot.observed_at.desc())).first()
    rows: List[Dict[str, Any]] = []
    for region in regions:
        history_rows = sorted(
            [week for week in weeks if week.region_code == region.code],
            key=lambda week: week.week_label,
        )
        history = [
            {
                "week": week.week_label,
                "cases": week.cases,
                "alert_threshold": week.alert_threshold,
                "epidemic_threshold": week.epidemic_threshold,
            }
            for week in history_rows
        ]
        status = _region_status(
            region.cases_current, region.alert_threshold, region.epidemic_threshold
        )
        previous = history[-2]["cases"] if len(history) >= 2 else None
        trend_pct = (
            round((region.cases_current - previous) / max(1, previous) * 100, 1)
            if previous is not None
            else None
        )
        rows.append(
            {
                "code": region.code,
                "name": region.name,
                "short_name": region.short_name,
                "week": region.current_week,
                "cases": region.cases_current,
                "alert_threshold": region.alert_threshold,
                "epidemic_threshold": region.epidemic_threshold,
                "status": status,
                "status_label": {
                    "epidemic": "Epidemic breach",
                    "alert": "Alert level",
                    "normal": "Below thresholds",
                }[status],
                "flagged_cities": region.flagged_cities,
                "history": history,
                "trend_pct": trend_pct,
                "pct_of_alert": round(region.cases_current / max(1, region.alert_threshold) * 100, 1),
                "pct_of_epidemic": round(
                    region.cases_current / max(1, region.epidemic_threshold) * 100, 1
                ),
                "margin_to_epidemic": region.cases_current - region.epidemic_threshold,
                "source_note": region.source_note,
                "updated_at": iso(region.updated_at),
            }
        )
    return rows, weather


def _surge_assessment(
    regions: List[Dict[str, Any]],
    weather: Optional[WeatherSnapshot],
    high_waiting: int,
    inventory: Dict[str, Any],
) -> Dict[str, Any]:
    if not regions:
        return {
            "score": 0,
            "label": "Unknown",
            "drivers": [],
            "recommendation": "No surveillance feed is loaded.",
        }
    max_ratio = max(row["cases"] / max(1, row["epidemic_threshold"]) for row in regions)
    breaches = sum(1 for row in regions if row["status"] == "epidemic")
    alerts = sum(1 for row in regions if row["status"] == "alert")
    rainfall = weather.rainfall_24h_mm if weather else 0
    inv_penalty = 12 if inventory.get("status") == "critical" else 4 if inventory.get("status") == "watch" else 0
    score = min(
        100.0,
        (max_ratio * 25.0)
        + (breaches * 10.0)
        + (alerts * 4.0)
        + min(12.0, high_waiting * 3.0)
        + min(12.0, rainfall / 200.0 * 12.0)
        + inv_penalty,
    )
    if score >= 80:
        label = "Critical"
    elif score >= 60:
        label = "High"
    elif score >= 38:
        label = "Elevated"
    else:
        label = "Guarded"

    recommendations = {
        "Critical": (
            "Activate overflow triage, keep Counter 3 open for high-risk support, and verify "
            "the doxycycline reserve now."
        ),
        "High": (
            "Staff the fast-track lane, pre-stage prophylaxis, and reassess rainfall and "
            "arrivals every 30 minutes."
        ),
        "Elevated": (
            "Keep a clinician on a flexible counter and watch the next 24–48 hours of rainfall."
        ),
        "Guarded": "Routine monitoring; no regional threshold breach is driving extra demand.",
    }
    drivers = [
        {
            "label": "Peak regional burden",
            "value": f"{round(max_ratio * 100)}% of epidemic threshold",
        },
        {"label": "Epidemic-breach regions", "value": f"{breaches} of {len(regions)}"},
        {"label": "High-risk waiting", "value": f"{high_waiting} patients"},
        {
            "label": "Rainfall, last 24 h",
            "value": f"{rainfall:.0f} mm" if weather else "No reading",
        },
        {
            "label": "Doxycycline cover",
            "value": (
                f"{inventory.get('days_remaining')} days"
                if inventory.get("days_remaining") is not None
                else "Unknown"
            ),
        },
    ]
    return {
        "score": round(score),
        "label": label,
        "drivers": drivers,
        "recommendation": recommendations[label],
        "forecast_window": "next 24–48 hours",
    }


def _alerts_snapshot(
    session: Session,
    stats: Dict[str, Any],
    inventory: Dict[str, Any],
    weather: Optional[WeatherSnapshot],
) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []
    ncr = session.exec(select(SurveillanceRegion).where(SurveillanceRegion.code == "NCR")).first()
    if ncr and ncr.cases_current >= ncr.epidemic_threshold:
        alerts.append(
            {
                "id": "ncr-epidemic",
                "level": "critical",
                "title": "DOH NCR epidemic breach",
                "message": (
                    f"{ncr.cases_current} cases this week — {ncr.cases_current - ncr.epidemic_threshold} "
                    f"above the {ncr.epidemic_threshold} epidemic threshold."
                ),
                "target": "surveillance",
            }
        )
    if stats["high_waiting"] >= 3:
        alerts.append(
            {
                "id": "high-waiting",
                "level": "critical",
                "title": "Fast-track queue building",
                "message": f"{stats['high_waiting']} high-risk patients are waiting.",
                "target": "queue",
            }
        )
    counter_one = session.get(Counter, 1)
    if stats["high_waiting"] > 0 and counter_one and not counter_one.active_ticket_id:
        alerts.append(
            {
                "id": "fast-track-idle",
                "level": "warning",
                "title": "Counter 1 is idle",
                "message": "High-risk patients are waiting while the fast-track counter is open.",
                "target": "counters",
            }
        )
    if inventory.get("status") == "critical":
        alerts.append(
            {
                "id": "stock-critical",
                "level": "critical",
                "title": "Doxycycline below reorder",
                "message": f"{inventory.get('stock')} capsules left — reorder threshold is {inventory.get('reorder_threshold')}.",
                "target": "inventory",
            }
        )
    elif inventory.get("status") == "watch":
        alerts.append(
            {
                "id": "stock-watch",
                "level": "warning",
                "title": "Doxycycline running low",
                "message": f"{inventory.get('stock')} capsules left; review the next delivery.",
                "target": "inventory",
            }
        )
    if weather and weather.rainfall_24h_mm >= 150:
        alerts.append(
            {
                "id": "rainfall",
                "level": "warning",
                "title": "Sustained rainfall",
                "message": f"{weather.rainfall_24h_mm:.0f} mm in 24 h — expect more flood exposure.",
                "target": "surveillance",
            }
        )
    return alerts


def _queue_stats(tickets: List[TriageTicket], counters: List[Counter], now: datetime) -> Dict[str, Any]:
    waiting = [t for t in tickets if t.status == "waiting"]
    high_waiting = sum(1 for t in waiting if t.tier == "high")
    moderate_waiting = sum(1 for t in waiting if t.tier == "moderate")
    low_waiting = sum(1 for t in waiting if t.tier == "low")
    serving = [t for t in tickets if t.status == "serving"]
    day_start = _start_of_today_utc(now)
    completed_today = [
        t
        for t in tickets
        if t.status in TERMINAL_COMPLETE
        and t.completed_at is not None
        and t.completed_at >= day_start
    ]
    waits = [
        (t.called_at - t.created_at).total_seconds() / 60.0
        for t in completed_today
        if t.called_at is not None
    ]
    longest = max(
        [((now - t.created_at).total_seconds() / 60.0) for t in waiting] or [0.0]
    )
    last_hour = [
        t
        for t in completed_today
        if t.completed_at is not None and t.completed_at >= now - timedelta(hours=1)
    ]
    return {
        "waiting": len(waiting),
        "high_waiting": high_waiting,
        "moderate_waiting": moderate_waiting,
        "low_waiting": low_waiting,
        "serving": len(serving),
        "completed_today": len(completed_today),
        "seen_today": len(completed_today),
        "no_shows_today": sum(
            1
            for t in tickets
            if t.status == "no_show"
            and t.completed_at is not None
            and t.completed_at >= day_start
        ),
        "avg_wait_minutes": round(statistics.mean(waits), 1) if waits else 0.0,
        "median_wait_minutes": round(statistics.median(waits), 1) if waits else 0.0,
        "longest_wait_minutes": round(longest, 1),
        "throughput_last_hour": len(last_hour),
        "counters_open": len(counters),
        "active_counters": sum(1 for counter in counters if counter.active_ticket_id),
        "high_risk_share": round(high_waiting / len(waiting) * 100) if waiting else 0,
        "estimated_clear_minutes": (
            round(len(waiting) / 2 * 4.5) if waiting else 0
        ),
    }


def _recent_events(session: Session, limit: int = 12) -> List[Dict[str, Any]]:
    events = session.exec(
        select(AuditEvent).order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit)
    ).all()
    return [
        {
            "id": event.id,
            "kind": event.kind,
            "message": event.message,
            "token": event.ticket_token,
            "actor": event.actor,
            "meta": event.meta,
            "created_at": iso(event.created_at),
        }
        for event in events
    ]


def _snapshot_sync() -> Dict[str, Any]:
    now = utcnow()
    with Session(engine) as session:
        tickets = session.exec(select(TriageTicket)).all()
        counters = session.exec(select(Counter).order_by(Counter.id)).all()
        waiting = [t for t in tickets if t.status == "waiting"]
        ranked = sort_waiting(waiting, now)
        positions = {
            ticket.id: queue_position(
                ticket, waiting, sum(1 for c in counters if c.active_ticket_id), now
            )
            for ticket in ranked
        }
        tickets_by_id = {ticket.id: ticket for ticket in tickets}
        counter_rows = [_counter_dict(counter, tickets_by_id, now) for counter in counters]

        waiting_rows: List[Dict[str, Any]] = []
        for ticket in ranked:
            row = _ticket_summary(ticket, now, position=positions.get(ticket.id))
            counter = next(
                (c for c in counters if c.id == ticket.counter_id),
                None,
            )
            row["counter_name"] = counter.name if counter else None
            waiting_rows.append(row)

        serving_rows = sorted(
            [t for t in tickets if t.status == "serving"],
            key=lambda t: t.called_at or now,
        )
        serving_out = []
        for ticket in serving_rows:
            row = _ticket_summary(ticket, now)
            counter = next((c for c in counters if c.id == ticket.counter_id), None)
            row["counter_name"] = counter.name if counter else None
            serving_out.append(row)

        completed = [
            t for t in tickets if t.status in TERMINAL_COMPLETE or t.status == "no_show"
        ]
        completed.sort(
            key=lambda t: t.completed_at or t.created_at,
            reverse=True,
        )
        recent_completed = []
        for ticket in completed[:8]:
            row = _ticket_summary(ticket, now, private=True)
            recent_completed.append(row)

        stats = _queue_stats(tickets, counters, now)
        stats["preemptions_today"] = len(
            session.exec(
                select(AuditEvent).where(
                    AuditEvent.kind == "preempted",
                    AuditEvent.created_at >= _start_of_today_utc(now),
                )
            ).all()
        )
        inventory = _inventory_summary(session, now)
        weather = session.exec(
            select(WeatherSnapshot).order_by(WeatherSnapshot.observed_at.desc())
        ).first()
        region_rows, _ = _region_rows(session)
        surveillance_summary = {
            "regions": [
                {
                    "code": row["code"],
                    "short_name": row["short_name"],
                    "cases": row["cases"],
                    "alert_threshold": row["alert_threshold"],
                    "epidemic_threshold": row["epidemic_threshold"],
                    "status": row["status"],
                }
                for row in region_rows
            ],
            "breaches": sum(1 for row in region_rows if row["status"] == "epidemic"),
            "alerts": sum(1 for row in region_rows if row["status"] == "alert"),
            "weather": _weather_payload(weather),
            "updated_at": iso(now),
        }
        alerts = _alerts_snapshot(session, stats, inventory, weather)
        surge = _surge_assessment(
            region_rows, weather, stats["high_waiting"], inventory
        )

        return {
            "generated_at": iso(now),
            "server_time": iso(now),
            "counters": counter_rows,
            "waiting": waiting_rows,
            "serving": serving_out,
            "recent_completed": recent_completed,
            "stats": stats,
            "alerts": alerts,
            "inventory": inventory,
            "surveillance": surveillance_summary,
            "surge": surge,
            "recent_events": _recent_events(session, 10),
            "engine": {
                "model_version": MODEL_VERSION,
                "thresholds": TIER_THRESHOLDS,
                "queue_formula": QUEUE_FORMULA,
                "counter_rules": COUNTER_RULES,
                "disclaimer": DISCLAIMER,
            },
            "demo": True,
        }


def _ticket_detail(session: Session, ticket: TriageTicket, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or utcnow()
    waiting = session.exec(select(TriageTicket).where(TriageTicket.status == "waiting")).all()
    counters = session.exec(select(Counter).order_by(Counter.id)).all()
    position = queue_position(
        ticket, waiting, sum(1 for c in counters if c.active_ticket_id), now
    )
    detail = _ticket_summary(ticket, now, private=True, position=position)
    detail["xai"] = ticket.xai or {}
    detail["notes"] = ticket.notes
    detail["contact"] = ticket.contact
    detail["original_tier"] = ticket.original_tier
    detail["priority_reviewed"] = bool(ticket.original_tier)
    detail["counter"] = None
    if ticket.counter_id:
        counter = next((c for c in counters if c.id == ticket.counter_id), None)
        if counter:
            detail["counter"] = {
                "id": counter.id,
                "name": counter.name,
                "mode": counter.mode,
                "mode_label": "High-risk only" if counter.mode == "high" else "Flexible",
                "staff": counter.staff,
                "location": counter.location,
            }
    detail["queue_context"] = {
        "waiting": len(waiting),
        "high_waiting": sum(1 for t in waiting if t.tier == "high"),
        "counters": len(counters),
        "generated_at": iso(now),
    }
    detail["next_step"] = {
        "waiting": (
            "Stay near the waiting area. You will be called at Counter 1."
            if ticket.tier == "high"
            else "Watch the overhead board for your token."
        ),
        "serving": (
            f"Proceed to {detail['counter']['name']} now."
            if detail["counter"]
            else "Proceed to the counter now."
        ),
        "completed": "Visit complete. Follow the aftercare advice below.",
        "referred": "You have been referred for further care. Follow the clinic's instructions.",
        "no_show": "This pass was closed. Ask the triage desk if you still need care.",
    }.get(ticket.status, "Ask the triage desk for help.")
    return detail


def _next_token(session: Session, tier: str) -> str:
    prefix = TIER_PREFIX[tier]
    tokens = session.exec(
        select(TriageTicket.token).where(TriageTicket.token.like(f"{prefix}%"))
    ).all()
    numbers = [int(token[1:]) for token in tokens if token[1:].isdigit()]
    return f"{prefix}{max(numbers, default=0) + 1:03d}"


def _audit(
    session: Session,
    kind: str,
    message: str,
    *,
    token: Optional[str] = None,
    actor: str = "system",
    now: Optional[datetime] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    session.add(
        AuditEvent(
            kind=kind,
            message=message,
            ticket_token=token,
            actor=actor,
            meta=meta or {},
            created_at=now or utcnow(),
        )
    )


def _event(kind: str, message: str, *, token: Optional[str] = None, actor: str = "system") -> Dict[str, Any]:
    return {
        "kind": kind,
        "message": message,
        "token": token,
        "actor": actor,
        "at": iso(utcnow()),
    }


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "time": iso(utcnow()), "database": "sqlite", "demo": True}


@app.get("/api/meta")
def meta(session: Session = Depends(get_session)) -> Dict[str, Any]:
    counters = session.exec(select(Counter).order_by(Counter.id)).all()
    return {
        "product": "LeptoShield",
        "engine": engine_contract(),
        "counters": [
            {
                "id": counter.id,
                "name": counter.name,
                "mode": counter.mode,
                "staff": counter.staff,
                "location": counter.location,
            }
            for counter in counters
        ],
        "station": "Manila Health Center · Lobby Kiosk 01",
        "demo": True,
        "note": "Synthetic prototype data. Not a medical device.",
    }


@app.post("/api/triage", status_code=201)
async def create_triage(payload: TriageIn, session: Session = Depends(get_session)) -> Dict[str, Any]:
    if payload.consent is not True:
        raise HTTPException(400, "Consent is required to create a triage pass.")
    if payload.exposure_type not in EXPOSURE_TYPES:
        raise HTTPException(422, "Unknown exposure type.")
    if payload.sex is not None and payload.sex not in SEX_OPTIONS:
        raise HTTPException(422, "Unknown sex selection.")
    unknown_symptoms = [
        symptom for symptom in payload.symptoms if symptom not in SYMPTOMS and symptom != "none"
    ]
    if unknown_symptoms:
        raise HTTPException(422, f"Unknown symptom: {unknown_symptoms[0]}.")
    unknown_comorbidities = [
        item for item in payload.comorbidities if item not in COMORBIDITIES
    ]
    if unknown_comorbidities:
        raise HTTPException(422, f"Unknown comorbidity: {unknown_comorbidities[0]}.")
    if payload.pregnant and payload.sex not in {"female", "undisclosed"}:
        raise HTTPException(422, "Pregnancy can only be recorded for a female patient.")

    symptoms = sorted({symptom for symptom in payload.symptoms if symptom in SYMPTOMS})
    comorbidities = sorted(set(payload.comorbidities))
    xai = evaluate_triage(
        {
            "exposure_type": payload.exposure_type,
            "exposure_hours": payload.exposure_hours,
            "open_cuts": payload.open_cuts,
            "symptoms": symptoms,
            "age": payload.age,
            "pregnant": payload.pregnant,
            "comorbidities": comorbidities,
        }
    )
    now = utcnow()
    tier = xai["tier"]
    token = _next_token(session, tier)
    ticket = TriageTicket(
        token=token,
        tier=tier,
        risk_score=xai["score"],
        priority_score=compute_priority(
            tier,
            xai["score"],
            now,
            age=payload.age,
            pregnant=payload.pregnant,
            comorbidities=comorbidities,
            severe="severe_symptom" in xai["flags"],
            now=now,
        ),
        status="waiting",
        name=(payload.name or "").strip() or None,
        age=payload.age,
        sex=payload.sex,
        pregnant=payload.pregnant,
        barangay=(payload.barangay or "").strip() or None,
        contact=(payload.contact or "").strip() or None,
        exposure_type=payload.exposure_type,
        exposure_hours=payload.exposure_hours,
        exposure_recency_hours=payload.exposure_recency_hours,
        open_cuts=payload.open_cuts,
        symptoms=symptoms,
        symptom_onset_hours=payload.symptom_onset_hours,
        comorbidities=comorbidities,
        consent=True,
        xai=xai,
        created_at=now,
    )
    session.add(ticket)
    _audit(
        session,
        "triage_created",
        f"{token} checked in · {_tier_label(tier)} · score {xai['score']:.2f}.",
        token=token,
        actor="Patient self-check-in",
        now=now,
        meta={"tier": tier, "score": xai["score"]},
    )
    session.commit()
    session.refresh(ticket)
    event = _event(
        "triage_created",
        f"{token} checked in · {_tier_label(tier)}.",
        token=token,
        actor="kiosk",
    )
    await broadcast_state(event)
    return _ticket_detail(session, ticket, now)


@app.get("/api/triage/{identifier}")
def get_triage(identifier: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    ticket = session.get(TriageTicket, identifier)
    if ticket is None:
        ticket = session.exec(
            select(TriageTicket).where(TriageTicket.token == identifier.upper())
        ).first()
    if ticket is None:
        raise HTTPException(404, "That triage pass could not be found.")
    return _ticket_detail(session, ticket)


@app.get("/api/queue")
def get_queue() -> Dict[str, Any]:
    return _snapshot_sync()


@app.get("/api/events")
def get_events(
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    return {"events": _recent_events(session, limit)}


@app.post("/api/queue/call")
async def call_next(payload: CallIn, session: Session = Depends(get_session)) -> Dict[str, Any]:
    now = utcnow()
    counter = session.get(Counter, payload.counter_id)
    if counter is None:
        raise HTTPException(404, "Counter not found.")

    waiting = session.exec(select(TriageTicket).where(TriageTicket.status == "waiting")).all()
    active = session.get(TriageTicket, counter.active_ticket_id) if counter.active_ticket_id else None
    preempted: Optional[TriageTicket] = None

    if active:
        if not payload.preempt:
            raise HTTPException(
                409,
                f"{counter.name} is serving {active.token}. Finish that consultation or use "
                "high-risk preemption.",
            )
        if counter.mode == "high":
            raise HTTPException(409, "Counter 1 cannot preempt an active high-risk consultation.")
        if active.tier == "high":
            raise HTTPException(409, "An active high-risk consultation is never interrupted.")
        candidate = preemption_candidate(waiting, now)
        if candidate is None:
            raise HTTPException(
                409,
                "No high-risk patient has crossed the 30-second preemption threshold yet.",
            )
        # Return the displaced patient to the queue with their wait credit intact.
        active.status = "waiting"
        active.counter_id = None
        active.called_at = None
        active.preempted_count += 1
        active.notes = (
            (active.notes + " " if active.notes else "")
            + f"Preempted at {now.strftime('%H:%M')} UTC for a high-risk patient; returned to queue."
        )
        counter.active_ticket_id = None
        preempted = active
        _audit(
            session,
            "preempted",
            f"{active.token} preempted at {counter.name} for high-risk fast-track.",
            token=active.token,
            actor=payload.actor,
            now=now,
            meta={"counter_id": counter.id, "counter": counter.name, "for_token": candidate.token},
        )
    else:
        candidate = pick_next(waiting, counter.mode, now)

    if candidate is None:
        if counter.mode == "high":
            raise HTTPException(409, "No high-risk patient is waiting for Counter 1.")
        raise HTTPException(409, "No patient is waiting.")

    candidate.status = "serving"
    candidate.counter_id = counter.id
    candidate.called_at = now
    counter.active_ticket_id = candidate.id
    session.add(candidate)
    session.add(counter)
    _audit(
        session,
        "called",
        f"{candidate.token} called to {counter.name}.",
        token=candidate.token,
        actor=payload.actor,
        now=now,
        meta={"counter_id": counter.id, "counter": counter.name, "tier": candidate.tier},
    )
    session.commit()

    message = f"{candidate.token} called to {counter.name}."
    if preempted:
        message = (
            f"{candidate.token} called to {counter.name}; {preempted.token} returned to the queue "
            "for high-risk fast-track."
        )
    event = _event(
        "preempted" if preempted else "called",
        message,
        token=candidate.token,
        actor=payload.actor,
    )
    await broadcast_state(event)
    return {
        "ok": True,
        "event": event,
        "ticket_id": candidate.id,
        "token": candidate.token,
        "counter_id": counter.id,
        "preempted_token": preempted.token if preempted else None,
    }


@app.post("/api/queue/complete")
async def complete_consultation(
    payload: CompleteIn, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    if payload.outcome not in {"completed", "no_show", "referred"}:
        raise HTTPException(422, "Outcome must be completed, no_show, or referred.")
    ticket = session.get(TriageTicket, payload.ticket_id)
    if ticket is None:
        raise HTTPException(404, "Ticket not found.")
    if ticket.status in TERMINAL_COMPLETE or ticket.status == "no_show":
        raise HTTPException(409, "This pass is already closed.")
    if payload.outcome == "no_show" and ticket.status != "waiting":
        raise HTTPException(409, "Only a waiting patient can be marked as a no-show.")
    if payload.outcome in {"completed", "referred"} and ticket.status != "serving":
        raise HTTPException(409, "Call the patient to a counter before completing the visit.")

    now = utcnow()
    dispense = payload.dispense
    if dispense is None:
        dispense = payload.outcome == "completed" and ticket.tier == "high"
    item = session.exec(select(InventoryItem)).first()
    quantity = payload.quantity or (2 if ticket.tier == "high" else 1)
    if dispense:
        if item is None:
            raise HTTPException(409, "No doxycycline stock record is available.")
        if item.stock < quantity:
            raise HTTPException(
                409,
                f"Only {item.stock} doxycycline capsules remain; cannot dispense {quantity}.",
            )
        item.stock -= quantity
        item.updated_at = now
        session.add(item)
        ticket.dispensed = True
        ticket.dispensed_qty += quantity
        session.add(
            InventoryTxn(
                item_id=item.id,
                delta=-quantity,
                reason=f"Doxycycline {quantity} caps · {ticket.token}",
                ticket_token=ticket.token,
                actor=payload.actor,
                created_at=now,
            )
        )

    if payload.notes:
        ticket.notes = (
            (ticket.notes + " " if ticket.notes else "") + payload.notes.strip()
        )
    ticket.status = payload.outcome
    ticket.completed_at = now
    counter = None
    if ticket.counter_id:
        counter = session.get(Counter, ticket.counter_id)
        if counter and counter.active_ticket_id == ticket.id:
            counter.active_ticket_id = None
            session.add(counter)
    session.add(ticket)
    action_word = {
        "completed": "completed",
        "no_show": "marked no-show",
        "referred": "referred",
    }[payload.outcome]
    _audit(
        session,
        payload.outcome,
        f"{ticket.token} {action_word}"
        + (f"; {quantity} doxycycline caps dispensed." if dispense else "."),
        token=ticket.token,
        actor=payload.actor,
        now=now,
        meta={"dispensed": quantity if dispense else 0, "counter_id": ticket.counter_id},
    )
    session.commit()
    session.refresh(ticket)
    event = _event(
        payload.outcome,
        f"{ticket.token} {action_word}"
        + (f" · {quantity} capsules dispensed" if dispense else ""),
        token=ticket.token,
        actor=payload.actor,
    )
    await broadcast_state(event)
    return {
        "ok": True,
        "event": event,
        "ticket": _ticket_summary(ticket, now, private=True),
        "inventory": _inventory_summary(session, now),
    }


@app.post("/api/queue/override")
async def override_priority(
    payload: OverrideIn, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    if payload.tier not in {"high", "moderate", "low"}:
        raise HTTPException(422, "Tier must be high, moderate, or low.")
    ticket = session.get(TriageTicket, payload.ticket_id)
    if ticket is None:
        raise HTTPException(404, "Ticket not found.")
    if ticket.status in TERMINAL_COMPLETE or ticket.status == "no_show":
        raise HTTPException(409, "Closed passes cannot be reprioritised.")
    if ticket.tier == payload.tier:
        raise HTTPException(400, "That pass already has this priority.")

    now = utcnow()
    previous = ticket.tier
    ticket.original_tier = ticket.original_tier or previous
    ticket.tier = payload.tier
    ticket.override_reason = payload.reason.strip()
    ticket.override_by = payload.actor
    released_from = None
    if ticket.status == "serving" and ticket.counter_id:
        counter = session.get(Counter, ticket.counter_id)
        if counter and counter.mode == "high" and payload.tier != "high":
            counter.active_ticket_id = None
            session.add(counter)
            released_from = counter.name
            ticket.status = "waiting"
            ticket.counter_id = None
            ticket.called_at = None
            ticket.notes = (
                (ticket.notes + " " if ticket.notes else "")
                + f"Priority changed to {payload.tier}; returned to queue from {counter.name}."
            )
    ticket.priority_score = compute_priority(
        ticket.tier,
        ticket.risk_score,
        ticket.created_at,
        age=ticket.age,
        pregnant=ticket.pregnant,
        comorbidities=ticket.comorbidities,
        severe="severe_symptom" in (ticket.xai or {}).get("flags", []),
        now=now,
    )
    session.add(ticket)
    _audit(
        session,
        "override",
        f"{ticket.token} priority changed {previous} → {payload.tier} by {payload.actor}: {payload.reason.strip()}",
        token=ticket.token,
        actor=payload.actor,
        now=now,
        meta={"from": previous, "to": payload.tier, "reason": payload.reason.strip()},
    )
    session.commit()
    session.refresh(ticket)
    event = _event(
        "override",
        f"{ticket.token} reprioritised {previous} → {payload.tier}",
        token=ticket.token,
        actor=payload.actor,
    )
    await broadcast_state(event)
    detail = _ticket_detail(session, ticket, now)
    detail["released_from"] = released_from
    return detail


@app.get("/api/surveillance")
def get_surveillance(session: Session = Depends(get_session)) -> Dict[str, Any]:
    now = utcnow()
    regions, weather = _region_rows(session)
    tickets = session.exec(select(TriageTicket)).all()
    waiting = [t for t in tickets if t.status == "waiting"]
    counters = session.exec(select(Counter)).all()
    stats = _queue_stats(tickets, counters, now)
    inventory = _inventory_summary(session, now)
    surge = _surge_assessment(regions, weather, sum(1 for t in waiting if t.tier == "high"), inventory)
    return {
        "generated_at": iso(now),
        "week": "MW38",
        "source": "DOH Epidemiology Bureau MW36–MW38, 2026 (seeded baseline)",
        "note": "Synthetic demo data built on the brief's DOH baselines. Not a live epidemiological feed.",
        "national": {
            "total_cases": sum(row["cases"] for row in regions),
            "epidemic_regions": sum(1 for row in regions if row["status"] == "epidemic"),
            "alert_regions": sum(1 for row in regions if row["status"] == "alert"),
            "regions_monitored": len(regions),
        },
        "regions": regions,
        "weather": _weather_payload(weather),
        "surge": surge,
        "queue_pressure": {
            "waiting": stats["waiting"],
            "high_waiting": stats["high_waiting"],
            "longest_wait_minutes": stats["longest_wait_minutes"],
            "estimated_clear_minutes": stats["estimated_clear_minutes"],
        },
        "inventory": inventory,
    }


@app.get("/api/inventory")
def get_inventory(session: Session = Depends(get_session)) -> Dict[str, Any]:
    now = utcnow()
    summary = _inventory_summary(session, now)
    transactions = session.exec(
        select(InventoryTxn).order_by(InventoryTxn.created_at.desc()).limit(25)
    ).all()
    return {
        "generated_at": iso(now),
        "item": summary,
        "transactions": [
            {
                "id": txn.id,
                "delta": txn.delta,
                "reason": txn.reason,
                "ticket_token": txn.ticket_token,
                "actor": txn.actor,
                "created_at": iso(txn.created_at),
            }
            for txn in transactions
        ],
        "note": "Synthetic inventory ledger for prototype demonstration.",
    }


@app.post("/api/inventory/restock")
async def restock(payload: RestockIn, session: Session = Depends(get_session)) -> Dict[str, Any]:
    item = session.exec(select(InventoryItem)).first()
    if item is None:
        raise HTTPException(404, "No inventory item found.")
    now = utcnow()
    item.stock += payload.quantity
    item.updated_at = now
    session.add(item)
    session.add(
        InventoryTxn(
            item_id=item.id,
            delta=payload.quantity,
            reason=payload.reason.strip(),
            actor=payload.actor,
            created_at=now,
        )
    )
    _audit(
        session,
        "restock",
        f"Doxycycline stock increased by {payload.quantity} capsules.",
        actor=payload.actor,
        now=now,
        meta={"quantity": payload.quantity, "reason": payload.reason.strip()},
    )
    session.commit()
    event = _event(
        "restock",
        f"Doxycycline restocked · +{payload.quantity} capsules",
        actor=payload.actor,
    )
    await broadcast_state(event)
    return get_inventory(session)


@app.post("/api/inventory/dispense")
async def dispense(payload: DispenseIn, session: Session = Depends(get_session)) -> Dict[str, Any]:
    ticket = session.get(TriageTicket, payload.ticket_id)
    if ticket is None:
        raise HTTPException(404, "Ticket not found.")
    item = session.exec(select(InventoryItem)).first()
    if item is None:
        raise HTTPException(404, "No inventory item found.")
    if item.stock < payload.quantity:
        raise HTTPException(409, f"Only {item.stock} capsules remain.")
    now = utcnow()
    item.stock -= payload.quantity
    item.updated_at = now
    ticket.dispensed = True
    ticket.dispensed_qty += payload.quantity
    session.add(item)
    session.add(ticket)
    session.add(
        InventoryTxn(
            item_id=item.id,
            delta=-payload.quantity,
            reason=f"Doxycycline {payload.quantity} caps · {ticket.token}",
            ticket_token=ticket.token,
            actor=payload.actor,
            created_at=now,
        )
    )
    _audit(
        session,
        "dispense",
        f"{payload.quantity} doxycycline caps dispensed to {ticket.token}.",
        token=ticket.token,
        actor=payload.actor,
        now=now,
    )
    session.commit()
    event = _event(
        "dispense",
        f"{ticket.token} · {payload.quantity} doxycycline capsules dispensed",
        token=ticket.token,
        actor=payload.actor,
    )
    await broadcast_state(event)
    return get_inventory(session)


@app.post("/api/demo/surge")
async def simulate_surge(payload: SurgeIn, session: Session = Depends(get_session)) -> Dict[str, Any]:
    first_names = [
        "Jose", "Andrea", "Mark", "Rosa", "Miguel", "Cristina",
        "Nestor", "Divina", "Ariel", "Lorna", "Ben", "Tess",
        "Irene", "Rafael", "Mila", "Dennis",
    ]
    last_names = [
        "Dizon", "Fernandez", "Ocampo", "Reyes", "Villanueva", "Mercado",
        "Santiago", "Bautista", "Navarro", "Pascual", "Alonzo", "Gutierrez",
    ]
    barangays = [
        "Barangay Tumana, Marikina", "Barangay 176, Caloocan",
        "Barangay Bagong Silangan, Quezon City", "Barangay Malanday, Valenzuela",
        "Barangay San Andres, Manila", "Barangay Dela Paz, Pasig",
        "Barangay Poblacion, Makati", "Barangay Addition Hills, San Juan",
    ]
    high_profiles = [
        {"exposure_type": "flood_swim", "exposure_hours": 3, "open_cuts": True, "symptoms": ["fever", "muscle_pain"]},
        {"exposure_type": "flood_wade", "exposure_hours": 5, "open_cuts": True, "symptoms": ["fever", "red_eyes"]},
        {"exposure_type": "rodent_urine", "exposure_hours": 2, "open_cuts": True, "symptoms": ["fever", "headache"]},
    ]
    moderate_profiles = [
        {"exposure_type": "cleanup", "exposure_hours": 3, "open_cuts": False, "symptoms": ["fever"]},
        {"exposure_type": "flood_wade", "exposure_hours": 1, "open_cuts": False, "symptoms": ["muscle_pain"]},
        {"exposure_type": "mud_contact", "exposure_hours": 2, "open_cuts": False, "symptoms": ["headache", "nausea"]},
    ]
    low_profiles = [
        {"exposure_type": "cleanup", "exposure_hours": 0.25, "open_cuts": False, "symptoms": []},
        {"exposure_type": "none", "exposure_hours": 0, "open_cuts": False, "symptoms": ["headache"]},
    ]

    now = utcnow()
    added: List[Dict[str, Any]] = []
    for index in range(payload.count):
        selector = index % 4
        if selector in (0, 3):
            profile = random.choice(high_profiles)
        elif selector == 1:
            profile = random.choice(moderate_profiles)
        else:
            profile = random.choice(low_profiles)
        created = now - timedelta(minutes=random.randint(1, 9), seconds=random.randint(0, 50))
        age = random.randint(18, 72)
        sex = random.choice(["female", "male"])
        xai = evaluate_triage(
            {
                "exposure_type": profile["exposure_type"],
                "exposure_hours": profile["exposure_hours"],
                "open_cuts": profile["open_cuts"],
                "symptoms": profile["symptoms"],
                "age": age,
                "pregnant": False,
                "comorbidities": [],
            }
        )
        token = _next_token(session, xai["tier"])
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        ticket = TriageTicket(
            token=token,
            tier=xai["tier"],
            risk_score=xai["score"],
            priority_score=compute_priority(
                xai["tier"],
                xai["score"],
                created,
                age=age,
                pregnant=False,
                comorbidities=[],
                severe="severe_symptom" in xai["flags"],
                now=created,
            ),
            status="waiting",
            name=name,
            age=age,
            sex=sex,
            barangay=random.choice(barangays),
            exposure_type=profile["exposure_type"],
            exposure_hours=profile["exposure_hours"],
            exposure_recency_hours=random.choice([6, 12, 24, 36, 48]),
            open_cuts=profile["open_cuts"],
            symptoms=profile["symptoms"],
            xai=xai,
            created_at=created,
        )
        session.add(ticket)
        session.flush()
        added.append({"id": ticket.id, "token": token, "tier": xai["tier"], "name": name})
        _audit(
            session,
            "surge",
            f"Demo surge arrival: {token} · {_tier_label(xai['tier'])}.",
            token=token,
            actor="Demo simulator",
            now=created,
            meta={"synthetic": True},
        )
    session.commit()
    event = _event(
        "surge",
        f"Demo surge · {payload.count} synthetic patients added",
        actor="Demo simulator",
    )
    await broadcast_state(event)
    return {"ok": True, "added": added, "event": event}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "hello", "data": _snapshot_sync()})
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json({"type": "pong", "at": iso(utcnow())})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# --------------------------------------------------------------------------- #
# Built SPA (optional)
# --------------------------------------------------------------------------- #
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "ws":
            raise HTTPException(404, "Not found.")
        candidate = (FRONTEND_DIST / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(FRONTEND_DIST.resolve()):
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
else:

    @app.get("/", include_in_schema=False)
    async def api_root() -> Dict[str, str]:
        return {
            "name": "LeptoShield API",
            "status": "running",
            "docs": "/docs",
            "frontend": "Run `npm run dev` in ../frontend (Vite proxies /api and /ws).",
        }
