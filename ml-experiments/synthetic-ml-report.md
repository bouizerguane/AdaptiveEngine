# First ML Experiment - AdaptiveEngine

## 1. Dataset quality
- Source type: `synthetic`
- Source detail: synthetic experimental dataset generated from AdaptiveEngine feature schema
- Exported rows: 260
- Labelled ML rows after target filtering: 250
- Exported columns: 45
- Target distribution `conceptCompletedAfterRecommendation`: `{"1.0": 143, "0.0": 107, "nan": 10}`
- Duplicate or near-duplicate rows: 0

Risks:
- No automatic blocking risk detected.

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
### dummy_most_frequent
- Accuracy: 0.573
- Precision: 0.573
- Recall: 1.000
- F1-score: 0.729
- ROC-AUC: 0.500
- Confusion matrix [0,1]: `[[0, 32], [0, 43]]`
- Cross-validation F1: 0.728 +/- 0.008

### logistic_regression
- Accuracy: 0.773
- Precision: 0.825
- Recall: 0.767
- F1-score: 0.795
- ROC-AUC: 0.825
- Confusion matrix [0,1]: `[[25, 7], [10, 33]]`
- Cross-validation F1: 0.787 +/- 0.034

### random_forest
- Accuracy: 0.707
- Precision: 0.769
- Recall: 0.698
- F1-score: 0.732
- ROC-AUC: 0.782
- Confusion matrix [0,1]: `[[23, 9], [13, 30]]`
- Cross-validation F1: 0.759 +/- 0.047

## 5. Best model
logistic_regression

## 6. Feature importance
- nextAction_REMEDIATION: 1.5732
- recommendationContext_LEARN: 1.3379
- nextAction_LEARN: 1.2699
- recommendationContext_REMEDIATION: 1.0346
- repeatedFailuresCount: 0.7867
- masteryScore: 0.6514
- profileType_HIGH_PERFORMING: 0.5953
- completedLabsCount: 0.4984
- lastActivityType_REMEDIATION: 0.4897
- highMasteryProgression_True: 0.4832
- highMasteryProgression_False: 0.4826
- profileType_PROGRESSING: 0.4565
- engagementScore: 0.3528
- lastActivityType_DIAGNOSTIC: 0.3124
- recommendationContext_VALIDATION: 0.3039

## 7. Scientific recommendation
This experiment is offline and exploratory. Synthetic data can validate the pipeline mechanics, but it cannot prove real predictive performance on learners.

## 8. Future integration
No ML model is integrated into AdaptiveEngine. A future model should first be validated on real labelled outcomes, then compared against the current explainable rule-based engine before any pedagogical activation.

No ML model was added to the AdaptiveEngine runtime.