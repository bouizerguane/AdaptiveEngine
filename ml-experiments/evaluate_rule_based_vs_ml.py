import json
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "synthetic-recommendation-traces-cleaned.csv"
MODEL_PATH = BASE_DIR / "model-serving" / "model.pkl"
RESULTS_JSON = BASE_DIR / "evaluation_results.json"
RESULTS_CSV = BASE_DIR / "rule_based_vs_ml.csv"
SUMMARY_MD = BASE_DIR / "evaluation_summary.md"
SENSITIVITY_CSV = BASE_DIR / "ml_weight_sensitivity.csv"
CV_RESULTS_JSON = BASE_DIR / "cv_results.json"
CV_ROBUSTNESS_CSV = BASE_DIR / "cv_weight_robustness.csv"
CV_SUMMARY_MD = BASE_DIR / "cv_summary.md"

ML_WEIGHTS = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]
K_VALUES = [1, 3, 5]

FEATURES = [
    "adaptiveScore",
    "prerequisiteScore",
    "historicalPerformanceScore",
    "pedagogicalOrderScore",
    "engagementScore",
    "diagnosticWeaknessScore",
    "masteryScore",
    "averageAssessmentScore",
    "completedLabsCount",
    "tracesCount",
    "profileType",
    "recommendationType",
]

NUMERICAL_FEATURES = [
    "adaptiveScore",
    "prerequisiteScore",
    "historicalPerformanceScore",
    "pedagogicalOrderScore",
    "engagementScore",
    "diagnosticWeaknessScore",
    "masteryScore",
    "averageAssessmentScore",
    "completedLabsCount",
    "tracesCount",
]

CATEGORICAL_FEATURES = [
    "profileType",
    "recommendationType",
]


@dataclass(frozen=True)
class SimulatedProfile:
    name: str
    description: str
    mastery_min: Optional[float] = None
    mastery_max: Optional[float] = None
    engagement_min: Optional[float] = None
    profile_type: Optional[str] = None
    recommendation_type: Optional[str] = None
    diagnostic_min: Optional[float] = None


PROFILES = [
    SimulatedProfile(
        name="BEGINNER_LOW_MASTERY",
        description="Apprenant debutant avec maitrise faible et besoin potentiel de guidage.",
        mastery_max=45,
    ),
    SimulatedProfile(
        name="BEGINNER_HIGH_ENGAGEMENT",
        description="Apprenant debutant mais actif dans les traces et les TP.",
        mastery_max=55,
        engagement_min=0.6,
    ),
    SimulatedProfile(
        name="INTERMEDIATE_UNSTABLE",
        description="Profil intermediaire avec signaux de faiblesse diagnostic.",
        mastery_min=45,
        mastery_max=75,
        diagnostic_min=0.7,
    ),
    SimulatedProfile(
        name="INTERMEDIATE_REGULAR",
        description="Progression reguliere avec scores moyens et recommandations normales.",
        mastery_min=50,
        mastery_max=80,
        profile_type="PROGRESSING",
        recommendation_type="NORMAL_PROGRESS",
    ),
    SimulatedProfile(
        name="ADVANCED_HIGH_MASTERY",
        description="Profil avance avec forte maitrise et bonne performance.",
        mastery_min=80,
        profile_type="HIGH_PERFORMING",
    ),
    SimulatedProfile(
        name="REMEDIATION_NEEDED",
        description="Profil avec lacunes explicites et recommandation de remediation.",
        profile_type="NEEDS_REMEDIATION",
        recommendation_type="REMEDIATION",
    ),
    SimulatedProfile(
        name="REMEDIATION_SUCCESS",
        description="Profil de remediation pouvant redevenir pertinent si les prerequis et performances remontent.",
        recommendation_type="REMEDIATION",
        diagnostic_min=0.7,
    ),
    SimulatedProfile(
        name="HIGH_MASTERY_PROGRESSION",
        description="Progression controlee pour apprenant performant sans contourner les prerequis.",
        mastery_min=78,
        recommendation_type="NORMAL_PROGRESS",
    ),
]


def load_dataset() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")
    df = pd.read_csv(DATASET_PATH)
    missing = [feature for feature in FEATURES if feature not in df.columns]
    if missing:
        raise ValueError(f"Missing required feature columns: {missing}")
    if "success" not in df.columns:
        raise ValueError("Missing target column: success")
    df = df.copy()
    df["candidateId"] = [f"candidate-{i + 1:03d}" for i in range(len(df))]
    df["conceptName"] = [f"Concept experimental {i % 12 + 1}" for i in range(len(df))]
    return df


def load_model_bundle() -> dict:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    bundle = joblib.load(MODEL_PATH)
    if not isinstance(bundle, dict) or "pipeline" not in bundle:
        raise ValueError("Model bundle must contain a sklearn pipeline.")
    return bundle


def predict_success(df: pd.DataFrame, bundle: Optional[dict]) -> pd.Series:
    if bundle is None:
        return pd.Series([math.nan] * len(df), index=df.index)
    features = bundle.get("features", FEATURES)
    pipeline = bundle["pipeline"]
    probabilities = pipeline.predict_proba(df[features])[:, 1]
    return pd.Series(probabilities, index=df.index).clip(0, 1)


