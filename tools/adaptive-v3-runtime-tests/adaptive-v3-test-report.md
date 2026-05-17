# Adaptive Engine V3 Runtime Test Report

Generated at: 2026-05-17T10:16:56.645Z
API: http://localhost:8080/api
Duration: 6963 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| Case A1 - Apprenant fort avec lacune | PASS | {"nextAction":"REMEDIATION","nextConceptContains":"Fonctions","explanationReasons":"non-empty","decisionExplanation":"non-empty"} | {"nextAction":"REMEDIATION","nextConcept":{"conceptName":"Fonctions","type":"INTERNAL","status":"TO_REVIEW","adaptiveScore":null,"scoreBreakdown":null,"explanationReasons":["Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."]},"decisionExplanation":"La priorite est donnee au concept non maitrise lors du dernier diagnostic.","scoringVersion":"V3_RULE_BASED_EXPLAINABLE"} |
| Case A2 - Apprenant fort sans lacune | PASS | {"nextAction":"LEARN","nextConcept":"non-null","nextConceptStatus":"LEARNABLE","adaptiveScore":"present","scoreBreakdown":"present","explanationReasons":"non-empty","learnableConceptsSorted":"adaptiveScore descending"} | {"nextAction":"LEARN","nextConcept":{"conceptName":"Tableaux","type":"INTERNAL","status":"LEARNABLE","adaptiveScore":0.69,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.29,"engagementScore":0.7},"explanationReasons":["Tous les prerequis de ce concept sont satisfaits.","Votre historique recent montre une progression suffisante."]},"learnableScores":[{"conceptName":"Tableaux","adaptiveScore":0.69,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.29,"engagementScore":0.7}},{"conceptName":"Entrées/Sorties","adaptiveScore":0.58,"scoreBreakdown":{"prerequisiteScore":0.5,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.71,"engagementScore":0.7}}],"decisionExplanation":"Le concept recommande est celui qui obtient le meilleur score adaptatif parmi les concepts accessibles.","scoringVersion":"V3_RULE_BASED_EXPLAINABLE"} |
| Case B - Apprenant faible | PASS | {"nextAction":"REMEDIATION","nextConcept":"Variables","explanation":"present"} | {"nextAction":"REMEDIATION","nextConcept":{"conceptName":"Variables","type":"INTERNAL","status":"TO_REVIEW","adaptiveScore":null,"scoreBreakdown":null,"explanationReasons":["Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."]},"decisionExplanation":"La priorite est donnee au concept non maitrise lors du dernier diagnostic."} |
| Case C - Concept externe | PASS | {"nextAction":"REMEDIATION","nextConceptType":"EXTERNAL","nextConceptName":"Pointeurs","frontendRoute":"/learner/external-concepts/:conceptId"} | {"nextAction":"REMEDIATION","nextConcept":{"conceptName":"Pointeurs","type":"EXTERNAL","status":"TO_REVIEW","adaptiveScore":null,"scoreBreakdown":null,"explanationReasons":["Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."]},"expectedFrontendRoute":"/learner/external-concepts/external-pointeurs-runtime-test","decisionExplanation":"La priorite est donnee au concept non maitrise lors du dernier diagnostic."} |
| Case D - Engagement influence ranking | PASS | {"activeEngagementScore":"> passiveEngagementScore","activeAdaptiveScore":"> passiveAdaptiveScore for same recommendation context"} | {"active":{"learnerEmail":"student.v3.engagement@test.local","nextConcept":{"conceptName":"Conditions","type":"INTERNAL","status":"LEARNABLE","adaptiveScore":0.76,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.57,"engagementScore":1},"explanationReasons":["Tous les prerequis de ce concept sont satisfaits.","Ce concept suit l'ordre pedagogique recommande.","Votre historique recent montre une progression suffisante.","Votre activite recente sur les TP permet d'aborder ce concept maintenant."]},"engagementScore":1,"adaptiveScore":0.76},"passive":{"learnerEmail":"student.v3.external@test.local","comparedConcept":{"conceptName":"Conditions","type":"INTERNAL","status":"LEARNABLE","adaptiveScore":0.69,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":0.7,"pedagogicalOrderScore":0.57,"engagementScore":0.7},"explanationReasons":["Tous les prerequis de ce concept sont satisfaits.","Ce concept suit l'ordre pedagogique recommande.","Votre historique recent montre une progression suffisante."]},"engagementScore":0.7,"adaptiveScore":0.69},"scoreDifference":0.07} |

## Case A1 - Apprenant fort avec lacune - PASS

Assertions:
- PASS nextAction: expected `REMEDIATION`, actual `REMEDIATION`
- PASS nextConcept contains Fonctions: expected `contains Fonctions`, actual `Fonctions`
- PASS explanationReasons: expected `non-empty`, actual `Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic.`
- PASS decisionExplanation: expected `non-empty`, actual `La priorite est donnee au concept non maitrise lors du dernier diagnostic.`

Score breakdown / explanations:
```json
{
  "nextAction": "REMEDIATION",
  "decisionExplanation": "La priorite est donnee au concept non maitrise lors du dernier diagnostic.",
  "nextConcept": {
    "conceptName": "Fonctions",
    "type": "INTERNAL",
    "status": "TO_REVIEW",
    "adaptiveScore": null,
    "scoreBreakdown": null,
    "explanationReasons": [
      "Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."
    ]
  },
  "learnableConcepts": [
    {
      "conceptName": "Tableaux",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.69,
      "scoreBreakdown": {
        "prerequisiteScore": 1,
        "diagnosticWeaknessScore": 0.3,
        "historicalPerformanceScore": 1,
        "pedagogicalOrderScore": 0.29,
        "engagementScore": 0.7
      },
      "explanationReasons": [
        "Tous les prerequis de ce concept sont satisfaits.",
        "Votre historique recent montre une progression suffisante."
      ]
    },
    {
      "conceptName": "Entrées/Sorties",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.58,
      "scoreBreakdown": {
        "prerequisiteScore": 0.5,
        "diagnosticWeaknessScore": 0.3,
        "historicalPerformanceScore": 1,
        "pedagogicalOrderScore": 0.71,
        "engagementScore": 0.7
      },
      "explanationReasons": [
        "Ce concept peut etre aborde sans prerequis declares.",
        "Ce concept suit l'ordre pedagogique recommande.",
        "Votre historique recent montre une progression suffisante."
      ]
    }
  ]
}
```

## Case A2 - Apprenant fort sans lacune - PASS

Assertions:
- PASS nextAction: expected `LEARN`, actual `LEARN`
- PASS nextConcept non null: expected `true`, actual `true`
- PASS nextConcept.status: expected `LEARNABLE`, actual `LEARNABLE`
- PASS adaptiveScore present: expected `true`, actual `true`
- PASS scoreBreakdown present: expected `true`, actual `true`
- PASS explanationReasons: expected `non-empty`, actual `Tous les prerequis de ce concept sont satisfaits.,Votre historique recent montre une progression suffisante.`
- PASS learnableConcepts sorted by adaptiveScore desc: expected `true`, actual `true`

Score breakdown / explanations:
```json
{
  "nextAction": "LEARN",
  "decisionExplanation": "Le concept recommande est celui qui obtient le meilleur score adaptatif parmi les concepts accessibles.",
  "nextConcept": {
    "conceptName": "Tableaux",
    "type": "INTERNAL",
    "status": "LEARNABLE",
    "adaptiveScore": 0.69,
    "scoreBreakdown": {
      "prerequisiteScore": 1,
      "diagnosticWeaknessScore": 0.3,
      "historicalPerformanceScore": 1,
      "pedagogicalOrderScore": 0.29,
      "engagementScore": 0.7
    },
    "explanationReasons": [
      "Tous les prerequis de ce concept sont satisfaits.",
      "Votre historique recent montre une progression suffisante."
    ]
  },
  "learnableConcepts": [
    {
      "conceptName": "Tableaux",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.69,
      "scoreBreakdown": {
        "prerequisiteScore": 1,
        "diagnosticWeaknessScore": 0.3,
        "historicalPerformanceScore": 1,
        "pedagogicalOrderScore": 0.29,
        "engagementScore": 0.7
      },
      "explanationReasons": [
        "Tous les prerequis de ce concept sont satisfaits.",
        "Votre historique recent montre une progression suffisante."
      ]
    },
    {
      "conceptName": "Entrées/Sorties",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.58,
      "scoreBreakdown": {
        "prerequisiteScore": 0.5,
        "diagnosticWeaknessScore": 0.3,
        "historicalPerformanceScore": 1,
        "pedagogicalOrderScore": 0.71,
        "engagementScore": 0.7
      },
      "explanationReasons": [
        "Ce concept peut etre aborde sans prerequis declares.",
        "Ce concept suit l'ordre pedagogique recommande.",
        "Votre historique recent montre une progression suffisante."
      ]
    }
  ]
}
```

## Case B - Apprenant faible - PASS

Assertions:
- PASS nextAction: expected `REMEDIATION`, actual `REMEDIATION`
- PASS nextConcept = Variables: expected `contains Variables`, actual `Variables`
- PASS explanationReasons: expected `non-empty`, actual `Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic.`
- PASS decisionExplanation: expected `non-empty`, actual `La priorite est donnee au concept non maitrise lors du dernier diagnostic.`

Score breakdown / explanations:
```json
{
  "nextAction": "REMEDIATION",
  "decisionExplanation": "La priorite est donnee au concept non maitrise lors du dernier diagnostic.",
  "nextConcept": {
    "conceptName": "Variables",
    "type": "INTERNAL",
    "status": "TO_REVIEW",
    "adaptiveScore": null,
    "scoreBreakdown": null,
    "explanationReasons": [
      "Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."
    ]
  },
  "learnableConcepts": [
    {
      "conceptName": "Variables",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.68,
      "scoreBreakdown": {
        "prerequisiteScore": 0.5,
        "diagnosticWeaknessScore": 1,
        "historicalPerformanceScore": 0.4,
        "pedagogicalOrderScore": 0.86,
        "engagementScore": 0.7
      },
      "explanationReasons": [
        "Ce concept peut etre aborde sans prerequis declares.",
        "Le dernier diagnostic indique que ce concept doit etre renforce.",
        "Ce concept suit l'ordre pedagogique recommande.",
        "Le moteur garde une progression prudente car les scores precedents sont faibles."
      ]
    },
    {
      "conceptName": "Entrées/Sorties",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.49,
      "scoreBreakdown": {
        "prerequisiteScore": 0.5,
        "diagnosticWeaknessScore": 0.3,
        "historicalPerformanceScore": 0.4,
        "pedagogicalOrderScore": 0.71,
        "engagementScore": 0.7
      },
      "explanationReasons": [
        "Ce concept peut etre aborde sans prerequis declares.",
        "Ce concept suit l'ordre pedagogique recommande.",
        "Le moteur garde une progression prudente car les scores precedents sont faibles."
      ]
    }
  ]
}
```

## Case C - Concept externe - PASS

Assertions:
- PASS nextAction: expected `REMEDIATION`, actual `REMEDIATION`
- PASS nextConcept.type: expected `EXTERNAL`, actual `EXTERNAL`
- PASS nextConcept.name: expected `contains Pointeurs`, actual `Pointeurs`
- PASS route externe attendue: expected `true`, actual `true`

Score breakdown / explanations:
```json
{
  "nextAction": "REMEDIATION",
  "decisionExplanation": "La priorite est donnee au concept non maitrise lors du dernier diagnostic.",
  "nextConcept": {
    "conceptName": "Pointeurs",
    "type": "EXTERNAL",
    "status": "TO_REVIEW",
    "adaptiveScore": null,
    "scoreBreakdown": null,
    "explanationReasons": [
      "Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."
    ]
  },
  "learnableConcepts": []
}
```

## Case D - Engagement influence ranking - PASS

Assertions:
- PASS engagementScore actif > passif: expected `true`, actual `true`
- PASS adaptiveScore actif > passif: expected `true`, actual `true`

Score breakdown / explanations:
```json
{
  "active": {
    "conceptName": "Conditions",
    "type": "INTERNAL",
    "status": "LEARNABLE",
    "adaptiveScore": 0.76,
    "scoreBreakdown": {
      "prerequisiteScore": 1,
      "diagnosticWeaknessScore": 0.3,
      "historicalPerformanceScore": 1,
      "pedagogicalOrderScore": 0.57,
      "engagementScore": 1
    },
    "explanationReasons": [
      "Tous les prerequis de ce concept sont satisfaits.",
      "Ce concept suit l'ordre pedagogique recommande.",
      "Votre historique recent montre une progression suffisante.",
      "Votre activite recente sur les TP permet d'aborder ce concept maintenant."
    ]
  },
  "passive": {
    "conceptName": "Conditions",
    "type": "INTERNAL",
    "status": "LEARNABLE",
    "adaptiveScore": 0.69,
    "scoreBreakdown": {
      "prerequisiteScore": 1,
      "diagnosticWeaknessScore": 0.3,
      "historicalPerformanceScore": 0.7,
      "pedagogicalOrderScore": 0.57,
      "engagementScore": 0.7
    },
    "explanationReasons": [
      "Tous les prerequis de ce concept sont satisfaits.",
      "Ce concept suit l'ordre pedagogique recommande.",
      "Votre historique recent montre une progression suffisante."
    ]
  }
}
```
