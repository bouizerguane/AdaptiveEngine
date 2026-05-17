# Rapport final de validation AdaptiveEngine

Genere le: 2026-05-17T19:33:31.559Z

## Synthese globale

- Total tests: 18
- Total PASS: 18
- Total FAIL: 0
- Duree totale disponible: 10955 ms

## Resume par composant fonctionnel

| Composant | Portee | Tests | PASS | FAIL | Duree | Rapport source |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Scoring explicable | scoring explicable | 5 | 5 | 0 | 3050 ms | tools/adaptive-v3-runtime-tests/adaptive-v3-test-report.json |
| Profil apprenant | profil apprenant | 4 | 4 | 0 | 4638 ms | tools/adaptive-v4-runtime-tests/adaptive-v4-test-report.json |
| Strategie pedagogique | strategie pedagogique | 4 | 4 | 0 | 2902 ms | tools/adaptive-v5-runtime-tests/adaptive-v5-test-report.json |
| Feedback tutorat | feedback tutorat | 5 | 5 | 0 | 365 ms | tools/tutoring-v6-runtime-tests/tutoring-v6-test-report.json |

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
      "Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."
    ]
  },
  "decisionExplanation": "La priorite est donnee au concept non maitrise lors du dernier diagnostic."
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
    "profileExplanation": "Le profil sera affine apres davantage d'activites."
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

- Les tests demontrent que les endpoints runtime exposent les champs attendus pour le scoring explicable, le profil apprenant, la strategie pedagogique et le feedback tutorat.
- Ils demontrent que les decisions, profils, strategies et feedbacks sont coherents avec les cas simules dans les rapports existants.
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