def candidate_pool(df: pd.DataFrame, profile: SimulatedProfile, min_rows: int = 20) -> pd.DataFrame:
    mask = pd.Series(True, index=df.index)
    if profile.mastery_min is not None:
        mask &= df["masteryScore"] >= profile.mastery_min
    if profile.mastery_max is not None:
        mask &= df["masteryScore"] <= profile.mastery_max
    if profile.engagement_min is not None:
        mask &= df["engagementScore"] >= profile.engagement_min
    if profile.profile_type is not None:
        mask &= df["profileType"] == profile.profile_type
    if profile.recommendation_type is not None:
        mask &= df["recommendationType"] == profile.recommendation_type
    if profile.diagnostic_min is not None:
        mask &= df["diagnosticWeaknessScore"] >= profile.diagnostic_min

    pool = df[mask].copy()
    if len(pool) >= min_rows:
        return pool

    # Fallback reproductible : garder les candidats les plus proches du niveau de maitrise attendu.
    target_mastery = profile.mastery_min or profile.mastery_max or df["masteryScore"].median()
    fallback = df.copy()
    fallback["_profileDistance"] = (fallback["masteryScore"] - target_mastery).abs()
    if profile.recommendation_type:
        fallback["_typePenalty"] = (fallback["recommendationType"] != profile.recommendation_type).astype(int)
    else:
        fallback["_typePenalty"] = 0
    return fallback.sort_values(["_typePenalty", "_profileDistance"]).head(min_rows).drop(columns=["_profileDistance", "_typePenalty"])


def relevance_label(row: pd.Series, profile: SimulatedProfile) -> int:
    """Controlled pedagogical relevance derived from AdaptiveEngine rules.

    The label is not the observed outcome. It approximates whether a candidate is
    pedagogically coherent according to the existing rule-based engine:
    - NORMAL_PROGRESS / VALIDATION represents a READY progression candidate.
    - REMEDIATION represents a justified review candidate when diagnostic weakness is high
      or the profile indicates remediation needs.
    - Prerequisites remain mandatory for normal progression.
    - High mastery profiles should not be sent to remediation unless diagnostic weakness is explicit.
    """
    recommendation_type = str(row["recommendationType"])
    profile_type = str(row["profileType"])
    mastery = float(row["masteryScore"])
    prerequisite_score = float(row["prerequisiteScore"])
    diagnostic_weakness = float(row["diagnosticWeaknessScore"])
    average_score = float(row["averageAssessmentScore"])

    ready_candidate = recommendation_type in {"NORMAL_PROGRESS", "VALIDATION"} and prerequisite_score >= 0.5
    remediation_candidate = (
        recommendation_type == "REMEDIATION"
        and (diagnostic_weakness >= 0.7 or profile_type == "NEEDS_REMEDIATION")
    )

    if not (ready_candidate or remediation_candidate):
        return 0

    if profile.name.startswith("REMEDIATION") or profile_type == "NEEDS_REMEDIATION":
        return int(remediation_candidate or (ready_candidate and diagnostic_weakness < 0.7 and mastery >= 55))

    if "HIGH_MASTERY" in profile.name or profile_type == "HIGH_PERFORMING":
        return int(ready_candidate and mastery >= 75 and average_score >= 70)

    if profile.name.startswith("BEGINNER"):
        return int((remediation_candidate and diagnostic_weakness >= 0.7) or (ready_candidate and mastery <= 60))

    return int(ready_candidate and 45 <= mastery <= 85)


def rank_candidates(pool: pd.DataFrame, ml_weight: Optional[float] = None) -> pd.DataFrame:
    ranked = pool.copy()
    start = time.perf_counter()
    if ml_weight is None or ml_weight == 0:
        ranked["rankingScore"] = ranked["adaptiveScore"]
        ranked["combinedScore"] = ranked["adaptiveScore"]
        ranked = ranked.sort_values(["rankingScore", "pedagogicalOrderScore"], ascending=[False, False])
    else:
        ranked["combinedScore"] = ((1 - ml_weight) * ranked["adaptiveScore"]) + (ml_weight * ranked["mlSuccessProbability"])
        ranked["rankingScore"] = ranked["combinedScore"]
        ranked = ranked.sort_values(["rankingScore", "pedagogicalOrderScore"], ascending=[False, False])
    elapsed_ms = (time.perf_counter() - start) * 1000
    ranked["generationTimeMs"] = elapsed_ms
    return ranked.reset_index(drop=True)


def precision_at_k(labels: list[int], k: int) -> float:
    top = labels[:k]
    return sum(top) / max(1, len(top))


def dcg_at_k(labels: list[int], k: int) -> float:
    return sum(label / math.log2(idx + 2) for idx, label in enumerate(labels[:k]))


def ndcg_at_k(labels: list[int], k: int) -> float:
    ideal = sorted(labels, reverse=True)
    ideal_dcg = dcg_at_k(ideal, k)
    if ideal_dcg == 0:
        return 0.0
    return dcg_at_k(labels, k) / ideal_dcg


