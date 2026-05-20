# First ML Experiment - AdaptiveEngine

## 1. Dataset quality
- Source type: `synthetic`
- Source detail: synthetic experimental dataset generated from AdaptiveEngine feature schema
- Exported rows: 260
- Labelled ML rows after target filtering: 250
- Exported columns: 45
- Target distribution `success`: `{"1.0": 143, "0.0": 107, "nan": 10}`
- Duplicate or near-duplicate rows: 0

Risks:
- No automatic blocking risk detected.

## 2. Features retained

Numerical:
adaptiveScore, prerequisiteScore, historicalPerformanceScore, pedagogicalOrderScore, engagementScore, diagnosticWeaknessScore, masteryScore, averageAssessmentScore, completedLabsCount, tracesCount

Categorical:
profileType, recommendationType

Outcome fields excluded to avoid leakage:
quizScoreAfterRecommendation, conceptCompletedAfterRecommendation, remediationSucceeded, outcomeCapturedAt, conceptCompleted, labSubmittedAfterRecommendation, learnerDropped, recommendationAccepted, lastActivityScore, remediationSuccess

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
- Accuracy: 0.707
- Precision: 0.784
- Recall: 0.674
- F1-score: 0.725
- ROC-AUC: 0.777
- Confusion matrix [0,1]: `[[24, 8], [14, 29]]`
- Cross-validation F1: 0.716 +/- 0.069

### random_forest
- Accuracy: 0.720
- Precision: 0.806
- Recall: 0.674
- F1-score: 0.734
- ROC-AUC: 0.749
- Confusion matrix [0,1]: `[[25, 7], [14, 29]]`
- Cross-validation F1: 0.718 +/- 0.036

## 5. Best model
random_forest

## 6. Feature importance
- averageAssessmentScore: 0.2149
- masteryScore: 0.1692
- engagementScore: 0.1309
- adaptiveScore: 0.0875
- pedagogicalOrderScore: 0.0822
- historicalPerformanceScore: 0.0669
- completedLabsCount: 0.0667
- tracesCount: 0.0530
- diagnosticWeaknessScore: 0.0278
- profileType_HIGH_PERFORMING: 0.0259
- profileType_NEEDS_REMEDIATION: 0.0249
- prerequisiteScore: 0.0175
- recommendationType_REMEDIATION: 0.0134
- profileType_PROGRESSING: 0.0088
- recommendationType_NORMAL_PROGRESS: 0.0082

## 7. Scientific recommendation
This experiment is offline and exploratory. Synthetic data can validate the pipeline mechanics, but it cannot prove real predictive performance on learners.

## 8. Future integration
The exported model is optional and secondary. It should be validated on real labelled outcomes before any stronger pedagogical activation.

The rule-based AdaptiveEngine remains the primary decision engine.