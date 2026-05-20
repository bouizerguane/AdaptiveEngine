# Strategie pedagogique - Runtime Test Report

Generated at: 2026-05-20T08:37:15.352Z
API: http://localhost:8080/api
KMS: KMS_u = sum(W_i * S_u,i) / sum(W_i), W_i = poidsCognitif if available else 1
Duration: 2868 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| Strategie pedagogique - Apprenant sans donnees | PASS | {"profileType":"DATA_INSUFFICIENT","strategyType":"SUPPORTIVE"} | {"learnerProfile":{"learnerEmail":"student.strategy.nodata@test.local","masteryScore":null,"knowledgeGaps":[],"masteredConceptsCount":0,"weakConceptsCount":0,"tracesCount":0,"completedLabsCount":0,"averageAssessmentScore":null,"totalLearningTime":0,"profileType":"DATA_INSUFFICIENT","profileExplanation":"Le profil sera affiné après davantage d'activités."},"pedagogicalStrategy":{"strategyType":"SUPPORTIVE","strategyExplanation":"Le système propose une progression guidée car les données d'apprentissage sont encore limitées.","recommendedSequence":["RESOURCE","LAB","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: PASS_DIAGNOSTIC.","Collecter davantage de traces avant d'affiner la personnalisation."],"tutoringMessageHint":"Encourager l'apprenant et proposer une activité guidée."}} |
| Strategie pedagogique - Apprenant avec lacunes | PASS | {"profileType":"NEEDS_REMEDIATION","strategyType":"RECOVERY"} | {"learnerProfile":{"learnerEmail":"student.strategy.gaps@test.local","masteryScore":40.16,"knowledgeGaps":["Variables","Conditions"],"masteredConceptsCount":0,"weakConceptsCount":2,"tracesCount":5,"completedLabsCount":0,"averageAssessmentScore":38.5,"totalLearningTime":1500,"profileType":"NEEDS_REMEDIATION","profileExplanation":"Le profil indique des lacunes détectées dans le dernier diagnostic."},"pedagogicalStrategy":{"strategyType":"RECOVERY","strategyExplanation":"Le système privilégie une stratégie de récupération car des lacunes ont été détectées.","recommendedSequence":["RESOURCE","REVIEW","LAB","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: REMEDIATION.","Appliquer la stratégie au concept recommandé: Variables.","Traiter les lacunes détectées avant d'avancer."],"tutoringMessageHint":"Proposer une explication simplifiée et rappeler les prérequis."}} |
| Strategie pedagogique - Apprenant en progression normale | PASS | {"profileType":"PROGRESSING","strategyType":"STANDARD"} | {"learnerProfile":{"learnerEmail":"student.strategy.progressing@test.local","masteryScore":81.3,"knowledgeGaps":[],"masteredConceptsCount":2,"weakConceptsCount":0,"tracesCount":10,"completedLabsCount":0,"averageAssessmentScore":80,"totalLearningTime":2700,"profileType":"PROGRESSING","profileExplanation":"Le profil indique une progression active."},"pedagogicalStrategy":{"strategyType":"STANDARD","strategyExplanation":"Le système applique une progression standard basée sur le parcours recommandé.","recommendedSequence":["RESOURCE","LAB","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: LEARN.","Appliquer la stratégie au concept recommandé: Conditions."],"tutoringMessageHint":"Accompagner l'apprenant dans la séquence normale ressource-TP-évaluation."}} |
| Strategie pedagogique - Apprenant performant | PASS | {"profileType":"HIGH_PERFORMING","nextAction":"COMPLETED","strategyType":"ADVANCED"} | {"nextAction":"COMPLETED","learnerProfile":{"learnerEmail":"student.strategy.high@test.local","masteryScore":95.16,"knowledgeGaps":[],"masteredConceptsCount":7,"weakConceptsCount":0,"tracesCount":20,"completedLabsCount":0,"averageAssessmentScore":95.75,"totalLearningTime":5100,"profileType":"HIGH_PERFORMING","profileExplanation":"Le profil indique une bonne maîtrise des concepts évalués."},"pedagogicalStrategy":{"strategyType":"ADVANCED","strategyExplanation":"Le système propose une stratégie avancée car le profil indique une bonne maîtrise.","recommendedSequence":["RESOURCE","CHALLENGE","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: COMPLETED."],"tutoringMessageHint":"Proposer un défi ou une activité d'approfondissement."}} |

## Strategie pedagogique - Apprenant sans donnees - PASS