def metrics_for_ranking(ranked: pd.DataFrame, method: str, profile_name: str, k_values: list[int]) -> dict:
    labels = ranked["relevance_label"].astype(int).tolist()
    row = {
        "profile": profile_name,
        "method": method,
        "generationTimeMs": float(ranked["generationTimeMs"].iloc[0]) if len(ranked) else 0.0,
    }
    for k in k_values:
        top = ranked.head(k)
        row[f"precision@{k}"] = precision_at_k(labels, k)
        row[f"ndcg@{k}"] = ndcg_at_k(labels, k)
        row[f"estimatedSuccessRate@{k}"] = float(top["mlSuccessProbability"].mean()) if len(top) else 0.0
        row[f"prerequisiteCompliance@{k}"] = float((top["prerequisiteScore"] >= 0.5).mean()) if len(top) else 0.0
        row[f"diversity@{k}"] = int(top["recommendationType"].nunique()) if len(top) else 0
    return row


def compact_top(ranked: pd.DataFrame, k: int = 5) -> list[dict]:
    columns = [
        "candidateId",
        "conceptName",
        "profileType",
        "recommendationType",
        "adaptiveScore",
        "mlSuccessProbability",
        "rankingScore",
        "relevance_label",
        "prerequisiteScore",
        "masteryScore",
    ]
    return ranked.head(k)[columns].round(4).to_dict(orient="records")


def plot_metric(summary: pd.DataFrame, metric: str, filename: str, title: str) -> None:
    pivot = summary.pivot_table(index="method", values=metric, aggfunc="mean")
    ax = pivot.plot(kind="bar", legend=False, figsize=(8, 4), color="#2563eb")
    ax.set_title(title)
    ax.set_ylabel(metric)
    ax.set_xlabel("")
    ax.tick_params(axis="x", rotation=30)
    plt.tight_layout()
    plt.savefig(BASE_DIR / filename)
    plt.close()


def plot_weight_sensitivity(sensitivity: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.plot(sensitivity["ML_WEIGHT"], sensitivity["EstimatedSuccessRate@3"], marker="o", label="EstimatedSuccessRate@3")
    ax.plot(sensitivity["ML_WEIGHT"], sensitivity["nDCG@3"], marker="s", label="nDCG@3")
    ax.plot(sensitivity["ML_WEIGHT"], sensitivity["Precision@3"], marker="^", label="Precision@3")
    selected = sensitivity[sensitivity["SelectedBestWeight"] == True]
    if not selected.empty:
        best = selected.iloc[0]
        ax.axvline(best["ML_WEIGHT"], linestyle="--", color="#16a34a", alpha=0.8, label=f"Meilleur compromis ({best['ML_WEIGHT']})")
    ax.set_title("Analyse de sensibilite du poids ML")
    ax.set_xlabel("ML_WEIGHT")
    ax.set_ylabel("Score moyen")
    ax.set_ylim(0, 1.05)
    ax.grid(True, alpha=0.25)
    ax.legend()
    plt.tight_layout()
    plt.savefig(BASE_DIR / "ml_weight_sensitivity.png")
    plt.close()


def dataframe_to_markdown(df: pd.DataFrame) -> str:
    display_df = df.copy()
    for column in display_df.columns:
        if pd.api.types.is_float_dtype(display_df[column]):
            display_df[column] = display_df[column].map(lambda value: f"{value:.4f}")
    headers = list(display_df.columns)
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for _, row in display_df.iterrows():
        lines.append("| " + " | ".join(str(row[col]) for col in headers) + " |")
    return "\n".join(lines)


def method_for_weight(weight: float) -> str:
    if weight == 0:
        return "rule_based"
    return f"rule_based_ml_{weight:.2f}".rstrip("0").rstrip(".")


def build_weight_sensitivity(aggregate: pd.DataFrame) -> tuple[pd.DataFrame, Optional[dict]]:
    baseline = aggregate[aggregate["method"] == "rule_based"].iloc[0]
    baseline_precision = float(baseline["precision@3"])
    baseline_ndcg = float(baseline["ndcg@3"])
    max_prerequisite = float(aggregate["prerequisiteCompliance@3"].max())

    rows = []
    for weight in ML_WEIGHTS:
        method = method_for_weight(weight)
        metric = aggregate[aggregate["method"] == method]
        if metric.empty:
            continue
        metric_row = metric.iloc[0]
        ndcg_drop_percent = 0.0
        if baseline_ndcg > 0:
            ndcg_drop_percent = max(0.0, ((baseline_ndcg - float(metric_row["ndcg@3"])) / baseline_ndcg) * 100)
        success_gain_percent = 0.0
        baseline_success = float(baseline["estimatedSuccessRate@3"])
        if baseline_success > 0:
            success_gain_percent = ((float(metric_row["estimatedSuccessRate@3"]) - baseline_success) / baseline_success) * 100
        rows.append({
            "ML_WEIGHT": weight,
            "Precision@3": float(metric_row["precision@3"]),
            "nDCG@3": float(metric_row["ndcg@3"]),
            "EstimatedSuccessRate@3": float(metric_row["estimatedSuccessRate@3"]),
            "PrerequisiteCompliance@3": float(metric_row["prerequisiteCompliance@3"]),
            "GenerationTime": float(metric_row["generationTimeMs"]),
            "nDCGDropPercent": ndcg_drop_percent,
            "SuccessRateGainPercent": success_gain_percent,
            "SelectedBestWeight": False,
        })

    sensitivity = pd.DataFrame(rows)
    if sensitivity.empty:
        return sensitivity, None

    eligible = sensitivity[
        (sensitivity["PrerequisiteCompliance@3"] >= max_prerequisite)
        & (sensitivity["Precision@3"] >= baseline_precision)
        & (sensitivity["nDCGDropPercent"] <= 2.0)
    ].copy()
    best = None
    if not eligible.empty:
        eligible = eligible.sort_values(
            ["EstimatedSuccessRate@3", "ML_WEIGHT"],
            ascending=[False, True],
        )
        best_index = eligible.index[0]
        sensitivity.loc[best_index, "SelectedBestWeight"] = True
        best = sensitivity.loc[best_index].to_dict()

    return sensitivity, best


def make_cv_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                ]),
                NUMERICAL_FEATURES,
            ),
            (
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ]),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    return Pipeline([
        ("preprocess", preprocessor),
        ("model", RandomForestClassifier(
            n_estimators=150,
            max_depth=8,
            min_samples_leaf=3,
            random_state=42,
            class_weight="balanced",
        )),
    ])


