# Adaptive Engine V5 Runtime Test Report

Generated at: 2026-05-17T13:46:04.686Z
API: http://localhost:8080/api
KMS: KMS_u = sum(W_i * S_u,i) / sum(W_i), W_i = poidsCognitif if available else 1
Duration: 4131 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| V5 - Apprenant sans donnees | PASS | {"profileType":"DATA_INSUFFICIENT","strategyType":"SUPPORTIVE"} | {"learnerProfile":{"learnerEmail":"student.v5.nodata@test.local","masteryScore":null,"knowledgeGaps":[],"masteredConceptsCount":0,"weakConceptsCount":0,"tracesCount":0,"completedLabsCount":0,"averageAssessmentScore":null,"totalLearningTime":0,"profileType":"DATA_INSUFFICIENT","profileExplanation":"Le profil sera affine apres davantage d'activites."},"pedagogicalStrategy":{"strategyType":"SUPPORTIVE","strategyExplanation":"Le systeme propose une progression guidee car les donnees d'apprentissage sont encore limitees.","recommendedSequence":["RESOURCE","LAB","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: PASS_DIAGNOSTIC.","Collecter davantage de traces avant d'affiner la personnalisation."],"tutoringMessageHint":"Encourager l'apprenant et proposer une activite guidee."}} |
| V5 - Apprenant avec lacunes | PASS | {"profileType":"NEEDS_REMEDIATION","strategyType":"RECOVERY"} | {"learnerProfile":{"learnerEmail":"student.v5.gaps@test.local","masteryScore":40.16,"knowledgeGaps":["Variables","Conditions"],"masteredConceptsCount":0,"weakConceptsCount":2,"tracesCount":1,"completedLabsCount":0,"averageAssessmentScore":38.5,"totalLearningTime":300,"profileType":"NEEDS_REMEDIATION","profileExplanation":"Le profil indique des lacunes detectees dans le dernier diagnostic."},"pedagogicalStrategy":{"strategyType":"RECOVERY","strategyExplanation":"Le systeme privilegie une strategie de recuperation car des lacunes ont ete detectees.","recommendedSequence":["RESOURCE","REVIEW","LAB","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: REMEDIATION.","Appliquer la strategie au concept recommande: Variables.","Traiter les lacunes detectees avant d'avancer."],"tutoringMessageHint":"Proposer une explication simplifiee et rappeler les prerequis."}} |
| V5 - Apprenant en progression normale | PASS | {"profileType":"PROGRESSING","strategyType":"STANDARD"} | {"learnerProfile":{"learnerEmail":"student.v5.progressing@test.local","masteryScore":81.49,"knowledgeGaps":[],"masteredConceptsCount":2,"weakConceptsCount":0,"tracesCount":2,"completedLabsCount":0,"averageAssessmentScore":80,"totalLearningTime":540,"profileType":"PROGRESSING","profileExplanation":"Le profil indique une progression active."},"pedagogicalStrategy":{"strategyType":"STANDARD","strategyExplanation":"Le systeme applique une progression standard basee sur le parcours recommande.","recommendedSequence":["RESOURCE","LAB","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: LEARN.","Appliquer la strategie au concept recommande: Conditions."],"tutoringMessageHint":"Accompagner l'apprenant dans la sequence normale ressource-TP-evaluation."}} |
| V5 - Apprenant performant | PASS | {"profileType":"HIGH_PERFORMING","nextAction":"COMPLETED","strategyType":"ADVANCED"} | {"nextAction":"COMPLETED","learnerProfile":{"learnerEmail":"student.v5.high@test.local","masteryScore":95.12,"knowledgeGaps":[],"masteredConceptsCount":7,"weakConceptsCount":0,"tracesCount":4,"completedLabsCount":0,"averageAssessmentScore":95.75,"totalLearningTime":1020,"profileType":"HIGH_PERFORMING","profileExplanation":"Le profil indique une bonne maitrise des concepts evalues."},"pedagogicalStrategy":{"strategyType":"ADVANCED","strategyExplanation":"Le systeme propose une strategie avancee car le profil indique une bonne maitrise.","recommendedSequence":["RESOURCE","CHALLENGE","FORMATIVE"],"constraints":["Respecter la decision principale du moteur: COMPLETED."],"tutoringMessageHint":"Proposer un defi ou une activite d'approfondissement."}} |

## V5 - Apprenant sans donnees - PASS

