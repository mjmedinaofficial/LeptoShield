"""LeptoShield triage + dynamic queue scoring engine.

This module is deliberately transparent. The "AI" is an explainable rule set:
every point that changes a patient's tier is emitted as a factor with its
source, so a clinician can audit the result instead of trusting a black box.
"""
from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from typing import Any, Dict, List, Optional, Sequence

MODEL_VERSION = "LS-TRIAGE 1.0 (transparent ruleset)"
DISCLAIMER = (
    "LeptoShield is clinical decision support, not a diagnosis. It does not replace a "
    "clinician. If you feel severely unwell, tell clinic staff immediately."
)

TIER_THRESHOLDS = {"high": 0.60, "moderate": 0.32}
TIER_LABELS = {"high": "High risk", "moderate": "Moderate risk", "low": "Low risk"}
TIER_PREFIX = {"high": "H", "moderate": "M", "low": "L"}

EXPOSURE_TYPES: Dict[str, Dict[str, Any]] = {
    "flood_swim": {
        "label": "Swam or was submerged in floodwater",
        "short": "Full-body flood contact",
        "description": "Head, face, or a large area of skin went under floodwater.",
        "base": 0.40,
    },
    "flood_wade": {
        "label": "Waded through floodwater",
        "short": "Wading",
        "description": "Walked or worked with feet and legs in floodwater.",
        "base": 0.32,
    },
    "rodent_urine": {
        "label": "Touched rodent urine or contaminated mud",
        "short": "Rodent / mud contact",
        "description": "Direct contact with urine, wet soil, or silt where rats may have been.",
        "base": 0.38,
    },
    "mud_contact": {
        "label": "Handled mud, silt, or soaked objects",
        "short": "Mud / objects",
        "description": "Cleaned or carried wet items without full flood immersion.",
        "base": 0.24,
    },
    "cleanup": {
        "label": "Cleaned a flooded home or yard",
        "short": "Flood cleanup",
        "description": "Swept, scrubbed, or cleared debris after the water receded.",
        "base": 0.22,
    },
    "none": {
        "label": "No known flood or animal contact",
        "short": "No direct contact",
        "description": "You are here because of symptoms or another concern.",
        "base": 0.05,
    },
}

SYMPTOMS: Dict[str, Dict[str, Any]] = {
    "fever": {
        "label": "Fever or feeling very hot",
        "short": "Fever",
        "description": "Temperature at or above 38°C, or chills with feeling hot.",
        "points": 0.18,
    },
    "muscle_pain": {
        "label": "Muscle pain, especially in the calves",
        "short": "Calf / muscle pain",
        "description": "Aching or tender calves, thighs, or lower back.",
        "points": 0.14,
    },
    "red_eyes": {
        "label": "Red or irritated eyes",
        "short": "Red eyes",
        "description": "Conjunctival suffusion: redness without much discharge.",
        "points": 0.16,
    },
    "headache": {
        "label": "Headache",
        "short": "Headache",
        "description": "New or unusual headache.",
        "points": 0.06,
    },
    "chills": {
        "label": "Chills or shivering",
        "short": "Chills",
        "description": "Shaking chills, even without a measured temperature.",
        "points": 0.05,
    },
    "nausea": {
        "label": "Nausea or vomiting",
        "short": "Nausea",
        "description": "Feeling sick to the stomach or vomiting.",
        "points": 0.04,
    },
    "jaundice": {
        "label": "Yellow eyes or skin",
        "short": "Yellow eyes / skin",
        "description": "A sign of more serious illness that needs urgent review.",
        "points": 0.20,
        "severe": True,
    },
    "low_urine": {
        "label": "Much less urine than usual",
        "short": "Low urine",
        "description": "Passing very little urine, or none for many hours.",
        "points": 0.20,
        "severe": True,
    },
}

COMORBIDITIES: Dict[str, Dict[str, Any]] = {
    "diabetes": {"label": "Diabetes", "points": 0.06},
    "kidney": {"label": "Kidney disease", "points": 0.08},
    "liver": {"label": "Liver disease", "points": 0.06},
    "immuno": {"label": "Weakened immune system", "points": 0.08},
    "heart": {"label": "Heart disease", "points": 0.05},
}

SEX_OPTIONS = ["female", "male", "other", "undisclosed"]

TIER_BASE = {"high": 1000.0, "moderate": 500.0, "low": 100.0}
AGEING_PER_MINUTE = 2.4
AGEING_CAP = 240.0
PREEMPT_AFTER_SECONDS = 30

