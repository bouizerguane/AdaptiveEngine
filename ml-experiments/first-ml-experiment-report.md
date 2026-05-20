# First ML Experiment - AdaptiveEngine

## 1. Dataset quality
- Source type: `real`
- Source detail: Real RecommendationTrace export from AdaptiveEngine runtime.
- Exported rows: 60
- Labelled ML rows after target filtering: 4
- Exported columns: 42
- Target distribution `conceptCompletedAfterRecommendation`: `{"nan": 56, "1.0": 4}`
- Duplicate or near-duplicate rows: 0

Risks:
- Dataset very small for robust supervised learning.
- Target has a single known class; supervised training is not valid.
- Some features are sparse.

## 2. Features retained

Numerical:
masteryScore, engagementScore, adaptiveScore, prerequisiteScore, diagnosticWeaknessScore, historicalPerformanceScore, pedagogicalOrderScore, averageAssessmentScore, repeatedFailuresCount, tracesCount, completedLabsCount, knowledgeGapsCount, readyConceptsCount, lockedConceptsCount, completedConceptsCount, recommendedPathSize

Categorical:
profileType, recommendationContext, nextAction, lastActivityType, persistentDifficulty, highMasteryProgression

Outcome fields excluded to avoid leakage:
quizScoreAfterRecommendation, conceptCompletedAfterRecommendation, remediationSucceeded, outcomeCapturedAt, conceptCompleted, labSubmittedAfterRecommendation, learnerDropped, recommendationAccepted

## 3. Models tested
- Dummy Classifier, strategy most_frequent
- Logistic Regression
- Random Forest

## 4. Results
- Training skipped: Not enough labelled rows or classes for a valid supervised train/test evaluation.
## 5. Best model
Not determined

## 6. Feature importance
- Not available.

## 7. Scientific recommendation
This experiment is offline and exploratory. Synthetic data can validate the pipeline mechanics, but it cannot prove real predictive performance on learners.

## 8. Future integration
No ML model is integrated into AdaptiveEngine. A future model should first be validated on real labelled outcomes, then compared against the current explainable rule-based engine before any pedagogical activation.

No ML model was added to the AdaptiveEngine runtime.