Assertions:
- PASS profileType: expected `DATA_INSUFFICIENT`, actual `DATA_INSUFFICIENT`
- PASS tracesCount: expected `0`, actual `0`
- PASS completedLabsCount: expected `0`, actual `0`
- PASS profileExplanation: expected `non-empty`, actual `Le profil sera affine apres davantage d'activites.`
- PASS pedagogicalStrategy.strategyType: expected `SUPPORTIVE`, actual `SUPPORTIVE`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le systeme propose une progression guidee car les donnees d'apprentissage sont encore limitees.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,LAB,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Encourager l'apprenant et proposer une activite guidee.`

Learner profile:
```json
{
  "learnerEmail": "student.v5.nodata@test.local",
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

Pedagogical strategy:
```json
{
  "strategyType": "SUPPORTIVE",
  "strategyExplanation": "Le systeme propose une progression guidee car les donnees d'apprentissage sont encore limitees.",
  "recommendedSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: PASS_DIAGNOSTIC.",
    "Collecter davantage de traces avant d'affiner la personnalisation."
  ],
  "tutoringMessageHint": "Encourager l'apprenant et proposer une activite guidee."
}
```

## V5 - Apprenant avec lacunes - PASS

Assertions:
- PASS profileType: expected `NEEDS_REMEDIATION`, actual `NEEDS_REMEDIATION`
- PASS knowledgeGaps: expected `non-empty`, actual `Variables,Conditions`
- PASS weakConceptsCount > 0: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique des lacunes detectees dans le dernier diagnostic.`
- PASS pedagogicalStrategy.strategyType: expected `RECOVERY`, actual `RECOVERY`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le systeme privilegie une strategie de recuperation car des lacunes ont ete detectees.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,REVIEW,LAB,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Proposer une explication simplifiee et rappeler les prerequis.`

Learner profile:
```json
{
  "learnerEmail": "student.v5.gaps@test.local",
  "masteryScore": 40.16,
  "knowledgeGaps": [
    "Variables",
    "Conditions"
  ],
  "masteredConceptsCount": 0,
  "weakConceptsCount": 2,
  "tracesCount": 1,
  "completedLabsCount": 0,
  "averageAssessmentScore": 38.5,
  "totalLearningTime": 300,
  "profileType": "NEEDS_REMEDIATION",
  "profileExplanation": "Le profil indique des lacunes detectees dans le dernier diagnostic."
}
```

Pedagogical strategy:
```json
{
  "strategyType": "RECOVERY",
  "strategyExplanation": "Le systeme privilegie une strategie de recuperation car des lacunes ont ete detectees.",
  "recommendedSequence": [
    "RESOURCE",
    "REVIEW",
    "LAB",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: REMEDIATION.",
    "Appliquer la strategie au concept recommande: Variables.",
    "Traiter les lacunes detectees avant d'avancer."
  ],
  "tutoringMessageHint": "Proposer une explication simplifiee et rappeler les prerequis."
}
```

## V5 - Apprenant en progression normale - PASS

Assertions:
- PASS profileType: expected `PROGRESSING`, actual `PROGRESSING`
- PASS weakConceptsCount: expected `0`, actual `0`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS tracesCount > 0: expected `true`, actual `true`
- PASS pedagogicalStrategy.strategyType: expected `STANDARD`, actual `STANDARD`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le systeme applique une progression standard basee sur le parcours recommande.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,LAB,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Accompagner l'apprenant dans la sequence normale ressource-TP-evaluation.`

Learner profile:
```json
{
  "learnerEmail": "student.v5.progressing@test.local",
  "masteryScore": 81.49,
  "knowledgeGaps": [],
  "masteredConceptsCount": 2,
  "weakConceptsCount": 0,
  "tracesCount": 2,
  "completedLabsCount": 0,
  "averageAssessmentScore": 80,
  "totalLearningTime": 540,
  "profileType": "PROGRESSING",
  "profileExplanation": "Le profil indique une progression active."
}
```

Pedagogical strategy:
```json
{
  "strategyType": "STANDARD",
  "strategyExplanation": "Le systeme applique une progression standard basee sur le parcours recommande.",
  "recommendedSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: LEARN.",
    "Appliquer la strategie au concept recommande: Conditions."
  ],
  "tutoringMessageHint": "Accompagner l'apprenant dans la sequence normale ressource-TP-evaluation."
}
```

## V5 - Apprenant performant - PASS

Assertions:
- PASS nextAction: expected `COMPLETED`, actual `COMPLETED`
- PASS profileType: expected `HIGH_PERFORMING`, actual `HIGH_PERFORMING`
- PASS masteryScore calculable: expected `true`, actual `true`
- PASS profileExplanation: expected `non-empty`, actual `Le profil indique une bonne maitrise des concepts evalues.`
- PASS pedagogicalStrategy.strategyType: expected `ADVANCED`, actual `ADVANCED`
- PASS pedagogicalStrategy.strategyExplanation: expected `non-empty`, actual `Le systeme propose une strategie avancee car le profil indique une bonne maitrise.`
- PASS pedagogicalStrategy.recommendedSequence: expected `non-empty`, actual `RESOURCE,CHALLENGE,FORMATIVE`
- PASS pedagogicalStrategy.tutoringMessageHint: expected `non-empty`, actual `Proposer un defi ou une activite d'approfondissement.`

Learner profile:
```json
{
  "learnerEmail": "student.v5.high@test.local",
  "masteryScore": 95.12,
  "knowledgeGaps": [],
  "masteredConceptsCount": 7,
  "weakConceptsCount": 0,
  "tracesCount": 4,
  "completedLabsCount": 0,
  "averageAssessmentScore": 95.75,
  "totalLearningTime": 1020,
  "profileType": "HIGH_PERFORMING",
  "profileExplanation": "Le profil indique une bonne maitrise des concepts evalues."
}
```

Pedagogical strategy:
```json
{
  "strategyType": "ADVANCED",
  "strategyExplanation": "Le systeme propose une strategie avancee car le profil indique une bonne maitrise.",
  "recommendedSequence": [
    "RESOURCE",
    "CHALLENGE",
    "FORMATIVE"
  ],
  "constraints": [
    "Respecter la decision principale du moteur: COMPLETED."
  ],
  "tutoringMessageHint": "Proposer un defi ou une activite d'approfondissement."
}
```