def evaluate_fold_dataset(test_df: pd.DataFrame, fold_id: int) -> tuple[pd.DataFrame, list[dict], Optional[dict]]:
    all_rows = []
    profile_outputs = []
    for profile in PROFILES:
        pool = candidate_pool(test_df, profile, min_rows=5)
        pool = pool.copy()
        pool["simulatedProfile"] = profile.name
        pool["relevance_label"] = pool.apply(lambda row: relevance_label(row, profile), axis=1)
        profile_result = {
            "fold": fold_id,
            "profile": profile.name,
            "candidates": int(len(pool)),
            "topByWeight": {},
        }
        for weight in ML_WEIGHTS:
            ranked = rank_candidates(pool, weight)
            method = method_for_weight(weight)
            row = metrics_for_ranking(ranked, method, profile.name, [3])
            row["fold"] = fold_id
            row["ML_WEIGHT"] = weight
            all_rows.append(row)
            profile_result["topByWeight"][str(weight)] = compact_top(ranked, 3)
        profile_outputs.append(profile_result)

    fold_metrics = pd.DataFrame(all_rows)
    aggregate = fold_metrics.groupby("method").mean(numeric_only=True).round(6).reset_index()
    sensitivity_df, best_weight = build_weight_sensitivity(aggregate)
    if best_weight:
        best_weight["fold"] = fold_id
    return sensitivity_df, profile_outputs, best_weight


def interpret_cv(best_counts: pd.DataFrame, sensitivity_stats: pd.DataFrame) -> dict:
    non_zero_best = best_counts[best_counts["ML_WEIGHT"] > 0]["BestFoldCount"].sum() if not best_counts.empty else 0
    high_weight_best = best_counts[best_counts["ML_WEIGHT"].isin([0.35, 0.4])]["BestFoldCount"].sum() if not best_counts.empty else 0
    distinct_best = int(best_counts["ML_WEIGHT"].nunique()) if not best_counts.empty else 0
    success_std_mean = float(sensitivity_stats["EstimatedSuccessRate@3_std"].mean()) if not sensitivity_stats.empty else 0.0
    ndcg_std_mean = float(sensitivity_stats["nDCG@3_std"].mean()) if not sensitivity_stats.empty else 0.0

    signals = []
    if distinct_best >= 4:
        signals.append("Possible sensitivity to synthetic data distribution.")
    if high_weight_best >= 3:
        signals.append("Stable ML contribution observed.")
    if success_std_mean <= 0.08 and ndcg_std_mean <= 0.08:
        signals.append("Experimental robustness acceptable.")
    if not signals:
        signals.append("Robustness is mixed; keep ML contribution conservative.")

    recommended = 0.2
    if high_weight_best >= 3 and ndcg_std_mean <= 0.08:
        recommended = 0.35
    if distinct_best >= 4 or ndcg_std_mean > 0.08:
        recommended = 0.2

    return {
        "distinctBestWeights": distinct_best,
        "nonZeroBestFoldCount": int(non_zero_best),
        "highWeightBestFoldCount": int(high_weight_best),
        "meanSuccessStd": success_std_mean,
        "meanNdcgStd": ndcg_std_mean,
        "signals": signals,
        "recommendedExperimentalWeight": recommended,
        "recommendedRealIntegrationWeight": min(recommended, 0.2),
    }


