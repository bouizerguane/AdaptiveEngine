import argparse
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


OUTPUT_DIR = Path(__file__).resolve().parent
DEFAULT_SEED = 42
DEFAULT_ROWS = 260

COURSES = [
    ("ae-runtime-course-algo", "Algorithmique"),
    ("ae-runtime-course-c", "Programmation C"),
    ("ae-runtime-course-structures", "Structures de donnees"),
]

CONCEPTS = [
    ("ae-runtime-concept-variables", "Variables"),
    ("ae-runtime-concept-types", "Types de donnees"),
    ("ae-runtime-concept-conditions", "Conditions"),
    ("ae-runtime-concept-boucles", "Boucles"),
    ("ae-runtime-concept-fonctions", "Fonctions"),
    ("ae-runtime-concept-tableaux", "Tableaux"),
    ("ae-runtime-concept-pointeurs", "Pointeurs"),
    ("ae-runtime-concept-listes", "Listes chainees"),
]

PROFILE_CONFIGS = {
    "HIGH_PERFORMER": {
        "count_ratio": 0.22,
        "success_probability": 0.88,
        "mastery": (82, 98),
        "assessment": (80, 98),
        "engagement": (0.72, 1.0),
        "gaps": (0, 1),
        "failures": (0, 1),
        "profileType": "HIGH_PERFORMING",
        "context": ["LEARN", "VALIDATION"],
    },
    "AVERAGE_LEARNER": {
        "count_ratio": 0.28,
        "success_probability": 0.56,
        "mastery": (50, 78),
        "assessment": (55, 78),
        "engagement": (0.45, 0.78),
        "gaps": (0, 2),
        "failures": (0, 2),
        "profileType": "PROGRESSING",
        "context": ["LEARN", "REMEDIATION"],
    },
    "STRUGGLING_LEARNER": {
        "count_ratio": 0.20,
        "success_probability": 0.23,
        "mastery": (18, 52),
        "assessment": (20, 58),
        "engagement": (0.18, 0.52),
        "gaps": (2, 5),
        "failures": (3, 6),
        "profileType": "NEEDS_REMEDIATION",
        "context": ["REMEDIATION"],
    },
    "REMEDIATION_SUCCESS": {
        "count_ratio": 0.16,
        "success_probability": 0.78,
        "mastery": (58, 84),
        "assessment": (65, 88),
        "engagement": (0.55, 0.86),
        "gaps": (0, 2),
        "failures": (3, 6),
        "profileType": "PROGRESSING",
        "context": ["REMEDIATION"],
    },
    "REMEDIATION_FAILURE": {
        "count_ratio": 0.14,
        "success_probability": 0.18,
        "mastery": (20, 55),
        "assessment": (20, 58),
        "engagement": (0.18, 0.56),
        "gaps": (2, 5),
        "failures": (3, 7),
        "profileType": "NEEDS_REMEDIATION",
        "context": ["REMEDIATION"],
    },
}


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a synthetic ML-ready RecommendationTrace dataset.")
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--unknown-ratio", type=float, default=0.04)
    return parser.parse_args()


def bounded(value, low, high):
    return max(low, min(high, value))


def rand_range(rng, bounds, digits=2):
    return round(rng.uniform(bounds[0], bounds[1]), digits)


def weighted_counts(total_rows, unknown_count):
    labelled_rows = total_rows - unknown_count
    names = list(PROFILE_CONFIGS.keys())
    counts = {name: int(round(labelled_rows * PROFILE_CONFIGS[name]["count_ratio"])) for name in names}
    delta = labelled_rows - sum(counts.values())
    counts[names[0]] += delta
    return counts


