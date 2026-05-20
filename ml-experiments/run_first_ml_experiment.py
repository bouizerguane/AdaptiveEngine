import argparse
import json
import os
import warnings
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request

import numpy as np
import pandas as pd
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = Path(__file__).resolve().parent
MODEL_SERVING_DIR = OUTPUT_DIR / "model-serving"
SERVING_MODEL_PATH = MODEL_SERVING_DIR / "model.pkl"
TARGET = "success"
SOURCE_TARGET = "conceptCompletedAfterRecommendation"

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

EXCLUDED_OUTCOME_FIELDS = [
    "quizScoreAfterRecommendation",
    "conceptCompletedAfterRecommendation",
    "success",
    "remediationSucceeded",
    "outcomeCapturedAt",
    "conceptCompleted",
    "labSubmittedAfterRecommendation",
    "learnerDropped",
    "recommendationAccepted",
    "lastActivityScore",
    "remediationSuccess",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Offline ML experiment for AdaptiveEngine RecommendationTrace.")
    parser.add_argument("--source", choices=["real", "synthetic"], default="real")
    parser.add_argument("--synthetic-path", default=str(OUTPUT_DIR / "synthetic-recommendation-traces.json"))
    parser.add_argument("--report-name", default=None)
    return parser.parse_args()


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def api_json(method: str, url: str, payload=None, token: str = None):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {detail}") from exc


def fetch_real_recommendation_traces():
    load_dotenv(ROOT_DIR / ".env")
    api_base_url = os.environ.get("ADAPTIVE_API_BASE_URL") or os.environ.get("VITE_API_URL") or "http://localhost:8080/api"
    admin_email = os.environ.get("ADAPTIVE_ADMIN_EMAIL", "admin@system.com")
    admin_password = os.environ.get("ADAPTIVE_ADMIN_PASSWORD") or os.environ.get("ADMIN_DEFAULT_PASSWORD", "admin123")

    login = api_json("POST", f"{api_base_url}/auth/login", {"email": admin_email, "password": admin_password})
    traces = api_json("GET", f"{api_base_url}/tracking/recommendation-traces/export", token=login["token"])
    return traces, {
        "source": "real",
        "apiBaseUrl": api_base_url,
        "adminEmail": admin_email,
        "description": "Real RecommendationTrace export from AdaptiveEngine runtime.",
    }


def load_synthetic_recommendation_traces(path: Path):
    if not path.exists():
        raise RuntimeError(f"Synthetic dataset not found: {path}")
    traces = json.loads(path.read_text(encoding="utf-8"))
    return traces, {
        "source": "synthetic",
        "path": str(path.relative_to(ROOT_DIR)) if path.is_relative_to(ROOT_DIR) else str(path),
        "description": "synthetic experimental dataset generated from AdaptiveEngine feature schema",
    }


def load_traces(args):
    if args.source == "synthetic":
        return load_synthetic_recommendation_traces(Path(args.synthetic_path))
    return fetch_real_recommendation_traces()


def to_bool_series(series: pd.Series) -> pd.Series:
    def convert(value):
        if pd.isna(value):
            return np.nan
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)) and value in (0, 1):
            return int(value)
        text = str(value).strip().lower()
        if text in {"true", "1", "yes", "y"}:
            return 1
        if text in {"false", "0", "no", "n"}:
            return 0
        return np.nan

    return series.map(convert)


def normalize_recommendation_type(row) -> str:
    raw = row.get("recommendationType")
    if pd.notna(raw) and str(raw).strip():
        return str(raw).strip()

    raw = row.get("recommendationContext")
    if pd.notna(raw) and str(raw).strip():
        value = str(raw).strip().upper()
        if value == "LEARN":
            return "NORMAL_PROGRESS"
        return value

    raw = row.get("nextAction")
    if pd.notna(raw) and str(raw).strip():
        value = str(raw).strip().upper()
        if value == "LEARN":
            return "NORMAL_PROGRESS"
        if value == "PASS_DIAGNOSTIC":
            return "DIAGNOSTIC"
        if value == "COMPLETED":
            return "VALIDATION"
        return value

    return "UNKNOWN"