QUEUE_FORMULA = (
    "priority = tier base (H 1000 / M 500 / L 100) + 100 × risk score + "
    "wait ageing (2.4/min, capped at 240) + vulnerability (0–45)"
)
COUNTER_RULES = (
    "Counter 1 is dedicated to high-risk patients. Counters 2 and 3 serve any tier. "
    "When a high-risk patient has waited at least 30 seconds, a flexible counter may "
    "preempt a lower-tier consultation; the displaced patient returns to the queue with "
    "their wait credit intact and the event is audited."
)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _as_utc(value: Optional[datetime]) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _factor(
    key: str,
    label: str,
    detail: str,
    points: float,
    category: str,
    max_points: Optional[float] = None,
) -> Dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "detail": detail,
        "points": round(points, 3),
        "max_points": round(max_points if max_points is not None else points, 3),
        "category": category,
    }


def evaluate_triage(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return score, tier, factors and patient-facing explanation."""
    exposure_type = str(payload.get("exposure_type") or "none")
    exposure = EXPOSURE_TYPES.get(exposure_type, EXPOSURE_TYPES["none"])
    exposure_hours = float(payload.get("exposure_hours") or 0)
    open_cuts = bool(payload.get("open_cuts"))
    symptoms: List[str] = [s for s in (payload.get("symptoms") or []) if s in SYMPTOMS]
    age = payload.get("age")
    pregnant = bool(payload.get("pregnant"))
    comorbidities: List[str] = [
        c for c in (payload.get("comorbidities") or []) if c in COMORBIDITIES
    ]

    factors: List[Dict[str, Any]] = []

    factors.append(
        _factor(
            "exposure",
            "Flood exposure",
            exposure["label"],
            exposure["base"],
            "exposure",
            max_points=0.40,
        )
    )

    if exposure_type != "none":
        if exposure_hours > 6:
            factors.append(
                _factor(
                    "duration",
                    "Contact time over 6 hours",
                    f"{exposure_hours:g} hours in contact with floodwater or contaminated material.",
                    0.20,
                    "exposure",
                    max_points=0.20,
                )
            )
        elif exposure_hours > 2:
            factors.append(
                _factor(
                    "duration",
                    "Contact time over 2 hours",
                    f"{exposure_hours:g} hours in contact — prolonged exposure raises risk.",
                    0.14,
                    "exposure",
                    max_points=0.20,
                )
            )
        elif exposure_hours > 0.5:
            factors.append(
                _factor(
                    "duration",
                    "Contact time 30 minutes to 2 hours",
                    f"{exposure_hours:g} hours in contact.",
                    0.06,
                    "exposure",
                    max_points=0.20,
                )
            )

    if open_cuts:
        factors.append(
            _factor(
                "open_cuts",
                "Open cut or abrasion",
                "Broken skin gives leptospires a direct route into the bloodstream.",
                0.25,
                "exposure",
                max_points=0.25,
            )
        )

    for key in SYMPTOMS:
        if key in symptoms:
            symptom = SYMPTOMS[key]
            factors.append(
                _factor(
                    f"symptom_{key}",
                    symptom["label"],
                    symptom["description"],
                    float(symptom["points"]),
                    "symptom",
                    max_points=0.20,
                )
            )

    has_fever = "fever" in symptoms
    has_muscle = "muscle_pain" in symptoms
    has_red_eyes = "red_eyes" in symptoms
    flags: List[str] = []
    if has_fever and has_muscle and has_red_eyes:
        factors.append(
            _factor(
                "cluster_triad",
                "Classic symptom cluster",
                "Fever, muscle pain, and red eyes together are a recognised leptospirosis pattern.",
                0.10,
                "pattern",
                max_points=0.10,
            )
        )
        flags.append("classic_triad")
    elif has_fever and (has_muscle or has_red_eyes):
        factors.append(
            _factor(
                "cluster_pair",
                "Fever with a key sign",
                "Fever alongside muscle pain or red eyes raises clinical concern.",
                0.05,
                "pattern",
                max_points=0.10,
            )
        )

    if "jaundice" in symptoms or "low_urine" in symptoms:
        flags.append("severe_symptom")
    if open_cuts:
        flags.append("open_wound")

    if age is not None:
        try:
            age_value = int(age)
        except (TypeError, ValueError):
            age_value = None
        if age_value is not None:
            if age_value >= 60:
                factors.append(
                    _factor(
                        "age_older",
                        "Age 60 or older",
                        "Older adults face a higher risk of severe leptospirosis.",
                        0.06,
                        "vulnerability",
                        max_points=0.08,
                    )
                )
                flags.append("older_adult")
            elif age_value <= 12:
                factors.append(
                    _factor(
                        "age_child",
                        "Child 12 or younger",
                        "Children are prioritised for clinician review.",
                        0.04,
                        "vulnerability",
                        max_points=0.08,
                    )
                )
                flags.append("child")

    if pregnant:
        factors.append(
            _factor(
                "pregnancy",
                "Pregnancy",
                "Pregnancy warrants a lower threshold for clinician review.",
                0.08,
                "vulnerability",
                max_points=0.08,
            )
        )
        flags.append("pregnant")

    for key in comorbidities:
        item = COMORBIDITIES[key]
        factors.append(
            _factor(
                f"comorbidity_{key}",
                item["label"],
                "A pre-existing condition that can worsen outcomes.",
                float(item["points"]),
                "vulnerability",
                max_points=0.08,
            )
        )

    if "older_adult" in flags or "child" in flags or "pregnant" in flags:
        flags.append("vulnerable")

    raw_score = sum(f["points"] for f in factors)
    score = round(_clamp(raw_score, 0.0, 1.0), 3)

    if score >= TIER_THRESHOLDS["high"] or "severe_symptom" in flags:
        tier = "high"
    elif score >= TIER_THRESHOLDS["moderate"]:
        tier = "moderate"
    else:
        tier = "low"

    if "severe_symptom" in flags and score < TIER_THRESHOLDS["high"]:
        factors.append(
            _factor(
                "severe_override",
                "Urgent clinical sign",
                "Yellow eyes/skin or very low urine output requires same-visit clinician review.",
                0.0,
                "pattern",
                max_points=0.0,
            )
        )

    summaries = {
        "high": (
            "Your exposure and symptoms meet the fast-track threshold. A clinician should "
            "assess you now; doxycycline prophylaxis may be offered if appropriate."
        ),
        "moderate": (
            "Your answers show a meaningful risk. A clinician should assess you, but you do "
            "not meet the fast-track threshold right now."
        ),
        "low": (
            "Your current risk is low. Watch for fever, calf pain, or red eyes over the next "
            "2–14 days and return promptly if they appear."
        ),
    }
    recommendations = {
        "high": (
            "Go to Counter 1 now. Staff have been alerted and you will bypass the standard "
            "line. Do not wait for symptoms to worsen."
        ),
        "moderate": (
            "Proceed to Counter 2 or 3 for clinician review. Tell staff immediately if fever, "
            "severe calf pain, red eyes, or reduced urine develops."
        ),
        "low": (
            "You may wait in the standard line. Keep cuts covered, wash with clean water and "
            "soap, and seek care if symptoms appear."
        ),
    }

    core_fields = [exposure_type, symptoms, age, payload.get("open_cuts")]
    completeness = sum(1 for field in core_fields if field not in (None, [], ""))
    confidence = round(_clamp(0.62 + 0.09 * completeness + (0.04 if comorbidities else 0), 0, 0.97), 2)

    return {
        "score": score,
        "raw_score": round(raw_score, 3),
        "tier": tier,
        "tier_label": TIER_LABELS[tier],
        "thresholds": TIER_THRESHOLDS,
        "factors": factors,
        "flags": flags,
        "summary": summaries[tier],
        "recommendation": recommendations[tier],
        "confidence": confidence,
        "model_version": MODEL_VERSION,
        "disclaimer": DISCLAIMER,
    }


def compute_priority(
    tier: str,
    risk_score: float,
    created_at: datetime,
    *,
    age: Optional[int] = None,
    pregnant: bool = False,
    comorbidities: Optional[Sequence[str]] = None,
    severe: bool = False,
    now: Optional[datetime] = None,
) -> float:
    now_dt = _as_utc(now)
    created = _as_utc(created_at)
    waited_seconds = max(0.0, (now_dt - created).total_seconds())
    ageing = min(AGEING_CAP, (waited_seconds / 60.0) * AGEING_PER_MINUTE)
    vulnerability = 0.0
    if pregnant or (age is not None and (age >= 60 or age <= 12)):
        vulnerability += 30.0
    if comorbidities:
        vulnerability += min(15.0, 5.0 * len(comorbidities))
    if severe:
        vulnerability += 15.0
    base = TIER_BASE.get(tier, TIER_BASE["low"])
    return round(base + (risk_score * 100.0) + ageing + vulnerability, 2)


def ticket_priority(ticket: Any, now: Optional[datetime] = None) -> float:
    flags = (ticket.xai or {}).get("flags", []) if getattr(ticket, "xai", None) else []
    return compute_priority(
        ticket.tier,
        float(ticket.risk_score or 0),
        ticket.created_at,
        age=ticket.age,
        pregnant=ticket.pregnant,
        comorbidities=ticket.comorbidities or [],
        severe="severe_symptom" in flags,
        now=now,
    )


def sort_waiting(tickets: Sequence[Any], now: Optional[datetime] = None) -> List[Any]:
    now_dt = _as_utc(now)
    return sorted(
        tickets,
        key=lambda t: (-ticket_priority(t, now_dt), t.created_at, t.token),
    )


def pick_next(waiting: Sequence[Any], counter_mode: str, now: Optional[datetime] = None) -> Optional[Any]:
    ranked = sort_waiting(waiting, now)
    if counter_mode == "high":
        for ticket in ranked:
            if ticket.tier == "high":
                return ticket
        return None
    return ranked[0] if ranked else None


def preemption_candidate(
    waiting: Sequence[Any], now: Optional[datetime] = None, min_wait_seconds: int = PREEMPT_AFTER_SECONDS
) -> Optional[Any]:
    now_dt = _as_utc(now)
    high_risk = []
    for ticket in waiting:
        if ticket.tier != "high":
            continue
        waited = (now_dt - _as_utc(ticket.created_at)).total_seconds()
        if waited >= min_wait_seconds:
            high_risk.append(ticket)
    if not high_risk:
        return None
    return sort_waiting(high_risk, now_dt)[0]


def queue_position(
    ticket: Any,
    waiting: Sequence[Any],
    serving_count: int,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    if ticket.status != "waiting":
        return {
            "position": 0,
            "people_ahead": 0,
            "estimated_wait_minutes": 0,
            "tier_queue_length": 0,
        }

    ranked = sort_waiting(waiting, now)
    ids = [t.id for t in ranked]
    try:
        index = ids.index(ticket.id)
    except ValueError:
        index = 0

    same_tier = [t for t in ranked if t.tier == ticket.tier]
    same_ids = [t.id for t in same_tier]
    same_index = same_ids.index(ticket.id) if ticket.id in same_ids else 0
    ahead = same_index if ticket.tier == "high" else index

    if ticket.tier == "high":
        capacity = 1
        consult_minutes = 3.0
        base_wait = 1.5
    else:
        capacity = 2
        consult_minutes = 4.5
        base_wait = 3.0

    cycles = ceil((ahead + 1) / max(1, capacity))
    eta = int(base_wait + cycles * consult_minutes)
    if serving_count == 0:
        eta = min(eta, 4)
    return {
        "position": same_index + 1 if ticket.tier == "high" else index + 1,
        "people_ahead": ahead,
        "estimated_wait_minutes": max(2, min(eta, 90)),
        "tier_queue_length": len(same_tier),
    }


def therapeutic_window(recency_hours: float) -> Dict[str, Any]:
    try:
        recency = max(0.0, float(recency_hours))
    except (TypeError, ValueError):
        recency = 24.0
    left = max(0.0, 72.0 - recency)
    if left > 0:
        note = (
            "Doxycycline prophylaxis is most useful within 72 hours of exposure. "
            "A clinician will confirm whether it is appropriate for you."
        )
        status = "within"
    else:
        note = (
            "You are outside the 72-hour prophylaxis window. A clinician should still "
            "assess symptoms and treatment needs."
        )
        status = "outside"
    return {
        "hours_left": round(left, 1),
        "window_hours": 72,
        "status": status,
        "note": note,
    }


def engine_contract() -> Dict[str, Any]:
    return {
        "model_version": MODEL_VERSION,
        "thresholds": TIER_THRESHOLDS,
        "tier_labels": TIER_LABELS,
        "queue_formula": QUEUE_FORMULA,
        "counter_rules": COUNTER_RULES,
        "preempt_after_seconds": PREEMPT_AFTER_SECONDS,
        "disclaimer": DISCLAIMER,
        "exposure_options": [
            {"key": key, **{k: v for k, v in value.items() if k != "base"}, "base": value["base"]}
            for key, value in EXPOSURE_TYPES.items()
        ],
        "symptom_options": [
            {"key": key, **value} for key, value in SYMPTOMS.items()
        ],
        "comorbidity_options": [
            {"key": key, **value} for key, value in COMORBIDITIES.items()
        ],
    }