def make_row(idx, profile_name, rng, unknown=False):
    config = PROFILE_CONFIGS[profile_name]
    course_id, course_title = rng.choice(COURSES)
    concept_id, concept_name = rng.choice(CONCEPTS)

    mastery = rand_range(rng, config["mastery"])
    average_score = rand_range(rng, config["assessment"])
    engagement = rand_range(rng, config["engagement"])
    gaps = rng.randint(*config["gaps"])
    repeated_failures = rng.randint(*config["failures"])
    recommendation_context = rng.choice(config["context"])

    remediation_profile = profile_name in {"STRUGGLING_LEARNER", "REMEDIATION_SUCCESS", "REMEDIATION_FAILURE"} or recommendation_context == "REMEDIATION"
    remediation_triggered = remediation_profile
    persistent_difficulty = profile_name in {"STRUGGLING_LEARNER", "REMEDIATION_FAILURE"} and repeated_failures >= 3
    remediation_success = True if profile_name == "REMEDIATION_SUCCESS" else False if profile_name == "REMEDIATION_FAILURE" else None
    high_mastery = profile_name == "HIGH_PERFORMER" and gaps == 0

    if unknown:
        completed = None
    else:
        completed = rng.random() < config["success_probability"]

    prerequisite_score = 1.0 if gaps == 0 else 0.0 if gaps >= 3 else 0.5
    diagnostic_weakness = 1.0 if remediation_triggered and gaps >= 2 else 0.7 if gaps == 1 else 0.3
    historical_performance = 1.0 if average_score >= 80 else 0.7 if average_score >= 60 else 0.4
    pedagogical_order = rand_range(rng, (0.2, 0.95))
    adaptive_score = round(
        0.35 * prerequisite_score
        + 0.25 * diagnostic_weakness
        + 0.15 * historical_performance
        + 0.15 * pedagogical_order
        + 0.10 * engagement,
        3,
    )

    traces_count = rng.randint(6, 26) if profile_name != "STRUGGLING_LEARNER" else rng.randint(1, 10)
    completed_labs = rng.randint(3, 12) if profile_name == "HIGH_PERFORMER" else rng.randint(0, 7)
    ready = rng.randint(2, 7) if gaps <= 1 else rng.randint(0, 3)
    locked = rng.randint(0, 2) if gaps == 0 else rng.randint(2, 7)
    completed_count = rng.randint(4, 12) if mastery >= 75 else rng.randint(0, 6)
    recommended_path_size = ready + locked + completed_count + max(gaps, 1)

    if completed is True:
        last_score = bounded(average_score + rng.uniform(-5, 8), 60, 100)
    elif completed is False:
        last_score = bounded(average_score + rng.uniform(-18, 4), 0, 62)
    else:
        last_score = None if rng.random() < 0.6 else bounded(average_score + rng.uniform(-10, 10), 0, 100)

    quiz_after = None
    if completed is not None and rng.random() < 0.72:
        quiz_after = round(last_score, 2)

    lab_submitted = None if unknown else bool(rng.random() < (0.82 if completed else 0.45))

    next_action = "REMEDIATION" if remediation_triggered and not (completed and profile_name == "REMEDIATION_SUCCESS") else "LEARN"
    if recommendation_context == "VALIDATION":
        next_action = "COMPLETED" if completed else "LEARN"

    created_at = datetime(2026, 5, 1, 9, 0, 0) + timedelta(minutes=idx * 17)
    outcome_at = created_at + timedelta(hours=rng.randint(1, 72)) if completed is not None else None

    return {
        "id": idx,
        "learnerEmail": f"synthetic.{profile_name.lower()}.{idx}@test.local",
        "courseId": course_id,
        "courseTitle": course_title,
        "conceptId": concept_id,
        "masteryScore": round(mastery, 2),
        "learningTime": rng.randint(20, 420),
        "tracesCount": traces_count,
        "completedLabsCount": completed_labs,
        "averageAssessmentScore": round(average_score, 2),
        "knowledgeGapsCount": gaps,
        "profileType": config["profileType"],
        "pedagogicalStrategy": "RECOVERY" if remediation_triggered else "ADVANCED" if high_mastery else "STANDARD",
        "recommendationContext": recommendation_context,
        "lastActivityType": rng.choice(["DIAGNOSTIC", "QUIZ", "LAB", "REMEDIATION", "VALIDATION"]),
        "lastActivityScore": None if last_score is None else round(last_score, 2),
        "repeatedFailuresCount": repeated_failures,
        "persistentDifficulty": persistent_difficulty,
        "remediationSuccess": remediation_success,
        "highMasteryProgression": high_mastery,
        "readyConceptsCount": ready,
        "lockedConceptsCount": locked,
        "completedConceptsCount": completed_count,
        "recommendedPathSize": recommended_path_size,
        "prerequisiteScore": prerequisite_score,
        "diagnosticWeaknessScore": diagnostic_weakness,
        "historicalPerformanceScore": historical_performance,
        "pedagogicalOrderScore": pedagogical_order,
        "engagementScore": engagement,
        "adaptiveScore": adaptive_score,
        "recommendedConcept": concept_name,
        "nextAction": next_action,
        "remediationTriggered": remediation_triggered,
        "recommendationReason": f"Synthetic recommendation for {concept_name} based on {profile_name}.",
        "conceptCompleted": completed,
        "conceptCompletedAfterRecommendation": completed,
        "quizScoreAfterRecommendation": quiz_after,
        "labSubmittedAfterRecommendation": lab_submitted,
        "remediationSucceeded": remediation_success if remediation_triggered and completed is not None else None,
        "learnerDropped": False if completed is not None else None,
        "recommendationAccepted": None if unknown else bool(rng.random() < (0.86 if completed else 0.62)),
        "outcomeCapturedAt": outcome_at.isoformat() if outcome_at else None,
        "createdAt": created_at.isoformat(),
        "syntheticProfile": profile_name,
        "syntheticDatasetNote": "synthetic experimental dataset generated from AdaptiveEngine feature schema",
    }