def prepare_serving_schema(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    if TARGET not in data.columns:
        if SOURCE_TARGET not in data.columns:
            raise RuntimeError(f"Missing target: {TARGET} or {SOURCE_TARGET}")
        data[TARGET] = data[SOURCE_TARGET]
    data["recommendationType"] = data.apply(normalize_recommendation_type, axis=1)
    return data


def audit_dataset(df: pd.DataFrame) -> dict:
    data = prepare_serving_schema(df)
    target_series = to_bool_series(data[TARGET]) if TARGET in data.columns else pd.Series(dtype=float)
    distribution = target_series.value_counts(dropna=False).to_dict()
    distribution = {str(key): int(value) for key, value in distribution.items()}

    available_features = {
        "numerical": [col for col in NUMERICAL_FEATURES if col in data.columns],
        "categorical": [col for col in CATEGORICAL_FEATURES if col in data.columns],
    }
    feature_columns = available_features["numerical"] + available_features["categorical"]
    missing_by_column = data.isna().sum().sort_values(ascending=False).to_dict()

    duplicate_subset = [
        col for col in ["learnerEmail", "courseId", "conceptId", "recommendedConcept", "adaptiveScore", "profileType", TARGET]
        if col in data.columns
    ]
    duplicates_count = int(data.duplicated(subset=duplicate_subset).sum()) if duplicate_subset else 0

    risks = []
    non_null_target = target_series.dropna()
    if len(non_null_target) < 30:
        risks.append("Dataset very small for robust supervised learning.")
    if non_null_target.nunique() < 2:
        risks.append("Target has a single known class; supervised training is not valid.")
    elif non_null_target.value_counts(normalize=True).max() >= 0.8:
        risks.append("Target is potentially imbalanced.")
    if feature_columns and data[feature_columns].isna().mean().max() > 0.5:
        risks.append("Some features are sparse.")
    if duplicates_count:
        risks.append("Duplicate or near-duplicate recommendation rows detected.")

    return {
        "totalRows": int(len(df)),
        "totalColumns": int(len(df.columns)),
        "missingValuesByColumn": {key: int(value) for key, value in missing_by_column.items()},
        "targetDistribution": distribution,
        "availableFeatures": available_features,
        "excludedOutcomeFields": [col for col in EXCLUDED_OUTCOME_FIELDS if col in df.columns],
        "duplicatesCount": duplicates_count,
        "risks": risks,
    }


def build_clean_dataset(df: pd.DataFrame):
    data = prepare_serving_schema(df)
    data[TARGET] = to_bool_series(data[TARGET])
    data = data.dropna(subset=[TARGET]).copy()
    data[TARGET] = data[TARGET].astype(int)

    numerical = [col for col in NUMERICAL_FEATURES if col in data.columns]
    categorical = [col for col in CATEGORICAL_FEATURES if col in data.columns]
    clean = data[numerical + categorical + [TARGET]].copy()

    for col in numerical:
        clean[col] = pd.to_numeric(clean[col], errors="coerce")
    for col in categorical:
        clean[col] = clean[col].astype("string").fillna("MISSING")

    return clean, numerical, categorical


def make_preprocessor(numerical, categorical):
    return ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]),
                numerical,
            ),
            (
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ]),
                categorical,
            ),
        ]
    )


def get_feature_names(model, numerical, categorical):
    preprocessor = model.named_steps["preprocess"]
    names = list(numerical)
    if categorical:
        onehot = preprocessor.named_transformers_["cat"].named_steps["onehot"]
        names.extend(onehot.get_feature_names_out(categorical).tolist())
    return names


