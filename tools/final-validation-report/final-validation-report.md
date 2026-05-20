# Rapport final de validation AdaptiveEngine

Genere le: 2026-05-20T08:37:23.416Z

## Synthese globale

- Total tests: 20
- Total PASS: 20
- Total FAIL: 0
- Duree totale disponible: 29921 ms

## Resume par composant fonctionnel

| Composant | Portee | Tests | PASS | FAIL | Duree | Rapport source |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Scoring explicable | scoring explicable | 5 | 5 | 0 | 19376 ms | tools/adaptive-v3-runtime-tests/adaptive-v3-test-report.json |
| Profil apprenant | profil apprenant | 4 | 4 | 0 | 3001 ms | tools/adaptive-v4-runtime-tests/adaptive-v4-test-report.json |
| Strategie pedagogique | strategie pedagogique | 4 | 4 | 0 | 2868 ms | tools/adaptive-v5-runtime-tests/adaptive-v5-test-report.json |
| Feedback tutorat | feedback tutorat | 5 | 5 | 0 | 1151 ms | tools/tutoring-v6-runtime-tests/tutoring-v6-test-report.json |
| Rafraichissement evenementiel persistant | rafraichissement evenementiel persistant | 2 | 2 | 0 | 3525 ms | tools/runtime-validation/event-driven-refresh-tests/event-driven-refresh-test-report.json |

## Exemples de reponses importantes

### nextAction

```json
{
  "sourceComponent": "Scoring explicable",
  "caseName": "Case A1 - Apprenant fort avec lacune",
  "nextAction": "REMEDIATION",
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
  "decisionExplanation": "Une activité de remédiation est proposée sur 'Fonctions' en raison de lacunes identifiées dans le dernier diagnostic."
}
```

### learnerProfile

```json
{
  "sourceComponent": "Profil apprenant",
  "caseName": "Profil apprenant - Apprenant sans donnees",
  "value": {
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
}
```

### pedagogicalStrategy

```json
{
  "sourceComponent": "Strategie pedagogique",
  "caseName": "Strategie pedagogique - Apprenant sans donnees",
  "value": {
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
}
```

### tutoring feedback

```json
{
  "sourceComponent": "Feedback tutorat",
  "caseName": "Feedback tutorat - RECOVERY",
  "value": {
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
}
```

### pathFreshness

```json
{
  "sourceComponent": "Rafraichissement evenementiel persistant",
  "caseName": "Rafraichissement apres quiz",
  "value": {
    "refreshedAfterEvent": true,
    "lastEventType": "quiz.completed",
    "lastEventAt": "2026-05-20T08:37:21.304409",
    "refreshReason": "QUIZ_COMPLETED",
    "message": "Le parcours a été actualisé après votre dernière évaluation."
  }
}
```

## Limites

- Les mecanismes valides sont rule-based.
- Aucun ML n est utilise.
- RabbitMQ reste complementaire au runtime HTTP teste.
- Le profil apprenant n est pas persiste comme objet dedie.
- Il n y a pas d orchestration automatique par evenements entre strategie et tutorat.

## Interpretation pour le rapport PFE

### Ce que les tests demontrent

- Les tests demontrent que les endpoints runtime exposent les champs attendus pour le scoring explicable, le profil apprenant, la strategie pedagogique, le feedback tutorat et le rafraichissement evenementiel persistant.
- Ils demontrent que les decisions, profils, strategies, feedbacks et indicateurs de fraicheur sont coherents avec les cas simules dans les rapports existants.
- Ils demontrent une non-regression observable sur les couches successives deja testees.

### Ce qu ils ne demontrent pas

- Ils ne demontrent pas une superiorite pedagogique statistique.
- Ils ne mesurent pas la performance utilisateur en conditions reelles.
- Ils ne prouvent pas une generalisation hors des datasets et scenarios runtime couverts.
- Ils ne valident pas une orchestration asynchrone RabbitMQ complete.

### Comment les utiliser dans le chapitre resultats

- Presenter les totaux PASS/FAIL comme validation fonctionnelle runtime.
- Utiliser les exemples JSON pour illustrer les sorties reelles du systeme.
- Separer clairement la validation technique des conclusions pedagogiques.
- Relier chaque composant fonctionnel a son apport: scoring, profil, strategie, feedback.

## Checklist screenshots

- [ ] dashboard apprenant (a capturer)
- [ ] adaptive path (a capturer)
- [ ] profil apprenant (a capturer)
- [ ] strategie pedagogique (a capturer)
- [ ] feedback tutoring (a capturer)
- [ ] dashboard enseignant (a capturer)
- [ ] dashboard admin (a capturer)
- [ ] RabbitMQ UI (a capturer)
- [ ] Consul UI (a capturer)