def generate(rows, seed, unknown_ratio):
    rng = random.Random(seed)
    unknown_count = int(round(rows * unknown_ratio))
    counts = weighted_counts(rows, unknown_count)
    dataset = []
    idx = 1
    for profile_name, count in counts.items():
        for _ in range(count):
            dataset.append(make_row(idx, profile_name, rng, unknown=False))
            idx += 1
    for _ in range(unknown_count):
        profile_name = rng.choice(list(PROFILE_CONFIGS.keys()))
        dataset.append(make_row(idx, profile_name, rng, unknown=True))
        idx += 1
    rng.shuffle(dataset)
    for idx, row in enumerate(dataset, start=1):
        row["id"] = idx
    return dataset


def summarize(dataset, seed):
    df = pd.DataFrame(dataset)
    target = df["conceptCompletedAfterRecommendation"]
    profile_distribution = df["syntheticProfile"].value_counts(dropna=False).to_dict()
    target_distribution = target.value_counts(dropna=False).to_dict()
    target_distribution = {str(key): int(value) for key, value in target_distribution.items()}
    profile_distribution = {str(key): int(value) for key, value in profile_distribution.items()}
    return {
        "seed": seed,
        "rows": int(len(df)),
        "description": "synthetic experimental dataset generated from AdaptiveEngine feature schema",
        "targetDistribution": target_distribution,
        "profileDistribution": profile_distribution,
        "notes": [
            "Synthetic data follows AdaptiveEngine feature semantics but does not represent real learners.",
            "Unknown outcomes remain null and are not converted to false.",
            "The dataset is intended for offline pipeline validation only.",
        ],
    }


def main():
    args = parse_args()
    dataset = generate(args.rows, args.seed, args.unknown_ratio)
    df = pd.DataFrame(dataset)

    json_path = OUTPUT_DIR / "synthetic-recommendation-traces.json"
    csv_path = OUTPUT_DIR / "synthetic-recommendation-traces.csv"
    summary_path = OUTPUT_DIR / "synthetic-dataset-summary.json"

    json_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    df.to_csv(csv_path, index=False, encoding="utf-8")
    summary = summarize(dataset, args.seed)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