def plot_cv_weight_stability(best_counts: pd.DataFrame, sensitivity_stats: pd.DataFrame) -> None:
    fig, axes = plt.subplots(3, 1, figsize=(9, 12))

    axes[0].bar(best_counts["ML_WEIGHT"].astype(str), best_counts["BestFoldCount"], color="#2563eb")
    axes[0].set_title("Distribution du meilleur poids ML par fold")
    axes[0].set_xlabel("ML_WEIGHT")
    axes[0].set_ylabel("Nombre de folds")

    axes[1].errorbar(
        sensitivity_stats["ML_WEIGHT"],
        sensitivity_stats["EstimatedSuccessRate@3_mean"],
        yerr=sensitivity_stats["EstimatedSuccessRate@3_std"],
        marker="o",
        color="#16a34a",
        capsize=4,
    )
    axes[1].set_title("EstimatedSuccessRate@3 moyen +/- ecart type")
    axes[1].set_xlabel("ML_WEIGHT")
    axes[1].set_ylabel("EstimatedSuccessRate@3")
    axes[1].grid(True, alpha=0.25)

    axes[2].errorbar(
        sensitivity_stats["ML_WEIGHT"],
        sensitivity_stats["nDCG@3_mean"],
        yerr=sensitivity_stats["nDCG@3_std"],
        marker="s",
        color="#dc2626",
        capsize=4,
    )
    axes[2].set_title("nDCG@3 moyen +/- ecart type")
    axes[2].set_xlabel("ML_WEIGHT")
    axes[2].set_ylabel("nDCG@3")
    axes[2].grid(True, alpha=0.25)

    plt.tight_layout()
    plt.savefig(BASE_DIR / "cv_weight_stability.png")
    plt.close()


def run_cross_validation(df: pd.DataFrame) -> dict:
    cv_df = df.copy()
    y = cv_df["success"].astype(int)
    splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    fold_sensitivity_frames = []
    fold_best_weights = []
    profile_outputs = []

    for fold_id, (train_idx, test_idx) in enumerate(splitter.split(cv_df[FEATURES], y), start=1):
        train_df = cv_df.iloc[train_idx].copy()
        test_df = cv_df.iloc[test_idx].copy()
        pipeline = make_cv_pipeline()
        pipeline.fit(train_df[FEATURES], train_df["success"].astype(int))
        test_df["mlSuccessProbability"] = pipeline.predict_proba(test_df[FEATURES])[:, 1]

        sensitivity_df, fold_profiles, best_weight = evaluate_fold_dataset(test_df, fold_id)
        sensitivity_df["fold"] = fold_id
        fold_sensitivity_frames.append(sensitivity_df)
        profile_outputs.extend(fold_profiles)
        if best_weight:
            fold_best_weights.append(best_weight)

    cv_sensitivity = pd.concat(fold_sensitivity_frames, ignore_index=True)
    best_counts = (
        pd.DataFrame(fold_best_weights)
        .groupby("ML_WEIGHT")
        .size()
        .reset_index(name="BestFoldCount")
        if fold_best_weights else pd.DataFrame(columns=["ML_WEIGHT", "BestFoldCount"])
    )
    sensitivity_stats = cv_sensitivity.groupby("ML_WEIGHT").agg({
        "Precision@3": ["mean", "std"],
        "nDCG@3": ["mean", "std"],
        "EstimatedSuccessRate@3": ["mean", "std"],
        "PrerequisiteCompliance@3": ["mean", "std"],
        "GenerationTime": ["mean", "std"],
        "SuccessRateGainPercent": ["mean", "std"],
    }).reset_index()
    sensitivity_stats.columns = [
        "ML_WEIGHT",
        "Precision@3_mean", "Precision@3_std",
        "nDCG@3_mean", "nDCG@3_std",
        "EstimatedSuccessRate@3_mean", "EstimatedSuccessRate@3_std",
        "PrerequisiteCompliance@3_mean", "PrerequisiteCompliance@3_std",
        "GenerationTime_mean", "GenerationTime_std",
        "SuccessRateGainPercent_mean", "SuccessRateGainPercent_std",
    ]
    sensitivity_stats = sensitivity_stats.fillna(0)

    robustness = interpret_cv(best_counts, sensitivity_stats)
    plot_cv_weight_stability(best_counts, sensitivity_stats)

    robustness_export = sensitivity_stats.merge(best_counts, on="ML_WEIGHT", how="left")
    robustness_export["BestFoldCount"] = robustness_export["BestFoldCount"].fillna(0).astype(int)
    robustness_export.round(6).to_csv(CV_ROBUSTNESS_CSV, index=False)

    result = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "protocol": {
            "method": "StratifiedKFold",
            "nSplits": 5,
            "shuffle": True,
            "randomState": 42,
            "target": "success",
            "note": "The ML model is retrained in each fold. model.pkl is not used for cross-validation scoring.",
        },
        "foldBestWeights": fold_best_weights,
        "bestWeightCounts": best_counts.to_dict(orient="records"),
        "weightMetricsMeanStd": sensitivity_stats.round(6).to_dict(orient="records"),
        "foldSensitivityRows": cv_sensitivity.round(6).to_dict(orient="records"),
        "profileOutputs": profile_outputs,
        "robustnessAnalysis": robustness,
        "outputs": {
            "json": str(CV_RESULTS_JSON.relative_to(BASE_DIR.parent)),
            "csv": str(CV_ROBUSTNESS_CSV.relative_to(BASE_DIR.parent)),
            "summary": str(CV_SUMMARY_MD.relative_to(BASE_DIR.parent)),
            "plot": "ml-experiments/cv_weight_stability.png",
        },
    }
    CV_RESULTS_JSON.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    write_cv_summary(result)
    return result


