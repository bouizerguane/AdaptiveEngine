# Scoring explicable - Runtime Test Report

Generated at: 2026-05-20T08:36:52.703Z
API: http://localhost:8080/api
Duration: 19376 ms

| Case | Status | Expected | Actual |
| --- | --- | --- | --- |
| Case A1 - Apprenant fort avec lacune | PASS | {"nextAction":"REMEDIATION","nextConceptContains":"Fonctions","explanationReasons":"non-empty","decisionExplanation":"non-empty"} | {"nextAction":"REMEDIATION","nextConcept":{"conceptName":"Fonctions","type":"INTERNAL","status":"TO_REVIEW","adaptiveScore":null,"scoreBreakdown":null,"explanationReasons":["Le concept 'Fonctions' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.","Cette remédiation vise à consolider une lacune avant de poursuivre la progression."]},"decisionExplanation":"Une activité de remédiation est proposée sur 'Fonctions' en raison de lacunes identifiées dans le dernier diagnostic.","scoringVersion":"RULE_BASED_EXPLAINABLE"} |
| Case A2 - Apprenant fort sans lacune | PASS | {"nextAction":"LEARN","nextConcept":"non-null","nextConceptStatus":"LEARNABLE","adaptiveScore":"present","scoreBreakdown":"present","explanationReasons":"non-empty","learnableConceptsSorted":"adaptiveScore descending"} | {"nextAction":"LEARN","nextConcept":{"conceptName":"Tableaux","type":"INTERNAL","status":"LEARNABLE","adaptiveScore":0.69,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.29,"engagementScore":0.7},"explanationReasons":["Le concept 'Tableaux' est accessible car les prérequis requis sont satisfaits.","L'historique récent montre une progression suffisante pour aborder cette étape."]},"learnableScores":[{"conceptName":"Tableaux","adaptiveScore":0.69,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.29,"engagementScore":0.7}},{"conceptName":"Entrées/Sorties","adaptiveScore":0.58,"scoreBreakdown":{"prerequisiteScore":0.5,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.71,"engagementScore":0.7}}],"decisionExplanation":"Le concept 'Tableaux' est le candidat accessible le plus pertinent selon les critères actuels du parcours adaptatif.","scoringVersion":"RULE_BASED_EXPLAINABLE"} |
| Case B - Apprenant faible | PASS | {"nextAction":"REMEDIATION","nextConcept":"Variables","explanation":"present"} | {"nextAction":"REMEDIATION","nextConcept":{"conceptName":"Variables","type":"INTERNAL","status":"TO_REVIEW","adaptiveScore":null,"scoreBreakdown":null,"explanationReasons":["Le concept 'Variables' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.","Cette remédiation vise à consolider une lacune avant de poursuivre la progression."]},"decisionExplanation":"Une activité de remédiation est proposée sur 'Variables' en raison de lacunes identifiées dans le dernier diagnostic."} |
| Case C - Concept externe | PASS | {"nextAction":"REMEDIATION","nextConceptType":"EXTERNAL","nextConceptName":"Pointeurs","frontendRoute":"/learner/external-concepts/:conceptId"} | {"nextAction":"REMEDIATION","nextConcept":{"conceptName":"Pointeurs","type":"EXTERNAL","status":"TO_REVIEW","adaptiveScore":null,"scoreBreakdown":null,"explanationReasons":["Le concept 'Pointeurs' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.","Cette remédiation vise à consolider une lacune avant de poursuivre la progression."]},"expectedFrontendRoute":"/learner/external-concepts/external-pointeurs-runtime-test","decisionExplanation":"Une activité de remédiation est proposée sur 'Pointeurs' en raison de lacunes identifiées dans le dernier diagnostic."} |
| Case D - Engagement influence ranking | PASS | {"activeEngagementScore":"> passiveEngagementScore","activeAdaptiveScore":"> passiveAdaptiveScore for same recommendation context"} | {"active":{"learnerEmail":"student.scoring.engagement@test.local","nextConcept":{"conceptName":"Conditions","type":"INTERNAL","status":"LEARNABLE","adaptiveScore":0.76,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":1,"pedagogicalOrderScore":0.57,"engagementScore":1},"explanationReasons":["Le concept 'Conditions' est accessible car les prérequis requis sont satisfaits.","Ce choix respecte l'ordre pédagogique prévu dans le cours.","L'historique récent montre une progression suffisante pour aborder cette étape.","L'activité récente sur les TP indique une dynamique favorable pour poursuivre l'apprentissage."]},"engagementScore":1,"adaptiveScore":0.76},"passive":{"learnerEmail":"student.scoring.external@test.local","comparedConcept":{"conceptName":"Conditions","type":"INTERNAL","status":"LEARNABLE","adaptiveScore":0.65,"scoreBreakdown":{"prerequisiteScore":1,"diagnosticWeaknessScore":0.3,"historicalPerformanceScore":0.7,"pedagogicalOrderScore":0.57,"engagementScore":0.3},"explanationReasons":["Le concept 'Conditions' est accessible car les prérequis requis sont satisfaits.","Ce choix respecte l'ordre pédagogique prévu dans le cours.","L'historique récent montre une progression suffisante pour aborder cette étape.","Le système privilégie un apprentissage progressif adapté au rythme observé."]},"engagementScore":0.3,"adaptiveScore":0.65},"scoreDifference":0.11} |

## Case A1 - Apprenant fort avec lacune - PASS

Assertions:
- PASS nextAction: expected `REMEDIATION`, actual `REMEDIATION`
- PASS nextConcept contains Fonctions: expected `contains Fonctions`, actual `Fonctions`
- PASS explanationReasons: expected `non-empty`, actual `Le concept 'Fonctions' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.,Cette remédiation vise à consolider une lacune avant de poursuivre la progression.`
- PASS decisionExplanation: expected `non-empty`, actual `Une activité de remédiation est proposée sur 'Fonctions' en raison de lacunes identifiées dans le dernier diagnostic.`

Score breakdown / explanations:
```json
{
  "nextAction": "REMEDIATION",
  "decisionExplanation": "Une activité de remédiation est proposée sur 'Fonctions' en raison de lacunes identifiées dans le dernier diagnostic.",
  "nextConcept": {
    "conceptName": "Fonctions",
    "type": "INTERNAL",
    "status": "TO_REVIEW",
    "adaptiveScore": null,
    "scoreBreakdown": null,
    "explanationReasons": [
      "Le concept 'Fonctions' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.",
      "Cette remédiation vise à consolider une lacune avant de poursuivre la progression."
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
        "Le concept 'Tableaux' est accessible car les prérequis requis sont satisfaits.",
        "L'historique récent montre une progression suffisante pour aborder cette étape."
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
        "Le concept 'Entrées/Sorties' peut être abordé car aucun prérequis bloquant n'est déclaré.",
        "Ce choix respecte l'ordre pédagogique prévu dans le cours.",
        "L'historique récent montre une progression suffisante pour aborder cette étape."
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
- PASS explanationReasons: expected `non-empty`, actual `Le concept 'Tableaux' est accessible car les prérequis requis sont satisfaits.,L'historique récent montre une progression suffisante pour aborder cette étape.`
- PASS learnableConcepts sorted by adaptiveScore desc: expected `true`, actual `true`

Score breakdown / explanations:
```json
{
  "nextAction": "LEARN",
  "decisionExplanation": "Le concept 'Tableaux' est le candidat accessible le plus pertinent selon les critères actuels du parcours adaptatif.",
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
      "Le concept 'Tableaux' est accessible car les prérequis requis sont satisfaits.",
      "L'historique récent montre une progression suffisante pour aborder cette étape."
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
        "Le concept 'Tableaux' est accessible car les prérequis requis sont satisfaits.",
        "L'historique récent montre une progression suffisante pour aborder cette étape."
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
        "Le concept 'Entrées/Sorties' peut être abordé car aucun prérequis bloquant n'est déclaré.",
        "Ce choix respecte l'ordre pédagogique prévu dans le cours.",
        "L'historique récent montre une progression suffisante pour aborder cette étape."
      ]
    }
  ]
}
```

## Case B - Apprenant faible - PASS

Assertions:
- PASS nextAction: expected `REMEDIATION`, actual `REMEDIATION`
- PASS nextConcept = Variables: expected `contains Variables`, actual `Variables`
- PASS explanationReasons: expected `non-empty`, actual `Le concept 'Variables' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.,Cette remédiation vise à consolider une lacune avant de poursuivre la progression.`
- PASS decisionExplanation: expected `non-empty`, actual `Une activité de remédiation est proposée sur 'Variables' en raison de lacunes identifiées dans le dernier diagnostic.`

Score breakdown / explanations:
```json
{
  "nextAction": "REMEDIATION",
  "decisionExplanation": "Une activité de remédiation est proposée sur 'Variables' en raison de lacunes identifiées dans le dernier diagnostic.",
  "nextConcept": {
    "conceptName": "Variables",
    "type": "INTERNAL",
    "status": "TO_REVIEW",
    "adaptiveScore": null,
    "scoreBreakdown": null,
    "explanationReasons": [
      "Le concept 'Variables' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.",
      "Cette remédiation vise à consolider une lacune avant de poursuivre la progression."
    ]
  },
  "learnableConcepts": [
    {
      "conceptName": "Variables",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.64,
      "scoreBreakdown": {
        "prerequisiteScore": 0.5,
        "diagnosticWeaknessScore": 1,
        "historicalPerformanceScore": 0.4,
        "pedagogicalOrderScore": 0.86,
        "engagementScore": 0.3
      },
      "explanationReasons": [
        "Le concept 'Variables' peut être abordé car aucun prérequis bloquant n'est déclaré.",
        "Le dernier diagnostic signale que 'Variables' nécessite un renforcement.",
        "Ce choix respecte l'ordre pédagogique prévu dans le cours.",
        "Cette recommandation tient compte des difficultés observées dans les activités précédentes.",
        "Le système privilégie un apprentissage progressif adapté au rythme observé."
      ]
    },
    {
      "conceptName": "Entrées/Sorties",
      "type": "INTERNAL",
      "status": "LEARNABLE",
      "adaptiveScore": 0.45,
      "scoreBreakdown": {
        "prerequisiteScore": 0.5,
        "diagnosticWeaknessScore": 0.3,
        "historicalPerformanceScore": 0.4,
        "pedagogicalOrderScore": 0.71,
        "engagementScore": 0.3
      },
      "explanationReasons": [
        "Le concept 'Entrées/Sorties' peut être abordé car aucun prérequis bloquant n'est déclaré.",
        "Ce choix respecte l'ordre pédagogique prévu dans le cours.",
        "Cette recommandation tient compte des difficultés observées dans les activités précédentes.",
        "Le système privilégie un apprentissage progressif adapté au rythme observé."
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
  "decisionExplanation": "Une activité de remédiation est proposée sur 'Pointeurs' en raison de lacunes identifiées dans le dernier diagnostic.",
  "nextConcept": {
    "conceptName": "Pointeurs",
    "type": "EXTERNAL",
    "status": "TO_REVIEW",
    "adaptiveScore": null,
    "scoreBreakdown": null,
    "explanationReasons": [
      "Le concept 'Pointeurs' est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.",
      "Cette remédiation vise à consolider une lacune avant de poursuivre la progression."
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
      "Le concept 'Conditions' est accessible car les prérequis requis sont satisfaits.",
      "Ce choix respecte l'ordre pédagogique prévu dans le cours.",
      "L'historique récent montre une progression suffisante pour aborder cette étape.",
      "L'activité récente sur les TP indique une dynamique favorable pour poursuivre l'apprentissage."
    ]
  },
  "passive": {
    "conceptName": "Conditions",
    "type": "INTERNAL",
    "status": "LEARNABLE",
    "adaptiveScore": 0.65,
    "scoreBreakdown": {
      "prerequisiteScore": 1,
      "diagnosticWeaknessScore": 0.3,
      "historicalPerformanceScore": 0.7,
      "pedagogicalOrderScore": 0.57,
      "engagementScore": 0.3
    },
    "explanationReasons": [
      "Le concept 'Conditions' est accessible car les prérequis requis sont satisfaits.",
      "Ce choix respecte l'ordre pédagogique prévu dans le cours.",
      "L'historique récent montre une progression suffisante pour aborder cette étape.",
      "Le système privilégie un apprentissage progressif adapté au rythme observé."
    ]
  }
}
```
