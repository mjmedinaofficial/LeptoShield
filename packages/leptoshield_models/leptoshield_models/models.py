"""Canonical framework-independent SQLAlchemy 2.0 declarative models for LeptoShield.

This module contains zero web framework dependencies (no FastAPI, Starlette, or Pydantic schemas)
and depends solely on SQLAlchemy 2.0 and Python standard library utilities.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'health_official', 'clinic_staff')",
            name="ck_users_role",
        ),
    )


class SourceReportRow(Base):
    __tablename__ = "source_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_key: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    source_title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    source_agency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    report_period_label: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    published_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    relative_path: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    filename: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    source_reference: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    content_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    revision_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    supersedes_report_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="imported", nullable=False)
    supersedes_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("source_reports.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    observations: Mapped[list["RegionalObservationRow"]] = relationship(
        "RegionalObservationRow", back_populates="source_report"
    )

    def __init__(self, **kwargs: Any) -> None:
        if "sha256" in kwargs and "content_sha256" not in kwargs:
            kwargs["content_sha256"] = kwargs.pop("sha256")
        if "source_title" not in kwargs and "report_key" in kwargs:
            kwargs["source_title"] = kwargs["report_key"]
        if "source_reference" not in kwargs:
            kwargs["source_reference"] = kwargs.get("relative_path", "")
        super().__init__(**kwargs)

    @property
    def sha256(self) -> str:
        return self.content_sha256

    @sha256.setter
    def sha256(self, value: str) -> None:
        self.content_sha256 = value

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'imported', 'reviewed', 'usable', 'superseded')",
            name="ck_source_reports_status",
        ),
        Index("ix_source_reports_status_period", "status", "period_start", "period_end"),
        Index("ix_source_reports_key_hash", "report_key", "content_sha256"),
    )


class RegionalObservationRow(Base):
    __tablename__ = "regional_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_report_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("source_reports.id", ondelete="RESTRICT"), nullable=False
    )
    record_key: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    region_code: Mapped[str] = mapped_column(String(32), nullable=False)
    region_name: Mapped[str] = mapped_column(String(120), nullable=False)
    source_region_label: Mapped[str] = mapped_column(String(120), nullable=False)
    observation_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    observation_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    observation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metric: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    semantics: Mapped[str] = mapped_column(String(32), nullable=False)
    source_page: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_value: Mapped[str] = mapped_column(String(64), nullable=False)
    review_status: Mapped[str] = mapped_column(String(24), default="approved", nullable=False)
    review_decision_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revision_of_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("regional_observations.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    source_report: Mapped["SourceReportRow"] = relationship(
        "SourceReportRow", back_populates="observations"
    )
    revision_of: Mapped[Optional["RegionalObservationRow"]] = relationship(
        "RegionalObservationRow",
        remote_side=[id],
        back_populates="revisions",
    )
    revisions: Mapped[list["RegionalObservationRow"]] = relationship(
        "RegionalObservationRow",
        back_populates="revision_of",
    )

    __table_args__ = (
        CheckConstraint(
            "review_status IN ('approved', 'reviewed', 'superseded')",
            name="ck_regional_obs_review_status",
        ),
        Index("ix_reg_obs_region_metric_period", "region_code", "metric", "observation_period_start"),
        Index("ix_reg_obs_status_metric_period", "review_status", "metric", "observation_period_start"),
        Index(
            "uq_reg_obs_natural_key",
            "source_report_id",
            "region_code",
            "observation_period_start",
            "observation_period_end",
            "metric",
            "semantics",
            unique=True,
            sqlite_where=text("review_status != 'superseded'"),
        ),
    )


class ForecastRunRow(Base):
    __tablename__ = "forecast_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    metric_code: Mapped[str] = mapped_column(String(64), nullable=False)
    target_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    target_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model_version: Mapped[str] = mapped_column(String(40), nullable=False)
    training_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    training_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    baseline_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    evaluation_metrics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    regional_forecasts: Mapped[list["RegionalForecastRow"]] = relationship(
        "RegionalForecastRow", back_populates="forecast_run"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('completed', 'unavailable', 'failed')",
            name="ck_forecast_runs_status",
        ),
        Index("ix_forecast_runs_metric_period_created", "metric_code", "target_period_start", "created_at"),
    )


class RegionalForecastRow(Base):
    __tablename__ = "regional_forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    forecast_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("forecast_runs.id", ondelete="CASCADE"), nullable=False
    )
    region_code: Mapped[str] = mapped_column(String(32), nullable=False)
    region_name: Mapped[str] = mapped_column(String(120), nullable=False)
    predicted_value: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    lower_bound: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    upper_bound: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    baseline_value: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    forecast_run: Mapped["ForecastRunRow"] = relationship(
        "ForecastRunRow", back_populates="regional_forecasts"
    )

    __table_args__ = (
        CheckConstraint("status IN ('available', 'unavailable')", name="ck_regional_forecasts_status"),
        UniqueConstraint("forecast_run_id", "region_code", name="uq_regional_forecasts_run_region"),
    )


class IntakeRecordRow(Base):
    __tablename__ = "intake_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    demo_reference: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exposure_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    exposure_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    exposure_duration_hours: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    symptom_codes_json: Mapped[str] = mapped_column(Text, nullable=False)
    temperature_c: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    staff_workflow_status: Mapped[str] = mapped_column(String(32), nullable=False)
    staff_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reviewed_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "staff_workflow_status IN ('created', 'under_review', 'reviewed', 'closed')",
            name="ck_intake_records_status",
        ),
        Index("ix_intake_records_status_created", "staff_workflow_status", "created_at"),
    )


class SimulationRunRow(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(40), nullable=False)
    config_json: Mapped[str] = mapped_column(Text, nullable=False)
    random_seed: Mapped[int] = mapped_column(Integer, nullable=False)
    arrivals_generated: Mapped[int | None] = mapped_column(Integer, nullable=True)
    arrivals_served: Mapped[int | None] = mapped_column(Integer, nullable=True)
    median_wait_minutes: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    p90_wait_minutes: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    max_wait_minutes: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    average_utilization: Mapped[float | None] = mapped_column(Numeric(8, 5), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('running', 'completed', 'failed')",
            name="ck_simulation_runs_status",
        ),
        Index("ix_simulation_runs_created_policy", "created_at", "policy_name"),
    )


class AuditEventRow(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(80), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    outcome: Mapped[str] = mapped_column(String(24), nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "outcome IN ('success', 'failure', 'conflict', 'skipped')",
            name="ck_audit_events_outcome",
        ),
        Index("ix_audit_events_created_actor_action", "created_at", "actor_user_id", "action"),
    )