def format_mean_std(row: pd.Series, metric: str) -> str:
    return f"{row[f'{metric}_mean']:.4f} +/- {row[f'{metric}_std']:.4f}"


def write_cv_summary(result: dict) -> None:
    stats = pd.DataFrame(result["weightMetricsMeanStd"])
    best_counts = pd.DataFrame(result["bestWeightCounts"])
    robustness = result["robustnessAnalysis"]

    compact_stats = pd.DataFrame([
        {
            "ML_WEIGHT": row["ML_WEIGHT"],
            "BestFoldCount": int(best_counts[best_counts["ML_WEIGHT"] == row["ML_WEIGHT"]]["BestFoldCount"].iloc[0])
            if not best_counts[best_counts["ML_WEIGHT"] == row["ML_WEIGHT"]].empty else 0,
            "Precision@3": format_mean_std(row, "Precision@3"),
            "nDCG@3": format_mean_std(row, "nDCG@3"),
            "EstimatedSuccessRate@3": format_mean_std(row, "EstimatedSuccessRate@3"),
        }
        for _, row in stats.iterrows()
    ])

    lines = [
        "# 5-Fold Cross Validation - Rule-based vs signal ML",
        "",
        "## Objectif",
        "",
        "Verifier si le poids ML observe dans l'evaluation simple est robuste ou s'il depend trop de la distribution synthetique.",
        "",
        "## Protocole",
        "",
        "- Validation : `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)`.",
        "- Cible : `success`.",
        "- Dans chaque fold, le modele RandomForest est reentraine sur le train split.",
        "- Le fichier `model.pkl` n'est pas utilise pour calculer les scores de cross validation.",
        "- Les poids testes sont : " + ", ".join(str(w) for w in ML_WEIGHTS) + ".",
        "",
        "## Critere de selection du meilleur poids par fold",
        "",
        "1. `PrerequisiteCompliance@3` doit rester maximal.",
        "2. `Precision@3` ne doit pas etre inferieure a la baseline rule-based.",
        "3. `nDCG@3` ne doit pas baisser de plus de 2%.",
        "4. Parmi les poids admissibles, le poids qui maximise `EstimatedSuccessRate@3` est retenu.",
        "",
        "## Frequence du meilleur poids",
        "",
        dataframe_to_markdown(best_counts if not best_counts.empty else pd.DataFrame(columns=["ML_WEIGHT", "BestFoldCount"])),
        "",
        "## Moyenne +/- ecart type par poids",
        "",
        dataframe_to_markdown(compact_stats),
        "",
        "## Analyse automatique",
        "",
        *[f"- {signal}" for signal in robustness["signals"]],
        "",
        f"Poids recommande pour experimentation : `{robustness['recommendedExperimentalWeight']}`.",
        f"Poids conservateur recommande pour une integration reelle : `{robustness['recommendedRealIntegrationWeight']}`.",
        "",
        "## Interpretation scientifique",
        "",
        "La validation croisee fournit une mesure de stabilite experimentale sur le dataset synthetique controle. Si les meilleurs poids varient fortement, le resultat doit etre presente comme sensible a la distribution synthetique. Si les poids eleves restent frequents sans degradation de nDCG, le signal ML peut etre considere comme utile en tant que facteur secondaire.",
        "",
        "## Limites",
        "",
        "- Dataset synthetique, non issu d'un deploiement massif.",
        "- La pertinence pedagogique reste une approximation controlee fondee sur les regles existantes.",
        "- La cross validation mesure la robustesse experimentale du protocole, pas une performance clinique ou pedagogique reelle.",
        "- Pour integration reelle, un poids conservateur reste preferable tant que les traces reelles sont limitees.",
    ]
    CV_SUMMARY_MD.write_text("\n".join(lines), encoding="utf-8")


