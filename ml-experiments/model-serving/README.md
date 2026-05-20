# AdaptiveEngine ML Serving

Minimal FastAPI service for the offline RecommendationTrace experiment.

The adaptive engine remains rule-based. This service only exposes an experimental secondary signal.

## Start locally

```bash
uvicorn app:app --host 0.0.0.0 --port 8090
```

## Predict

```bash
curl -X POST http://localhost:8090/api/ml/predict-success \
  -H "Content-Type: application/json" \
  -d "{\"adaptiveScore\":0.82,\"prerequisiteScore\":0.9,\"historicalPerformanceScore\":0.75,\"pedagogicalOrderScore\":0.8,\"engagementScore\":0.7,\"diagnosticWeaknessScore\":0.3,\"masteryScore\":0.65,\"averageAssessmentScore\":72,\"completedLabsCount\":5,\"tracesCount\":18,\"profileType\":\"INTERMEDIATE\",\"recommendationType\":\"NORMAL_PROGRESS\"}"
```

If `model.pkl` is missing or cannot be loaded, the API returns HTTP 503 with a clear error. The Spring Boot adaptive engine falls back to the rule-based score.