def evaluate_models(clean: pd.DataFrame, numerical, categorical):
    y = clean[TARGET]
    X = clean.drop(columns=[TARGET])
    if len(clean) < 8 or y.nunique() < 2 or y.value_counts().min() < 2:
        return {
            "skipped": True,
            "reason": "Not enough labelled rows or classes for a valid supervised train/test evaluation.",
            "models": {},
            "featureImportance": [],
        }, None

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.3,
        random_state=42,
        stratify=y,
    )

    definitions = {
        "dummy_most_frequent": DummyClassifier(strategy="most_frequent", random_state=42),
        "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
        "random_forest": RandomForestClassifier(
            n_estimators=250,
            random_state=42,
            class_weight="balanced",
            min_samples_leaf=2,
        ),
    }

    results = {}
    fitted_models = {}
    for name, estimator in definitions.items():
        model = Pipeline([
            ("preprocess", make_preprocessor(numerical, categorical)),
            ("model", estimator),
        ])
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]

        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1": float(f1_score(y_test, y_pred, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, y_proba)) if y_test.nunique() == 2 else None,
            "confusionMatrix": confusion_matrix(y_test, y_pred, labels=[0, 1]).tolist(),
            "trainRows": int(len(X_train)),
            "testRows": int(len(X_test)),
        }

        if len(clean) >= 30 and y.value_counts().min() >= 5:
            cv_splits = min(5, int(y.value_counts().min()))
            cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=42)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                scores = cross_val_score(model, X, y, cv=cv, scoring="f1")
            metrics["crossValidationF1Mean"] = float(np.mean(scores))
            metrics["crossValidationF1Std"] = float(np.std(scores))

        results[name] = metrics
        fitted_models[name] = model

    best_name = max(results, key=lambda key: (results[key]["f1"], results[key]["roc_auc"] or -1))
    best_model = fitted_models[best_name]
    estimator = best_model.named_steps["model"]
    feature_names = get_feature_names(best_model, numerical, categorical)
    if hasattr(estimator, "feature_importances_"):
        values = estimator.feature_importances_
        importance = sorted(
            [{"feature": feature, "importance": float(value)} for feature, value in zip(feature_names, values)],
            key=lambda item: item["importance"],
            reverse=True,
        )
    elif hasattr(estimator, "coef_"):
        values = np.abs(estimator.coef_[0])
        importance = sorted(
            [{"feature": feature, "importance": float(value)} for feature, value in zip(feature_names, values)],
            key=lambda item: item["importance"],
            reverse=True,
        )
    else:
        importance = []

    return {
        "skipped": False,
        "bestModel": best_name,
        "models": results,
        "featureImportance": importance,
    }, best_model


def save_serving_model(best_model, evaluation, numerical, categorical):
    if best_model is None or evaluation.get("skipped"):
        return None

    best_name = evaluation.get("bestModel") or "model"
    model_version = {
        "logistic_regression": "local-logistic-v1",
        "random_forest": "local-rf-v1",
        "dummy_most_frequent": "local-dummy-v1",
    }.get(best_name, f"local-{best_name}-v1")

    MODEL_SERVING_DIR.mkdir(parents=True, exist_ok=True)
    bundle = {
        "modelVersion": model_version,
        "pipeline": best_model,
        "target": TARGET,
        "features": numerical + categorical,
        "numericalFeatures": numerical,
        "categoricalFeatures": categorical,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "trainingNote": "Offline experimental model. The rule-based AdaptiveEngine remains the primary decision engine.",
    }
    joblib.dump(bundle, SERVING_MODEL_PATH)
    return {
        "path": str(SERVING_MODEL_PATH.relative_to(ROOT_DIR)),
        "modelVersion": model_version,
        "bestModel": best_name,
        "features": numerical + categorical,
    }


