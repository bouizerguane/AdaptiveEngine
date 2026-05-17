# Feedback tutorat - Runtime Test Report

Generated at: 2026-05-17T19:33:31.078Z
API: http://localhost:8080/api
Endpoint: POST /api/tutoring/feedback
Duration: 365 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| Feedback tutorat - RECOVERY | PASS | {"strategyType":"RECOVERY","feedbackType":"REMEDIATION_FEEDBACK"} | {"eventType":"DIAGNOSTIC_FAILED","feedbackType":"REMEDIATION_FEEDBACK","message":"Des lacunes ont ete detectees sur Variables. Il est recommande de revoir la ressource avant de refaire le TP puis l'evaluation formative.","actions":["Revoir la ressource","Reprendre les prerequis","Realiser ou refaire le TP","Passer l'evaluation formative"],"recommendedActions":["Revoir la ressource","Reprendre les prerequis","Realiser ou refaire le TP","Passer l'evaluation formative"],"learningSequence":["RESOURCE","REVIEW","LAB","FORMATIVE"],"motivationalMessage":"Cette etape sert a consolider vos bases avant de continuer.","explanation":"La strategie RECOVERY est appliquee car le parcours signale une remediation ou des lacunes. Contexte utilise: profil=NEEDS_REMEDIATION; action=REMEDIATION; evaluation=DIAGNOSTIC_ENTREE; score=38.0; lacunes=Variables."} |
| Feedback tutorat - SUPPORTIVE | PASS | {"strategyType":"SUPPORTIVE","feedbackType":"GUIDED_SUPPORT"} | {"eventType":"GENERAL","feedbackType":"GUIDED_SUPPORT","message":"Le systeme vous propose une progression guidee afin de collecter davantage d'indices sur votre apprentissage.","actions":["Consulter la ressource","Realiser une activite guidee","Passer l'evaluation formative"],"recommendedActions":["Consulter la ressource","Realiser une activite guidee","Passer l'evaluation formative"],"learningSequence":["RESOURCE","LAB","FORMATIVE"],"motivationalMessage":"Avancez etape par etape ; vos prochaines activites aideront a personnaliser davantage le parcours.","explanation":"La strategie SUPPORTIVE est appliquee car les donnees disponibles restent limitees. Contexte utilise: profil=DATA_INSUFFICIENT; action=PASS_DIAGNOSTIC; evaluation=FORMATIVE; score=92.0."} |
| Feedback tutorat - STANDARD | PASS | {"strategyType":"STANDARD","feedbackType":"STANDARD_GUIDANCE"} | {"eventType":"GENERAL","feedbackType":"STANDARD_GUIDANCE","message":"Vous pouvez suivre la sequence normale : consulter la ressource, realiser le TP, puis passer l'evaluation formative.","actions":["Consulter la ressource","Realiser le TP","Passer l'evaluation formative"],"recommendedActions":["Consulter la ressource","Realiser le TP","Passer l'evaluation formative"],"learningSequence":["RESOURCE","LAB","FORMATIVE"],"motivationalMessage":"Continuez votre progression.","explanation":"La strategie STANDARD accompagne le parcours recommande sans remediation specifique. Contexte utilise: profil=PROGRESSING; action=LEARN; evaluation=FORMATIVE; score=92.0."} |
| Feedback tutorat - ADVANCED | PASS | {"strategyType":"ADVANCED","feedbackType":"ENRICHMENT_FEEDBACK"} | {"eventType":"CONCEPT_MASTERED","feedbackType":"ENRICHMENT_FEEDBACK","message":"Votre profil indique une bonne maitrise. Vous pouvez aborder Variables avec une activite plus avancee.","actions":["Consulter rapidement la ressource","Tenter un defi","Valider par l'evaluation formative"],"recommendedActions":["Consulter rapidement la ressource","Tenter un defi","Valider par l'evaluation formative"],"learningSequence":["RESOURCE","CHALLENGE","FORMATIVE"],"motivationalMessage":"Essayez d'aller plus loin avec un defi ou une variante du TP.","explanation":"La strategie ADVANCED est appliquee car le profil indique une bonne maitrise. Contexte utilise: profil=HIGH_PERFORMING; action=COMPLETED; evaluation=FORMATIVE; score=92.0."} |
| Feedback tutorat - Fallback sans strategyType | PASS | {"eventType":"DIAGNOSTIC_FAILED","message":"eventType historique"} | {"eventType":"DIAGNOSTIC_FAILED","feedbackType":null,"message":"Le diagnostic montre une lacune sur Variables. Commencez par revoir la ressource, puis consolidez avec le TP avant de passer l'evaluation formative.","actions":["Revoir la ressource du concept","Realiser ou refaire le TP","Passer l'evaluation formative"],"recommendedActions":[],"learningSequence":[],"motivationalMessage":null,"explanation":null} |