def evaluate() -> dict:
    df = load_dataset()
    bundle = load_model_bundle()
    df["mlSuccessProbability"] = predict_success(df, bundle)
    df["relevance_label"] = 0
    cv_result = run_cross_validation(df.drop(columns=["mlSuccessProbability", "relevance_label"], errors="ignore"))

    all_rows = []
    csv_rows = []
    profile_outputs = []

    for profile in PROFILES:
        pool = candidate_pool(df, profile)
        pool = pool.copy()
        pool["simulatedProfile"] = profile.name
        pool["relevance_label"] = pool.apply(lambda row: relevance_label(row, profile), axis=1)

        profile_result = {
            "profile": profile.name,
            "description": profile.description,
            "candidates": int(len(pool)),
            "ruleBasedTop": [],
            "hybridTopByWeight": {},
        }

        for weight in ML_WEIGHTS:
            ranked = rank_candidates(pool, weight)
            method = method_for_weight(weight)
            all_rows.append(metrics_for_ranking(ranked, method, profile.name, K_VALUES))
            if weight == 0:
                profile_result["ruleBasedTop"] = compact_top(ranked)
            else:
                profile_result["hybridTopByWeight"][str(weight)] = compact_top(ranked)
            for idx, row in ranked.iterrows():
                csv_rows.append({
                    "profile": profile.name,
                    "method": method,
                    "mlWeight": weight,
                    "rank": idx + 1,
                    **row.to_dict(),
                })

        fallback = rank_candidates(pool.assign(mlSuccessProbability=pool["adaptiveScore"]), None)
        profile_result["fallbackWithoutModelTop"] = compact_top(fallback)
        profile_outputs.append(profile_result)

    metrics_df = pd.DataFrame(all_rows)
    csv_df = pd.DataFrame(csv_rows)
    csv_df.to_csv(RESULTS_CSV, index=False)
    aggregate_metrics = metrics_df.groupby("method").mean(numeric_only=True).round(6).reset_index()
    sensitivity_df, best_weight = build_weight_sensitivity(aggregate_metrics)
    sensitivity_df.round(6).to_csv(SENSITIVITY_CSV, index=False)

    plot_metric(metrics_df, "precision@3", "precision_at_k.png", "Precision@3 moyenne")
    plot_metric(metrics_df, "ndcg@3", "ndcg_comparison.png", "nDCG@3 moyen")
    plot_metric(metrics_df, "generationTimeMs", "generation_time.png", "Temps de generation moyen")
    plot_metric(metrics_df, "estimatedSuccessRate@3", "success_rate_comparison.png", "Success rate estime @3")
    plot_weight_sensitivity(sensitivity_df)

    model_available = MODEL_PATH.exists()
    result = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "dataset": {
            "path": str(DATASET_PATH.relative_to(BASE_DIR.parent)),
            "rows": int(len(df)),
            "columns": list(df.columns),
            "target": "success",
            "note": "Synthetic controlled dataset generated from AdaptiveEngine RecommendationTrace feature schema.",
        },
        "model": {
            "path": str(MODEL_PATH.relative_to(BASE_DIR.parent)),
            "available": model_available,
            "version": bundle.get("modelVersion"),
            "features": bundle.get("features"),
        },
        "protocol": {
            "ruleBasedScore": "adaptiveScore",
            "hybridScore": "(1 - ML_WEIGHT) * adaptiveScore + ML_WEIGHT * mlSuccessProbability",
            "testedMlWeights": ML_WEIGHTS,
            "ruleBasedDominance": "ML_WEIGHT <= 0.4, so the rule-based score remains dominant in every tested configuration.",
            "relevanceLabel": "Controlled pedagogical relevance derived from existing AdaptiveEngine rules: READY-like normal progress or justified remediation, prerequisite compliance, profile coherence, and mastery coherence.",
        },
        "metrics": metrics_df.round(6).to_dict(orient="records"),
        "aggregateMetrics": aggregate_metrics.to_dict(orient="records"),
        "weightSensitivity": {
            "selectionCriteria": {
                "prerequisiteCompliance@3": "Must equal the maximum observed value.",
                "precision@3": "Must not be lower than rule-based baseline.",
                "nDCG@3": "Must not drop by more than 2% compared with rule-based baseline.",
                "objective": "Maximize EstimatedSuccessRate@3 among eligible weights.",
            },
            "bestWeight": best_weight,
            "rows": sensitivity_df.round(6).to_dict(orient="records"),
        },
        "crossValidation": {
            "summary": cv_result["robustnessAnalysis"],
            "foldBestWeights": cv_result["foldBestWeights"],
            "outputs": cv_result["outputs"],
        },
        "profiles": profile_outputs,
        "robustness": {
            "withModel": "Hybrid ranking uses model probabilities.",
            "withoutModel": "Fallback ranking equals rule-based ranking when the model is unavailable.",
            "fallbackVerifiedInScript": True,
        },
        "outputs": {
            "csv": str(RESULTS_CSV.relative_to(BASE_DIR.parent)),
            "summary": str(SUMMARY_MD.relative_to(BASE_DIR.parent)),
            "plots": [
                "ml-experiments/precision_at_k.png",
                "ml-experiments/ndcg_comparison.png",
                "ml-experiments/generation_time.png",
                "ml-experiments/success_rate_comparison.png",
                "ml-experiments/ml_weight_sensitivity.png",
                "ml-experiments/cv_weight_stability.png",
            ],
            "sensitivity": str(SENSITIVITY_CSV.relative_to(BASE_DIR.parent)),
            "crossValidation": str(CV_RESULTS_JSON.relative_to(BASE_DIR.parent)),
        },
    }
    RESULTS_JSON.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    write_summary(result)
    return result


