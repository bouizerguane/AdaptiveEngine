# Profil apprenant - Runtime Test Report

Generated at: 2026-05-20T08:37:12.225Z
API: http://localhost:8080/api
KMS: KMS_u = sum(W_i * S_u,i) / sum(W_i), W_i = poidsCognitif if available else 1
Duration: 3001 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| Profil apprenant - Apprenant sans donnees | PASS | {"profileType":"DATA_INSUFFICIENT","profileExplanation":"present"} | {"learnerEmail":"student.profile.nodata@test.local","masteryScore":null,"knowledgeGaps":[],"masteredConceptsCount":0,"weakConceptsCount":0,"tracesCount":0,"completedLabsCount":0,"averageAssessmentScore":null,"totalLearningTime":0,"profileType":"DATA_INSUFFICIENT","profileExplanation":"Le profil sera affiné après davantage d'activités."} |
| Profil apprenant - Apprenant avec lacunes | PASS | {"profileType":"NEEDS_REMEDIATION","knowledgeGaps":"non-empty"} | {"learnerEmail":"student.profile.gaps@test.local","masteryScore":40.16,"knowledgeGaps":["Variables","Conditions"],"masteredConceptsCount":0,"weakConceptsCount":2,"tracesCount":6,"completedLabsCount":0,"averageAssessmentScore":38.5,"totalLearningTime":1800,"profileType":"NEEDS_REMEDIATION","profileExplanation":"Le profil indique des lacunes détectées dans le dernier diagnostic."} |
| Profil apprenant - Apprenant actif sans lacunes | PASS | {"profileType":"PROGRESSING","knowledgeGaps":"empty","masteryScore":"calculable"} | {"learnerEmail":"student.profile.progressing@test.local","masteryScore":81.29,"knowledgeGaps":[],"masteredConceptsCount":2,"weakConceptsCount":0,"tracesCount":12,"completedLabsCount":0,"averageAssessmentScore":80,"totalLearningTime":3240,"profileType":"PROGRESSING","profileExplanation":"Le profil indique une progression active."} |
| Profil apprenant - Apprenant avec tres bonnes performances | PASS | {"profileType":"HIGH_PERFORMING","nextAction":"COMPLETED","masteryScore":"calculable"} | {"nextAction":"COMPLETED","learnerProfile":{"learnerEmail":"student.profile.high@test.local","masteryScore":95.16,"knowledgeGaps":[],"masteredConceptsCount":7,"weakConceptsCount":0,"tracesCount":24,"completedLabsCount":0,"averageAssessmentScore":95.75,"totalLearningTime":6120,"profileType":"HIGH_PERFORMING","profileExplanation":"Le profil indique une bonne maîtrise des concepts évalués."}} |

## Profil apprenant - Apprenant sans donnees - PASS

Assertions:
- PASS profileType: expected `DATA_INSUFFICIENT`, actual `DATA_INSUFFICIENT`
- PASS tracesCount: expected `0`, actual `0`
- PASS completedLabsCount: expected `0`, actual `0`
- PASS profileExplanation: expected `non-empty`, actual `Le profil sera affiné après davantage d'activités.`

Learner profile:
```json
{
  "learnerEmail": "student.profile.nodata@test.local",
  "masteryScore": null,
  "knowledgeGaps": [],
  "masteredConceptsCount": 0,
  "weakConceptsCount": 0,
  "tracesCount": 0,
  "completedLabsCount": 0,
  "averageAssessmentScore": null,
  "totalLearningTime": 0,
  "profileType": "DATA_INSUFFICIENT",
  "profileExplanation": "Le profil sera affiné après davantage d'activités."
}
```

## Profil apprenant - Apprenant avec lacunes - PASS

Assertions:
- PASS profileType: expected `NEEDS_REMEDIATION`, actual `NEEDS_REMEDIATION`
- PASS knowledgeGaps: expected `non-empty`, actual `Variables,Conditions`
- PASS weakConceptsCount > 0: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique des lacunes détectées dans le dernier diagnostic.`

Learner profile:
```json
{
  "learnerEmail": "student.profile.gaps@test.local",
  "masteryScore": 40.16,
  "knowledgeGaps": [
    "Variables",
    "Conditions"
  ],
  "masteredConceptsCount": 0,
  "weakConceptsCount": 2,
  "tracesCount": 6,
  "completedLabsCount": 0,
  "averageAssessmentScore": 38.5,
  "totalLearningTime": 1800,
  "profileType": "NEEDS_REMEDIATION",
  "profileExplanation": "Le profil indique des lacunes détectées dans le dernier diagnostic."
}
```

## Profil apprenant - Apprenant actif sans lacunes - PASS

Assertions:
- PASS profileType: expected `PROGRESSING`, actual `PROGRESSING`
- PASS weakConceptsCount: expected `0`, actual `0`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS tracesCount > 0: expected `true`, actual `true`

Learner profile:
```json
{
  "learnerEmail": "student.profile.progressing@test.local",
  "masteryScore": 81.29,
  "knowledgeGaps": [],
  "masteredConceptsCount": 2,
  "weakConceptsCount": 0,
  "tracesCount": 12,
  "completedLabsCount": 0,
  "averageAssessmentScore": 80,
  "totalLearningTime": 3240,
  "profileType": "PROGRESSING",
  "profileExplanation": "Le profil indique une progression active."
}
```

## Profil apprenant - Apprenant avec tres bonnes performances - PASS

Assertions:
- PASS nextAction: expected `COMPLETED`, actual `COMPLETED`
- PASS profileType: expected `HIGH_PERFORMING`, actual `HIGH_PERFORMING`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique une bonne maîtrise des concepts évalués.`

Learner profile:
```json
{
  "learnerEmail": "student.profile.high@test.local",
  "masteryScore": 95.16,
  "knowledgeGaps": [],
  "masteredConceptsCount": 7,
  "weakConceptsCount": 0,
  "tracesCount": 24,
  "completedLabsCount": 0,
  "averageAssessmentScore": 95.75,
  "totalLearningTime": 6120,
  "profileType": "HIGH_PERFORMING",
  "profileExplanation": "Le profil indique une bonne maîtrise des concepts évalués."
}
```