## Feedback tutorat - RECOVERY - PASS

Assertions:
- PASS feedbackType: expected `"REMEDIATION_FEEDBACK"`, actual `"REMEDIATION_FEEDBACK"`
- PASS eventType: expected `"DIAGNOSTIC_FAILED"`, actual `"DIAGNOSTIC_FAILED"`
- PASS message: expected `"non-empty"`, actual `"Des lacunes ont ete detectees sur Variables. Il est recommande de revoir la ressource avant de refaire le TP puis l'evaluation formative."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Revoir la ressource","Reprendre les prerequis","Realiser ou refaire le TP","Passer l'evaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","REVIEW","LAB","FORMATIVE"]`, actual `["RESOURCE","REVIEW","LAB","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Cette etape sert a consolider vos bases avant de continuer."`
- PASS explanation: expected `"non-empty"`, actual `"La strategie RECOVERY est appliquee car le parcours signale une remediation ou des lacunes. Contexte utilise: profil=NEEDS_REMEDIATION; action=REMEDIATION; evaluation=DIAGNOSTIC_ENTREE; score=38.0; lacunes=Variables."`

Feedback response:
```json
{
  "eventType": "DIAGNOSTIC_FAILED",
  "feedbackType": "REMEDIATION_FEEDBACK",
  "message": "Des lacunes ont ete detectees sur Variables. Il est recommande de revoir la ressource avant de refaire le TP puis l'evaluation formative.",
  "actions": [
    "Revoir la ressource",
    "Reprendre les prerequis",
    "Realiser ou refaire le TP",
    "Passer l'evaluation formative"
  ],
  "recommendedActions": [
    "Revoir la ressource",
    "Reprendre les prerequis",
    "Realiser ou refaire le TP",
    "Passer l'evaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "REVIEW",
    "LAB",
    "FORMATIVE"
  ],
  "motivationalMessage": "Cette etape sert a consolider vos bases avant de continuer.",
  "explanation": "La strategie RECOVERY est appliquee car le parcours signale une remediation ou des lacunes. Contexte utilise: profil=NEEDS_REMEDIATION; action=REMEDIATION; evaluation=DIAGNOSTIC_ENTREE; score=38.0; lacunes=Variables."
}
```

## Feedback tutorat - SUPPORTIVE - PASS

Assertions:
- PASS feedbackType: expected `"GUIDED_SUPPORT"`, actual `"GUIDED_SUPPORT"`
- PASS eventType: expected `"GENERAL"`, actual `"GENERAL"`
- PASS message: expected `"non-empty"`, actual `"Le systeme vous propose une progression guidee afin de collecter davantage d'indices sur votre apprentissage."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Consulter la ressource","Realiser une activite guidee","Passer l'evaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","LAB","FORMATIVE"]`, actual `["RESOURCE","LAB","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Avancez etape par etape ; vos prochaines activites aideront a personnaliser davantage le parcours."`
- PASS explanation: expected `"non-empty"`, actual `"La strategie SUPPORTIVE est appliquee car les donnees disponibles restent limitees. Contexte utilise: profil=DATA_INSUFFICIENT; action=PASS_DIAGNOSTIC; evaluation=FORMATIVE; score=92.0."`

Feedback response:
```json
{
  "eventType": "GENERAL",
  "feedbackType": "GUIDED_SUPPORT",
  "message": "Le systeme vous propose une progression guidee afin de collecter davantage d'indices sur votre apprentissage.",
  "actions": [
    "Consulter la ressource",
    "Realiser une activite guidee",
    "Passer l'evaluation formative"
  ],
  "recommendedActions": [
    "Consulter la ressource",
    "Realiser une activite guidee",
    "Passer l'evaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "motivationalMessage": "Avancez etape par etape ; vos prochaines activites aideront a personnaliser davantage le parcours.",
  "explanation": "La strategie SUPPORTIVE est appliquee car les donnees disponibles restent limitees. Contexte utilise: profil=DATA_INSUFFICIENT; action=PASS_DIAGNOSTIC; evaluation=FORMATIVE; score=92.0."
}
```

## Feedback tutorat - STANDARD - PASS