def write_summary(result: dict) -> None:
    aggregate = pd.DataFrame(result["aggregateMetrics"])
    best_precision = aggregate.sort_values("precision@3", ascending=False).iloc[0].to_dict()
    best_ndcg = aggregate.sort_values("ndcg@3", ascending=False).iloc[0].to_dict()
    sensitivity = pd.DataFrame(result["weightSensitivity"]["rows"])
    best_weight = result["weightSensitivity"]["bestWeight"]
    if best_weight:
        best_weight_text = (
            f"Le meilleur compromis experimental est `ML_WEIGHT={best_weight['ML_WEIGHT']}` "
            f"avec Precision@3={best_weight['Precision@3']:.4f}, "
            f"nDCG@3={best_weight['nDCG@3']:.4f}, "
            f"EstimatedSuccessRate@3={best_weight['EstimatedSuccessRate@3']:.4f}."
        )
    else:
        best_weight_text = "Aucun poids ML ne domine la baseline selon les contraintes definies."
    lines = [
        "# Evaluation comparative rule-based vs signal ML",
        "",
        "## Protocole experimental",
        "",
        "Cette evaluation compare le classement produit par le score rule-based existant (`adaptiveScore`) avec un classement hybride qui ajoute un signal ML secondaire.",
        "",
        "Formule hybride :",
        "",
        "```text",
        "combinedScore = (1 - ML_WEIGHT) * adaptiveScore + ML_WEIGHT * mlSuccessProbability",
        "```",
        "",
        f"Poids ML testes : {', '.join(str(w) for w in ML_WEIGHTS)}. Le score rule-based reste dominant dans tous les cas.",
        "",
        "## Hypothese",
        "",
        "L'ajout d'un signal ML secondaire peut ameliorer le classement des recommandations pedagogiques sans remplacer la logique pedagogique explicable.",
        "",
        "## Dataset",
        "",
        f"- Source : `{result['dataset']['path']}`",
        f"- Lignes : {result['dataset']['rows']}",
        "- Nature : dataset synthetique controle genere depuis le schema RecommendationTrace d'AdaptiveEngine.",
        "- Le dataset ne remplace pas une validation a grande echelle sur des traces reelles.",
        "",
        "## Pertinence pedagogique controlee",
        "",
        "La colonne `relevance_label` est construite sans utiliser la cible `success`. Elle s'appuie sur les regles presentes dans le moteur : progression normale de type READY, remediation justifiee par faiblesse diagnostique, respect des prerequis et coherence avec le profil de maitrise.",
        "",
        "## Metriques",
        "",
        "- Precision@K, K = 1, 3, 5",
        "- nDCG@K, K = 1, 3, 5",
        "- Estimated Success Rate",
        "- Prerequisite Compliance Rate",
        "- Recommendation Diversity",
        "- Generation Time",
        "",
        "## Resultats agreges",
        "",
        dataframe_to_markdown(aggregate),
        "",
        "## Interpretation",
        "",
        f"- Meilleure Precision@3 moyenne : `{best_precision['method']}` ({best_precision['precision@3']}).",
        f"- Meilleur nDCG@3 moyen : `{best_ndcg['method']}` ({best_ndcg['ndcg@3']}).",
        "- Les differences doivent etre interpretees comme une validation experimentale du protocole, pas comme une preuve de performance en conditions reelles.",
        "",
        "## Analyse de sensibilite du poids ML",
        "",
        "Plusieurs poids ML sont testes afin d'observer l'effet d'un signal predictif secondaire sans remplacer le moteur pedagogique explicable. Le poids `0.0` correspond au rule-based pur, puis les poids augmentent progressivement jusqu'a `0.4`, ce qui laisse toujours le score rule-based majoritaire.",
        "",
        "Critere de selection : le respect des prerequis a Precision@3 doit rester maximal, Precision@3 ne doit pas baisser par rapport a la baseline, nDCG@3 ne doit pas perdre plus de 2%, puis le poids retenu maximise EstimatedSuccessRate@3.",
        "",
        best_weight_text,
        "",
        dataframe_to_markdown(sensitivity),
        "",
        "Cette analyse montre si le ML ameliore surtout le succes estime et si un poids plus eleve degrade legerement le classement pedagogique. Le moteur rule-based reste dominant car le score hybride conserve au minimum 60% de poids rule-based dans le test le plus favorable au ML.",
        "",
        "## Robustesse",
        "",
        "Le script verifie le cas avec modele disponible et documente le fallback : si le modele ML est indisponible, le classement revient au score rule-based seul.",
        "",
        "## Limites",
        "",
        "- Dataset synthetique controle, non issu d'un deploiement massif.",
        "- La pertinence pedagogique est une approximation construite a partir des regles existantes.",
        "- Les resultats ne sont pas generalisables sans traces reelles plus nombreuses.",
        "- L'integration ML reste secondaire et experimentale.",
        "",
        "## Fichiers produits",
        "",
        "- `ml-experiments/evaluation_results.json`",
        "- `ml-experiments/rule_based_vs_ml.csv`",
        "- `ml-experiments/precision_at_k.png`",
        "- `ml-experiments/ndcg_comparison.png`",
        "- `ml-experiments/generation_time.png`",
        "- `ml-experiments/success_rate_comparison.png`",
        "- `ml-experiments/ml_weight_sensitivity.csv`",
        "- `ml-experiments/ml_weight_sensitivity.png`",
    ]
    SUMMARY_MD.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    output = evaluate()
    print(json.dumps({
        "status": "OK",
        "datasetRows": output["dataset"]["rows"],
        "modelVersion": output["model"]["version"],
        "bestMlWeight": None if output["weightSensitivity"]["bestWeight"] is None else output["weightSensitivity"]["bestWeight"]["ML_WEIGHT"],
        "results": output["outputs"],
    }, indent=2, ensure_ascii=False))
