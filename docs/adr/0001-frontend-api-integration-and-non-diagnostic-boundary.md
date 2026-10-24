# 0001: Frontend API Integration and Non-Diagnostic Boundary

## Context
The LeptoShield prototype frontend previously communicated with legacy, unauthenticated prototype endpoints (`/triage`, `/queue`) and displayed clinical risk tiers (`high`, `moderate`, `low`), disease probability scores, and medication dispensing controls. This violated specification requirements `FR-032` and `AC-009`, which strictly mandate that LeptoShield operate within an administrative facility intake and macro decision support boundary, with zero clinical diagnostic or treatment functions.

Furthermore, the verified backend services for regional surveillance (`/api/v1/surveillance`), one-week-ahead regional forecasting (`/api/v1/forecasts`), and discrete-event queue simulations (`/api/v1/simulations`) require JWT authentication and role-based access control (`admin`, `health_official`, `clinic_staff`), which were absent from the frontend.

## Decision
1. **API Client & Authentication:** Repoint `frontend/src/services/api.js` to `/api/v1`, attach JWT Bearer tokens to all requests via an Axios interceptor, and provide a persistent demo role switcher (`admin`, `health_official`, `clinic_staff`) populated with seeded demo credentials.
2. **Clinic Intake Boundary Compliance:** Purge clinical diagnostic scoring, risk tier badges, and medication dispensing actions from all intake and clinic views. Replace them with administrative workflow review statuses (`created` → `under_review` → `reviewed` → `closed`) and facility queue tokens.
3. **Surveillance & Forecasting Surface:** Introduce a dedicated `/forecasts` view exposing regional case history from reviewed surveillance reports, on-demand execution of `ridge_lag3`, baseline backtest comparisons (MAE/RMSE), empirical uncertainty intervals, and explicit non-diagnostic disclaimers.
4. **Queue Simulation Integration:** Connect the administrative simulation controls to `/api/v1/simulations` with preset configurations (Normal Operations vs. Flood Surge), server-side parameter bounds, and clear simulation labels.

## Execution Order
Implementation will proceed sequentially:
1. **Authentication & API Client Foundation (Q1)**
2. **Clinic Intake & Non-Diagnostic Cleanup (Q3)**
3. **Regional Surveillance & Forecasting Dashboard (Q2)**
4. **Discrete-Event Queue Simulation Integration (Q4)**

