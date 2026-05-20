from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"

app = FastAPI(title="AdaptiveEngine ML Serving", version="1.0.0")
model_bundle = None
model_error = None


class PredictionRequest(BaseModel):
    adaptiveScore: Optional[float] = Field(default=None, ge=0, le=1)
    prerequisiteScore: Optional[float] = Field(default=None, ge=0, le=1)
    historicalPerformanceScore: Optional[float] = Field(default=None, ge=0, le=1)
    pedagogicalOrderScore: Optional[float] = Field(default=None, ge=0, le=1)
    engagementScore: Optional[float] = Field(default=None, ge=0, le=1)
    diagnosticWeaknessScore: Optional[float] = Field(default=None, ge=0, le=1)
    masteryScore: Optional[float] = None
    averageAssessmentScore: Optional[float] = None
    completedLabsCount: Optional[float] = None
    tracesCount: Optional[float] = None
    profileType: Optional[str] = "UNKNOWN"
    recommendationType: Optional[str] = "UNKNOWN"


class PredictionResponse(BaseModel):
    successProbability: float
    modelVersion: str


@app.on_event("startup")
def load_model():
    global model_bundle, model_error
    if not MODEL_PATH.exists():
        model_error = f"Model file not found: {MODEL_PATH}"
        return
    try:
        model_bundle = joblib.load(MODEL_PATH)
        model_error = None
    except Exception as exc:  # pragma: no cover - startup guard
        model_bundle = None
        model_error = f"Model could not be loaded: {exc}"


@app.get("/health")
def health():
    return {
        "status": "UP" if model_bundle is not None else "DEGRADED",
        "modelLoaded": model_bundle is not None,
        "modelVersion": None if model_bundle is None else model_bundle.get("modelVersion"),
        "error": model_error,
    }


@app.post("/api/ml/predict-success", response_model=PredictionResponse)
def predict_success(payload: PredictionRequest):
    if model_bundle is None:
        raise HTTPException(status_code=503, detail=model_error or "ML model is not loaded.")

    features = model_bundle.get("features", [])
    pipeline = model_bundle.get("pipeline")
    model_version = model_bundle.get("modelVersion", "local-model-v1")
    if pipeline is None or not features:
        raise HTTPException(status_code=503, detail="ML model bundle is incomplete.")

    row = payload.dict()
    data = pd.DataFrame([{feature: row.get(feature) for feature in features}])
    try:
        probability = float(pipeline.predict_proba(data)[0][1])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {exc}") from exc

    probability = max(0.0, min(1.0, probability))
    return PredictionResponse(successProbability=probability, modelVersion=model_version)