Assertions:
- PASS feedbackType: expected `"STANDARD_GUIDANCE"`, actual `"STANDARD_GUIDANCE"`
- PASS eventType: expected `"GENERAL"`, actual `"GENERAL"`
- PASS message: expected `"non-empty"`, actual `"Vous pouvez suivre la sequence normale : consulter la ressource, realiser le TP, puis passer l'evaluation formative."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Consulter la ressource","Realiser le TP","Passer l'evaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","LAB","FORMATIVE"]`, actual `["RESOURCE","LAB","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Continuez votre progression."`
- PASS explanation: expected `"non-empty"`, actual `"La strategie STANDARD accompagne le parcours recommande sans remediation specifique. Contexte utilise: profil=PROGRESSING; action=LEARN; evaluation=FORMATIVE; score=92.0."`

Feedback response:
```json
{
  "eventType": "GENERAL",
  "feedbackType": "STANDARD_GUIDANCE",
  "message": "Vous pouvez suivre la sequence normale : consulter la ressource, realiser le TP, puis passer l'evaluation formative.",
  "actions": [
    "Consulter la ressource",
    "Realiser le TP",
    "Passer l'evaluation formative"
  ],
  "recommendedActions": [
    "Consulter la ressource",
    "Realiser le TP",
    "Passer l'evaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "LAB",
    "FORMATIVE"
  ],
  "motivationalMessage": "Continuez votre progression.",
  "explanation": "La strategie STANDARD accompagne le parcours recommande sans remediation specifique. Contexte utilise: profil=PROGRESSING; action=LEARN; evaluation=FORMATIVE; score=92.0."
}
```

## Feedback tutorat - ADVANCED - PASS

Assertions:
- PASS feedbackType: expected `"ENRICHMENT_FEEDBACK"`, actual `"ENRICHMENT_FEEDBACK"`
- PASS eventType: expected `"CONCEPT_MASTERED"`, actual `"CONCEPT_MASTERED"`
- PASS message: expected `"non-empty"`, actual `"Votre profil indique une bonne maitrise. Vous pouvez aborder Variables avec une activite plus avancee."`
- PASS recommendedActions: expected `"non-empty"`, actual `["Consulter rapidement la ressource","Tenter un defi","Valider par l'evaluation formative"]`
- PASS learningSequence: expected `["RESOURCE","CHALLENGE","FORMATIVE"]`, actual `["RESOURCE","CHALLENGE","FORMATIVE"]`
- PASS motivationalMessage: expected `"non-empty"`, actual `"Essayez d'aller plus loin avec un defi ou une variante du TP."`
- PASS explanation: expected `"non-empty"`, actual `"La strategie ADVANCED est appliquee car le profil indique une bonne maitrise. Contexte utilise: profil=HIGH_PERFORMING; action=COMPLETED; evaluation=FORMATIVE; score=92.0."`

Feedback response:
```json
{
  "eventType": "CONCEPT_MASTERED",
  "feedbackType": "ENRICHMENT_FEEDBACK",
  "message": "Votre profil indique une bonne maitrise. Vous pouvez aborder Variables avec une activite plus avancee.",
  "actions": [
    "Consulter rapidement la ressource",
    "Tenter un defi",
    "Valider par l'evaluation formative"
  ],
  "recommendedActions": [
    "Consulter rapidement la ressource",
    "Tenter un defi",
    "Valider par l'evaluation formative"
  ],
  "learningSequence": [
    "RESOURCE",
    "CHALLENGE",
    "FORMATIVE"
  ],
  "motivationalMessage": "Essayez d'aller plus loin avec un defi ou une variante du TP.",
  "explanation": "La strategie ADVANCED est appliquee car le profil indique une bonne maitrise. Contexte utilise: profil=HIGH_PERFORMING; action=COMPLETED; evaluation=FORMATIVE; score=92.0."
}
```

## Feedback tutorat - Fallback sans strategyType - PASS

Assertions:
- PASS eventType: expected `"DIAGNOSTIC_FAILED"`, actual `"DIAGNOSTIC_FAILED"`
- PASS fallback feedbackType absent: expected `true`, actual `true`
- PASS message: expected `"non-empty"`, actual `"Le diagnostic montre une lacune sur Variables. Commencez par revoir la ressource, puis consolidez avec le TP avant de passer l'evaluation formative."`
- PASS actions: expected `"non-empty"`, actual `["Revoir la ressource du concept","Realiser ou refaire le TP","Passer l'evaluation formative"]`

Feedback response:
```json
{
  "eventType": "DIAGNOSTIC_FAILED",
  "feedbackType": null,
  "message": "Le diagnostic montre une lacune sur Variables. Commencez par revoir la ressource, puis consolidez avec le TP avant de passer l'evaluation formative.",
  "actions": [
    "Revoir la ressource du concept",
    "Realiser ou refaire le TP",
    "Passer l'evaluation formative"
  ],
  "recommendedActions": [],
  "learningSequence": [],
  "motivationalMessage": null,
  "explanation": null
}
```
