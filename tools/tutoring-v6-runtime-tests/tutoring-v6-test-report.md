# Feedback tutorat - Runtime Test Report

Generated at: 2026-05-20T08:37:18.391Z
API: http://localhost:8080/api
Endpoint: POST /api/tutoring/feedback
Duration: 1151 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| Feedback tutorat - RECOVERY | PASS | {"strategyType":"RECOVERY","feedbackType":"REMEDIATION_FEEDBACK"} | {"eventType":"DIAGNOSTIC_FAILED","feedbackType":"REMEDIATION_FEEDBACK","message":"Des lacunes ont été identifiées sur Variables. Une remédiation structurée est recommandée avant la poursuite du parcours.","actions":["Revoir la ressource","Reprendre les prérequis","Réaliser ou refaire le TP","Passer l'évaluation formative"],"recommendedActions":["Revoir la ressource","Reprendre les prérequis","Réaliser ou refaire le TP","Passer l'évaluation formative"],"learningSequence":["RESOURCE","REVIEW","LAB","FORMATIVE"],"motivationalMessage":"Cette étape consolide les bases nécessaires avant d'aborder de nouveaux concepts.","explanation":"Une approche de remédiation est appliquée car le parcours signale des lacunes à consolider. Contexte utilisé: profil=NEEDS_REMEDIATION; action=REMEDIATION; évaluation=DIAGNOSTIC_ENTREE; score=38.0; lacunes=Variables."} |
| Feedback tutorat - SUPPORTIVE | PASS | {"strategyType":"SUPPORTIVE","feedbackType":"GUIDED_SUPPORT"} | {"eventType":"GENERAL","feedbackType":"GUIDED_SUPPORT","message":"Une progression guidée est proposée afin d'accompagner l'apprentissage et de recueillir davantage d'indicateurs.","actions":["Consulter la ressource","Réaliser une activité guidée","Passer l'évaluation formative"],"recommendedActions":["Consulter la ressource","Réaliser une activité guidée","Passer l'évaluation formative"],"learningSequence":["RESOURCE","LAB","FORMATIVE"],"motivationalMessage":"Avancez étape par étape ; les prochaines activités permettront d'affiner l'accompagnement.","explanation":"Une approche guidée est appliquée car les données disponibles restent limitées. Contexte utilisé: profil=DATA_INSUFFICIENT; action=PASS_DIAGNOSTIC; évaluation=FORMATIVE; score=92.0."} |
| Feedback tutorat - STANDARD | PASS | {"strategyType":"STANDARD","feedbackType":"STANDARD_GUIDANCE"} | {"eventType":"GENERAL","feedbackType":"STANDARD_GUIDANCE","message":"Le parcours peut suivre la séquence pédagogique standard : ressource, pratique, puis évaluation formative.","actions":["Consulter la ressource","Réaliser le TP","Passer l'évaluation formative"],"recommendedActions":["Consulter la ressource","Réaliser le TP","Passer l'évaluation formative"],"learningSequence":["RESOURCE","LAB","FORMATIVE"],"motivationalMessage":"Continuez la progression selon l'ordre d'apprentissage prévu.","explanation":"Une approche standard accompagne le parcours recommandé sans remédiation spécifique. Contexte utilisé: profil=PROGRESSING; action=LEARN; évaluation=FORMATIVE; score=92.0."} |
| Feedback tutorat - ADVANCED | PASS | {"strategyType":"ADVANCED","feedbackType":"ENRICHMENT_FEEDBACK"} | {"eventType":"CONCEPT_MASTERED","feedbackType":"ENRICHMENT_FEEDBACK","message":"Le profil indique une maîtrise solide. Variables peut être abordé avec une activité d'approfondissement.","actions":["Consulter rapidement la ressource","Tenter un défi","Valider par l'évaluation formative"],"recommendedActions":["Consulter rapidement la ressource","Tenter un défi","Valider par l'évaluation formative"],"learningSequence":["RESOURCE","CHALLENGE","FORMATIVE"],"motivationalMessage":"Un défi ou une variante du TP permet d'étendre la maîtrise déjà observée.","explanation":"Une approche avancée est appliquée car le profil indique une bonne maîtrise. Contexte utilisé: profil=HIGH_PERFORMING; action=COMPLETED; évaluation=FORMATIVE; score=92.0."} |
| Feedback tutorat - Fallback sans strategyType | PASS | {"eventType":"DIAGNOSTIC_FAILED","message":"eventType historique"} | {"eventType":"DIAGNOSTIC_FAILED","feedbackType":null,"message":"Le diagnostic met en évidence une lacune sur Variables. Une consolidation est recommandée avant de poursuivre la progression.","actions":["Revoir la ressource du concept","Reprendre les prérequis associés","Réaliser le TP de consolidation","Passer l'évaluation formative"],"recommendedActions":[],"learningSequence":[],"motivationalMessage":null,"explanation":null} |

