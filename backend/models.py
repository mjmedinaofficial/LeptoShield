from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp. SQLModel's UTCDateTime type stores these and
    returns them aware, so every comparison in the app stays offset-safe."""
    return datetime.now(timezone.utc)


class TriageTicket(SQLModel, table=True):
    __tablename__ = "triage_tickets"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    token: str = Field(index=True, unique=True)
    tier: str = Field(index=True)  # high | moderate | low
    original_tier: Optional[str] = None
    risk_score: float = 0.0
    priority_score: float = 0.0
    status: str = Field(default="waiting", index=True)  # waiting | serving | completed | no_show

    # Identity (optional for anonymous intake)
    name: Optional[str] = Field(default=None, max_length=120)
    age: Optional[int] = None
    sex: Optional[str] = None  # female | male | other | undisclosed
    pregnant: bool = False
    barangay: Optional[str] = Field(default=None, max_length=120)
    contact: Optional[str] = Field(default=None, max_length=80)

    # Exposure and clinical intake
    exposure_type: str
    exposure_hours: float = 0.0
    exposure_recency_hours: float = 24.0
    open_cuts: bool = False
    symptoms: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    symptom_onset_hours: Optional[float] = None
    comorbidities: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    consent: bool = True

    xai: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Queue state
    counter_id: Optional[int] = None
    preempted_count: int = 0
    dispensed: bool = False
    dispensed_qty: int = 0
    notes: Optional[str] = Field(default=None, max_length=2000)
    override_reason: Optional[str] = Field(default=None, max_length=1000)
    override_by: Optional[str] = Field(default=None, max_length=120)

    created_at: datetime = Field(default_factory=utcnow, index=True)
    called_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class Counter(SQLModel, table=True):
    __tablename__ = "counters"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    mode: str = "flexible"  # high | flexible
    staff: str = ""
    location: str = ""
    active_ticket_id: Optional[str] = None


class SurveillanceRegion(SQLModel, table=True):
    __tablename__ = "surveillance_regions"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    name: str
    short_name: str
    current_week: str = "MW38"
    cases_current: int
    alert_threshold: int
    epidemic_threshold: int
    flagged_cities: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    source_note: str = "DOH Epidemiology Bureau weekly surveillance (seeded)"
    updated_at: datetime = Field(default_factory=utcnow)


class SurveillanceWeek(SQLModel, table=True):
    __tablename__ = "surveillance_weeks"

    id: Optional[int] = Field(default=None, primary_key=True)
    region_code: str = Field(index=True)
    week_label: str
    cases: int
    alert_threshold: int
    epidemic_threshold: int


class WeatherSnapshot(SQLModel, table=True):
    __tablename__ = "weather_snapshots"

    id: Optional[int] = Field(default=None, primary_key=True)
    locality: str = "Metro Manila"
    rainfall_24h_mm: float = 0.0
    forecast_24h_mm: float = 0.0
    river_level_m: float = 0.0
    river_critical_m: float = 16.0
    advisory: str = ""
    source: str = "PAGASA-style seeded feed"
    observed_at: datetime = Field(default_factory=utcnow)


class InventoryItem(SQLModel, table=True):
    __tablename__ = "inventory_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str = Field(index=True, unique=True)
    name: str
    unit: str
    stock: int
    reorder_threshold: int
    par_level: int = 2000
    projected_daily_use: float = 38.0
    updated_at: datetime = Field(default_factory=utcnow)


class InventoryTxn(SQLModel, table=True):
    __tablename__ = "inventory_transactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(index=True)
    delta: int
    reason: str
    ticket_token: Optional[str] = None
    actor: str = "system"
    created_at: datetime = Field(default_factory=utcnow, index=True)


class AuditEvent(SQLModel, table=True):
    __tablename__ = "audit_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str = Field(index=True)
    message: str
    ticket_token: Optional[str] = None
    actor: str = "system"
    meta: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow, index=True)
