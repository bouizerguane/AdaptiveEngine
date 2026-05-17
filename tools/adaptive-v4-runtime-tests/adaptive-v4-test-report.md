# Adaptive Engine V4 Runtime Test Report

Generated at: 2026-05-17T13:46:18.394Z
API: http://localhost:8080/api
KMS: KMS_u = sum(W_i * S_u,i) / sum(W_i), W_i = poidsCognitif if available else 1
Duration: 2234 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| V4 - Apprenant sans donnees | PASS | {"profileType":"DATA_INSUFFICIENT","profileExplanation":"present"} | {"learnerEmail":"student.v4.nodata@test.local","masteryScore":null,"knowledgeGaps":[],"masteredConceptsCount":0,"weakConceptsCount":0,"tracesCount":0,"completedLabsCount":0,"averageAssessmentScore":null,"totalLearningTime":0,"profileType":"DATA_INSUFFICIENT","profileExplanation":"Le profil sera affine apres davantage d'activites."} |
| V4 - Apprenant avec lacunes | PASS | {"profileType":"NEEDS_REMEDIATION","knowledgeGaps":"non-empty"} | {"learnerEmail":"student.v4.gaps@test.local","masteryScore":40.16,"knowledgeGaps":["Variables","Conditions"],"masteredConceptsCount":0,"weakConceptsCount":2,"tracesCount":2,"completedLabsCount":0,"averageAssessmentScore":38.5,"totalLearningTime":600,"profileType":"NEEDS_REMEDIATION","profileExplanation":"Le profil indique des lacunes detectees dans le dernier diagnostic."} |
| V4 - Apprenant actif sans lacunes | PASS | {"profileType":"PROGRESSING","knowledgeGaps":"empty","masteryScore":"calculable"} | {"learnerEmail":"student.v4.progressing@test.local","masteryScore":81.38,"knowledgeGaps":[],"masteredConceptsCount":2,"weakConceptsCount":0,"tracesCount":4,"completedLabsCount":0,"averageAssessmentScore":80,"totalLearningTime":1080,"profileType":"PROGRESSING","profileExplanation":"Le profil indique une progression active."} |
| V4 - Apprenant avec tres bonnes performances | PASS | {"profileType":"HIGH_PERFORMING","nextAction":"COMPLETED","masteryScore":"calculable"} | {"nextAction":"COMPLETED","learnerProfile":{"learnerEmail":"student.v4.high@test.local","masteryScore":95.14,"knowledgeGaps":[],"masteredConceptsCount":7,"weakConceptsCount":0,"tracesCount":8,"completedLabsCount":0,"averageAssessmentScore":95.75,"totalLearningTime":2040,"profileType":"HIGH_PERFORMING","profileExplanation":"Le profil indique une bonne maitrise des concepts evalues."}} |

## V4 - Apprenant sans donnees - PASS

Assertions:
- PASS profileType: expected `DATA_INSUFFICIENT`, actual `DATA_INSUFFICIENT`
- PASS tracesCount: expected `0`, actual `0`
- PASS completedLabsCount: expected `0`, actual `0`
- PASS profileExplanation: expected `non-empty`, actual `Le profil sera affine apres davantage d'activites.`

Learner profile:
```json
{
  "learnerEmail": "student.v4.nodata@test.local",
  "masteryScore": null,
  "knowledgeGaps": [],
  "masteredConceptsCount": 0,
  "weakConceptsCount": 0,
  "tracesCount": 0,
  "completedLabsCount": 0,
  "averageAssessmentScore": null,
  "totalLearningTime": 0,
  "profileType": "DATA_INSUFFICIENT",
  "profileExplanation": "Le profil sera affine apres davantage d'activites."
}
```

## V4 - Apprenant avec lacunes - PASS

Assertions:
- PASS profileType: expected `NEEDS_REMEDIATION`, actual `NEEDS_REMEDIATION`
- PASS knowledgeGaps: expected `non-empty`, actual `Variables,Conditions`
- PASS weakConceptsCount > 0: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique des lacunes detectees dans le dernier diagnostic.`

Learner profile:
```json
{
  "learnerEmail": "student.v4.gaps@test.local",
  "masteryScore": 40.16,
  "knowledgeGaps": [
    "Variables",
    "Conditions"
  ],
  "masteredConceptsCount": 0,
  "weakConceptsCount": 2,
  "tracesCount": 2,
  "completedLabsCount": 0,
  "averageAssessmentScore": 38.5,
  "totalLearningTime": 600,
  "profileType": "NEEDS_REMEDIATION",
  "profileExplanation": "Le profil indique des lacunes detectees dans le dernier diagnostic."
}
```

## V4 - Apprenant actif sans lacunes - PASS

Assertions:
- PASS profileType: expected `PROGRESSING`, actual `PROGRESSING`
- PASS weakConceptsCount: expected `0`, actual `0`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS tracesCount > 0: expected `true`, actual `true`

Learner profile:
```json
{
  "learnerEmail": "student.v4.progressing@test.local",
  "masteryScore": 81.38,
  "knowledgeGaps": [],
  "masteredConceptsCount": 2,
  "weakConceptsCount": 0,
  "tracesCount": 4,
  "completedLabsCount": 0,
  "averageAssessmentScore": 80,
  "totalLearningTime": 1080,
  "profileType": "PROGRESSING",
  "profileExplanation": "Le profil indique une progression active."
}
```

## V4 - Apprenant avec tres bonnes performances - PASS

Assertions:
- PASS nextAction: expected `COMPLETED`, actual `COMPLETED`
- PASS profileType: expected `HIGH_PERFORMING`, actual `HIGH_PERFORMING`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique une bonne maitrise des concepts evalues.`

Learner profile:
```json
{
  "learnerEmail": "student.v4.high@test.local",
  "masteryScore": 95.14,
  "knowledgeGaps": [],
  "masteredConceptsCount": 7,
  "weakConceptsCount": 0,
  "tracesCount": 8,
  "completedLabsCount": 0,
  "averageAssessmentScore": 95.75,
  "totalLearningTime": 2040,
  "profileType": "HIGH_PERFORMING",
  "profileExplanation": "Le profil indique une bonne maitrise des concepts evalues."
}
```