## Feedback tutorat - RECOVERY - PASS

Assertions:
- PASS feedbackType: expected `"REMEDIATION_FEEDBACK"`, actual `"REMEDIATION_FEEDBACK"`
- PASS eventType: expected `"DIAGNOSTIC_FAILED"`, actual `"DIAGNOSTIC_FAILED"`
- PASS message: expected `"non-empty"`, actual `"Des lacunes ont été identifiées sur Variables. Une remédiation structurée est recommandée avant la poursuite du parcours."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Revoir la ressource","Reprendre les prérequis","Réaliser ou refaire le TP","Passer l'évaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","REVIEW","LAB","FORMATIVE"]`, actual `["RESOURCE","REVIEW","LAB","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Cette étape consolide les bases nécessaires avant d'aborder de nouveaux concepts."`
- PASS explanation: expected `"non-empty"`, actual `"Une approche de remédiation est appliquée car le parcours signale des lacunes à consolider. Contexte utilisé: profil=NEEDS_REMEDIATION; action=REMEDIATION; évaluation=DIAGNOSTIC_ENTREE; score=38.0; lacunes=Variables."`

Feedback response:
```json
{
  "eventType": "DIAGNOSTIC_FAILED",
  "feedbackType": "REMEDIATION_FEEDBACK",
  "message": "Des lacunes ont été identifiées sur Variables. Une remédiation structurée est recommandée avant la poursuite du parcours.",
  "actions": [
    "Revoir la ressource",
    "Reprendre les prérequis",
    "Réaliser ou refaire le TP",
    "Passer l'évaluation formative"
  ],
  "recommendedActions": [
    "Revoir la ressource",
    "Reprendre les prérequis",
    "Réaliser ou refaire le TP",
    "Passer l'évaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "REVIEW",
    "LAB",
    "FORMATIVE"
  ],
  "motivationalMessage": "Cette étape consolide les bases nécessaires avant d'aborder de nouveaux concepts.",
  "explanation": "Une approche de remédiation est appliquée car le parcours signale des lacunes à consolider. Contexte utilisé: profil=NEEDS_REMEDIATION; action=REMEDIATION; évaluation=DIAGNOSTIC_ENTREE; score=38.0; lacunes=Variables."
}
```

## Feedback tutorat - SUPPORTIVE - PASS

Assertions:
- PASS feedbackType: expected `"GUIDED_SUPPORT"`, actual `"GUIDED_SUPPORT"`
- PASS eventType: expected `"GENERAL"`, actual `"GENERAL"`
- PASS message: expected `"non-empty"`, actual `"Une progression guidée est proposée afin d'accompagner l'apprentissage et de recueillir davantage d'indicateurs."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Consulter la ressource","Réaliser une activité guidée","Passer l'évaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","LAB","FORMATIVE"]`, actual `["RESOURCE","LAB","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Avancez étape par étape ; les prochaines activités permettront d'affiner l'accompagnement."`
- PASS explanation: expected `"non-empty"`, actual `"Une approche guidée est appliquée car les données disponibles restent limitées. Contexte utilisé: profil=DATA_INSUFFICIENT; action=PASS_DIAGNOSTIC; évaluation=FORMATIVE; score=92.0."`

Feedback response:
```json
{
  "eventType": "GENERAL",
  "feedbackType": "GUIDED_SUPPORT",
  "message": "Une progression guidée est proposée afin d'accompagner l'apprentissage et de recueillir davantage d'indicateurs.",
  "actions": [
    "Consulter la ressource",
    "Réaliser une activité guidée",
    "Passer l'évaluation formative"
  ],
  "recommendedActions": [
    "Consulter la ressource",
    "Réaliser une activité guidée",
    "Passer l'évaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "motivationalMessage": "Avancez étape par étape ; les prochaines activités permettront d'affiner l'accompagnement.",
  "explanation": "Une approche guidée est appliquée car les données disponibles restent limitées. Contexte utilisé: profil=DATA_INSUFFICIENT; action=PASS_DIAGNOSTIC; évaluation=FORMATIVE; score=92.0."
}
```

## Feedback tutorat - STANDARD - PASS

