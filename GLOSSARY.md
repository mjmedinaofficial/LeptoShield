# LeptoShield Domain Model

LeptoShield provides regional leptospirosis surveillance, experimental macro case forecasting, and administrative clinic queue simulation for public health preparedness.

## Core Language

**Intake Record**:
An administrative facility record documenting a patient's visit, structured exposure history, and workflow review status.
_Avoid_: Triage ticket, clinical chart, diagnostic intake, medical assessment

**Queue Token**:
A sequential alphanumeric identifier assigned to a facility visitor for queue sequencing.
_Avoid_: Priority tier, risk score, severity badge, triage level

**Surveillance Observation**:
A reviewed regional weekly count of leptospirosis cases or deaths extracted from official public health surveillance reports with verified provenance.
_Avoid_: Raw report count, clinical incidence, patient case

**Forecast Run**:
An immutable, experimental point-in-time projection of one-week-ahead regional weekly cases using count-bounded regression and rolling-origin backtesting against naive baselines.
_Avoid_: Outbreak warning, diagnostic prediction, outbreak confirmation, clinical risk

**Simulation Run**:
A discrete-event scenario model estimating facility counter throughput and visitor wait times under hypothetical flood surge parameters.
_Avoid_: Measured clinic performance, real-time wait tracker, clinical operational capacity