Assertions:
- PASS profileType: expected `DATA_INSUFFICIENT`, actual `DATA_INSUFFICIENT`
- PASS tracesCount: expected `0`, actual `0`
- PASS completedLabsCount: expected `0`, actual `0`
- PASS profileExplanation: expected `non-empty`, actual `Le profil sera affiné après davantage d'activités.`
- PASS pedagogicalStrategy.strategyType: expected `SUPPORTIVE`, actual `SUPPORTIVE`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le système propose une progression guidée car les données d'apprentissage sont encore limitées.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,LAB,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Encourager l'apprenant et proposer une activité guidée.`

Learner profile:
```json
{
  "learnerEmail": "student.strategy.nodata@test.local",
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

Pedagogical strategy:
```json
{
  "strategyType": "SUPPORTIVE",
  "strategyExplanation": "Le système propose une progression guidée car les données d'apprentissage sont encore limitées.",
  "recommendedSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: PASS_DIAGNOSTIC.",
    "Collecter davantage de traces avant d'affiner la personnalisation."
  ],
  "tutoringMessageHint": "Encourager l'apprenant et proposer une activité guidée."
}
```

## Strategie pedagogique - Apprenant avec lacunes - PASS

Assertions:
- PASS profileType: expected `NEEDS_REMEDIATION`, actual `NEEDS_REMEDIATION`
- PASS knowledgeGaps: expected `non-empty`, actual `Variables,Conditions`
- PASS weakConceptsCount > 0: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique des lacunes détectées dans le dernier diagnostic.`
- PASS pedagogicalStrategy.strategyType: expected `RECOVERY`, actual `RECOVERY`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le système privilégie une stratégie de récupération car des lacunes ont été détectées.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,REVIEW,LAB,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Proposer une explication simplifiée et rappeler les prérequis.`

Learner profile:
```json
{
  "learnerEmail": "student.strategy.gaps@test.local",
  "masteryScore": 40.16,
  "knowledgeGaps": [
    "Variables",
    "Conditions"
  ],
  "masteredConceptsCount": 0,
  "weakConceptsCount": 2,
  "tracesCount": 5,
  "completedLabsCount": 0,
  "averageAssessmentScore": 38.5,
  "totalLearningTime": 1500,
  "profileType": "NEEDS_REMEDIATION",
  "profileExplanation": "Le profil indique des lacunes détectées dans le dernier diagnostic."
}
```

Pedagogical strategy:
```json
{
  "strategyType": "RECOVERY",
  "strategyExplanation": "Le système privilégie une stratégie de récupération car des lacunes ont été détectées.",
  "recommendedSequence": [
    "RESOURCE",
    "REVIEW",
    "LAB",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: REMEDIATION.",
    "Appliquer la stratégie au concept recommandé: Variables.",
    "Traiter les lacunes détectées avant d'avancer."
  ],
  "tutoringMessageHint": "Proposer une explication simplifiée et rappeler les prérequis."
}
```

## Strategie pedagogique - Apprenant en progression normale - PASS

Assertions:
- PASS profileType: expected `PROGRESSING`, actual `PROGRESSING`
- PASS weakConceptsCount: expected `0`, actual `0`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS tracesCount > 0: expected `true`, actual `true`
- PASS pedagogicalStrategy.strategyType: expected `STANDARD`, actual `STANDARD`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le système applique une progression standard basée sur le parcours recommandé.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,LAB,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Accompagner l'apprenant dans la séquence normale ressource-TP-évaluation.`

Learner profile:
```json
{
  "learnerEmail": "student.strategy.progressing@test.local",
  "masteryScore": 81.3,
  "knowledgeGaps": [],
  "masteredConceptsCount": 2,
  "weakConceptsCount": 0,
  "tracesCount": 10,
  "completedLabsCount": 0,
  "averageAssessmentScore": 80,
  "totalLearningTime": 2700,
  "profileType": "PROGRESSING",
  "profileExplanation": "Le profil indique une progression active."
}
```

Pedagogical strategy:
```json
{
  "strategyType": "STANDARD",
  "strategyExplanation": "Le système applique une progression standard basée sur le parcours recommandé.",
  "recommendedSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: LEARN.",
    "Appliquer la stratégie au concept recommandé: Conditions."
  ],
  "tutoringMessageHint": "Accompagner l'apprenant dans la séquence normale ressource-TP-évaluation."
}
```

## Strategie pedagogique - Apprenant performant - PASS

Assertions:
- PASS nextAction: expected `COMPLETED`, actual `COMPLETED`
- PASS profileType: expected `HIGH_PERFORMING`, actual `HIGH_PERFORMING`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique une bonne maîtrise des concepts évalués.`
- PASS pedagogicalStrategy.strategyType: expected `ADVANCED`, actual `ADVANCED`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le système propose une stratégie avancée car le profil indique une bonne maîtrise.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,CHALLENGE,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Proposer un défi ou une activité d'approfondissement.`

Learner profile:
```json
{
  "learnerEmail": "student.strategy.high@test.local",
  "masteryScore": 95.16,
  "knowledgeGaps": [],
  "masteredConceptsCount": 7,
  "weakConceptsCount": 0,
  "tracesCount": 20,
  "completedLabsCount": 0,
  "averageAssessmentScore": 95.75,
  "totalLearningTime": 5100,
  "profileType": "HIGH_PERFORMING",
  "profileExplanation": "Le profil indique une bonne maîtrise des concepts évalués."
}
```

Pedagogical strategy:
```json
{
  "strategyType": "ADVANCED",
  "strategyExplanation": "Le système propose une stratégie avancée car le profil indique une bonne maîtrise.",
  "recommendedSequence": [
    "RESOURCE",
    "CHALLENGE",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: COMPLETED."
  ],
  "tutoringMessageHint": "Proposer un défi ou une activité d'approfondissement."
}
```
