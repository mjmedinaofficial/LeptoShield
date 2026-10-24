# LeptoShield Models (`leptoshield-models`)

Canonical framework-independent SQLAlchemy 2.0 declarative models for the LeptoShield ecosystem.

## Design Principles
1. **Framework Independence:** Depends solely on `sqlalchemy>=2.0` and Python standard library. No FastAPI, Pydantic web schemas, or router imports.
2. **Single Source of Truth:** Shared between the offline surveillance ingestion pipeline (`data-pipeline-weekly-surveilance`) and the web application (`LeptoShield/backend`).
3. **Alembic Compatibility:** 100% compliant with the authoritative Alembic migration chain (`b9887f5b9049` -> `c14d453d6236`).

## Contained Entities
- `users`: User accounts and server-side roles (`admin`, `health_official`, `clinic_staff`).
- `source_reports`: Weekly surveillance source reports with content hash and revision provenance.
- `regional_observations`: Granular regional observations with explicit metric semantics, page provenance, and review status.
- `forecast_runs`: Immutable regional forecast run metadata.
- `regional_forecasts`: Regional forecast estimates and baseline values.
- `intake_records`: Administrative clinic intake workflow records.
- `simulation_runs`: Discrete-event SimPy queue simulation run parameters and metrics.
- `audit_events`: System-wide audit log for compliance and provenance tracking.