Assertions:
- PASS feedbackType: expected `"STANDARD_GUIDANCE"`, actual `"STANDARD_GUIDANCE"`
- PASS eventType: expected `"GENERAL"`, actual `"GENERAL"`
- PASS message: expected `"non-empty"`, actual `"Le parcours peut suivre la séquence pédagogique standard : ressource, pratique, puis évaluation formative."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Consulter la ressource","Réaliser le TP","Passer l'évaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","LAB","FORMATIVE"]`, actual `["RESOURCE","LAB","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Continuez la progression selon l'ordre d'apprentissage prévu."`
- PASS explanation: expected `"non-empty"`, actual `"Une approche standard accompagne le parcours recommandé sans remédiation spécifique. Contexte utilisé: profil=PROGRESSING; action=LEARN; évaluation=FORMATIVE; score=92.0."`

Feedback response:
```json
{
  "eventType": "GENERAL",
  "feedbackType": "STANDARD_GUIDANCE",
  "message": "Le parcours peut suivre la séquence pédagogique standard : ressource, pratique, puis évaluation formative.",
  "actions": [
    "Consulter la ressource",
    "Réaliser le TP",
    "Passer l'évaluation formative"
  ],
  "recommendedActions": [
    "Consulter la ressource",
    "Réaliser le TP",
    "Passer l'évaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "motivationalMessage": "Continuez la progression selon l'ordre d'apprentissage prévu.",
  "explanation": "Une approche standard accompagne le parcours recommandé sans remédiation spécifique. Contexte utilisé: profil=PROGRESSING; action=LEARN; évaluation=FORMATIVE; score=92.0."
}
```

## Feedback tutorat - ADVANCED - PASS

Assertions:
- PASS feedbackType: expected `"ENRICHMENT_FEEDBACK"`, actual `"ENRICHMENT_FEEDBACK"`
- PASS eventType: expected `"CONCEPT_MASTERED"`, actual `"CONCEPT_MASTERED"`
- PASS message: expected `"non-empty"`, actual `"Le profil indique une maîtrise solide. Variables peut être abordé avec une activité d'approfondissement."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Consulter rapidement la ressource","Tenter un défi","Valider par l'évaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","CHALLENGE","FORMATIVE"]`, actual `["RESOURCE","CHALLENGE","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Un défi ou une variante du TP permet d'étendre la maîtrise déjà observée."`
- PASS explanation: expected `"non-empty"`, actual `"Une approche avancée est appliquée car le profil indique une bonne maîtrise. Contexte utilisé: profil=HIGH_PERFORMING; action=COMPLETED; évaluation=FORMATIVE; score=92.0."`

Feedback response:
```json
{
  "eventType": "CONCEPT_MASTERED",
  "feedbackType": "ENRICHMENT_FEEDBACK",
  "message": "Le profil indique une maîtrise solide. Variables peut être abordé avec une activité d'approfondissement.",
  "actions": [
    "Consulter rapidement la ressource",
    "Tenter un défi",
    "Valider par l'évaluation formative"
  ],
  "recommendedActions": [
    "Consulter rapidement la ressource",
    "Tenter un défi",
    "Valider par l'évaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "CHALLENGE",
    "FORMATIVE"
  ],
  "motivationalMessage": "Un défi ou une variante du TP permet d'étendre la maîtrise déjà observée.",
  "explanation": "Une approche avancée est appliquée car le profil indique une bonne maîtrise. Contexte utilisé: profil=HIGH_PERFORMING; action=COMPLETED; évaluation=FORMATIVE; score=92.0."
}
```

## Feedback tutorat - Fallback sans strategyType - PASS

Assertions:
- PASS eventType: expected `"DIAGNOSTIC_FAILED"`, actual `"DIAGNOSTIC_FAILED"`
- PASS fallback feedbackType absent: expected `true`, actual `true`
- PASS message: expected `"non-empty"`, actual `"Le diagnostic met en évidence une lacune sur Variables. Une consolidation est recommandée avant de poursuivre la progression."`
- PASS actions: expected `"non-empty"`, actual `["Revoir la ressource du concept","Reprendre les prérequis associés","Réaliser le TP de consolidation","Passer l'évaluation formative"]`

Feedback response:
```json
{
  "eventType": "DIAGNOSTIC_FAILED",
  "feedbackType": null,
  "message": "Le diagnostic met en évidence une lacune sur Variables. Une consolidation est recommandée avant de poursuivre la progression.",
  "actions": [
    "Revoir la ressource du concept",
    "Reprendre les prérequis associés",
    "Réaliser le TP de consolidation",
    "Passer l'évaluation formative"
  ],
  "recommendedActions": [],
  "learningSequence": [],
  "motivationalMessage": null,
  "explanation": null
}
```