def write_artifacts(traces, audit, clean, evaluation, best_model, numerical, categorical, metadata, args):
    source = args.source
    report_name = args.report_name or ("synthetic-ml-report.md" if source == "synthetic" else "first-ml-experiment-report.md")
    raw_path = OUTPUT_DIR / f"recommendation-traces-{source}-raw.json"
    clean_path = OUTPUT_DIR / ("synthetic-recommendation-traces-cleaned.csv" if source == "synthetic" else "recommendation-traces-cleaned.csv")

    raw_path.write_text(json.dumps(traces, ensure_ascii=False, indent=2), encoding="utf-8")
    clean.to_csv(clean_path, index=False, encoding="utf-8")

    serving_model = save_serving_model(best_model, evaluation, numerical, categorical)

    metrics = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata,
        "target": TARGET,
        "sourceTarget": SOURCE_TARGET,
        "servingModel": serving_model,
        "audit": audit,
        "cleanedDataset": {
            "rows": int(clean.shape[0]),
            "columns": int(clean.shape[1]),
            "path": str(clean_path.relative_to(ROOT_DIR)),
        },
        "evaluation": evaluation,
    }
    (OUTPUT_DIR / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")

    pd.DataFrame(evaluation.get("featureImportance", []), columns=["feature", "importance"]).to_csv(
        OUTPUT_DIR / "feature_importance.csv",
        index=False,
        encoding="utf-8",
    )

    matrices = []
    if not evaluation["skipped"]:
        for model_name, model_metrics in evaluation["models"].items():
            matrix = model_metrics["confusionMatrix"]
            matrices.append({"model": model_name, "actual": 0, "predicted_0": matrix[0][0], "predicted_1": matrix[0][1]})
            matrices.append({"model": model_name, "actual": 1, "predicted_0": matrix[1][0], "predicted_1": matrix[1][1]})
    pd.DataFrame(matrices, columns=["model", "actual", "predicted_0", "predicted_1"]).to_csv(
        OUTPUT_DIR / "confusion_matrix.csv",
        index=False,
        encoding="utf-8",
    )

    write_markdown_report(OUTPUT_DIR / report_name, audit, clean.shape, evaluation, metadata)


def write_markdown_report(path: Path, audit, cleaned_shape, evaluation, metadata):
    lines = [
        "# First ML Experiment - AdaptiveEngine",
        "",
        "## 1. Dataset quality",
        f"- Source type: `{metadata['source']}`",
        f"- Source detail: {metadata.get('description', '')}",
        f"- Exported rows: {audit['totalRows']}",
        f"- Labelled ML rows after target filtering: {cleaned_shape[0]}",
        f"- Exported columns: {audit['totalColumns']}",
        f"- Target distribution `{TARGET}`: `{json.dumps(audit['targetDistribution'], ensure_ascii=False)}`",
        f"- Duplicate or near-duplicate rows: {audit['duplicatesCount']}",
        "",
        "Risks:",
    ]
    lines.extend([f"- {risk}" for risk in audit["risks"]] or ["- No automatic blocking risk detected."])
    lines.extend([
        "",
        "## 2. Features retained",
        "",
        "Numerical:",
        ", ".join(audit["availableFeatures"]["numerical"]) or "None",
        "",
        "Categorical:",
        ", ".join(audit["availableFeatures"]["categorical"]) or "None",
        "",
        "Outcome fields excluded to avoid leakage:",
        ", ".join(audit["excludedOutcomeFields"]) or "None",
        "",
        "## 3. Models tested",
        "- Dummy Classifier, strategy most_frequent",
        "- Logistic Regression",
        "- Random Forest",
        "",
        "## 4. Results",
    ])

    if evaluation["skipped"]:
        lines.append(f"- Training skipped: {evaluation['reason']}")
    else:
        for model_name, metrics in evaluation["models"].items():
            lines.extend([
                f"### {model_name}",
                f"- Accuracy: {metrics['accuracy']:.3f}",
                f"- Precision: {metrics['precision']:.3f}",
                f"- Recall: {metrics['recall']:.3f}",
                f"- F1-score: {metrics['f1']:.3f}",
                f"- ROC-AUC: {metrics['roc_auc']:.3f}" if metrics["roc_auc"] is not None else "- ROC-AUC: not computable",
                f"- Confusion matrix [0,1]: `{metrics['confusionMatrix']}`",
            ])
            if "crossValidationF1Mean" in metrics:
                lines.append(f"- Cross-validation F1: {metrics['crossValidationF1Mean']:.3f} +/- {metrics['crossValidationF1Std']:.3f}")
            lines.append("")

    lines.extend([
        "## 5. Best model",
        evaluation.get("bestModel", "Not determined") if not evaluation["skipped"] else "Not determined",
        "",
        "## 6. Feature importance",
    ])
    lines.extend([f"- {item['feature']}: {item['importance']:.4f}" for item in evaluation.get("featureImportance", [])[:15]] or ["- Not available."])
    lines.extend([
        "",
        "## 7. Scientific recommendation",
        "This experiment is offline and exploratory. Synthetic data can validate the pipeline mechanics, but it cannot prove real predictive performance on learners.",
        "",
        "## 8. Future integration",
        "The exported model is optional and secondary. It should be validated on real labelled outcomes before any stronger pedagogical activation.",
        "",
        "The rule-based AdaptiveEngine remains the primary decision engine.",
    ])
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    args = parse_args()
    traces, metadata = load_traces(args)
    df = pd.DataFrame(traces)
    audit = audit_dataset(df)
    clean, numerical, categorical = build_clean_dataset(df)
    evaluation, best_model = evaluate_models(clean, numerical, categorical)
    write_artifacts(traces, audit, clean, evaluation, best_model, numerical, categorical, metadata, args)

    print(json.dumps({
        "source": args.source,
        "rows": audit["totalRows"],
        "cleanRows": int(clean.shape[0]),
        "targetDistribution": audit["targetDistribution"],
        "bestModel": evaluation.get("bestModel"),
        "modelPath": str(SERVING_MODEL_PATH.relative_to(ROOT_DIR)) if SERVING_MODEL_PATH.exists() else None,
        "skipped": evaluation["skipped"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
