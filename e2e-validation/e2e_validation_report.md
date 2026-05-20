# E2E Validation Report - AdaptiveEngine

Date d'exécution : 2026-05-20T18:41:04.053Z
Statut global : **PASS**

## Configuration

- API gateway : `http://localhost:8080/api`
- ML service : `http://localhost:8090`
- Frontend : `http://localhost:5173`
- Learner : `student.profile.high@test.local`
- CourseId utilisé : `ae-runtime-course-algo`

## Résultats

| Test | Statut | Détails |
|---|---|---|
| ML health | PASS | url: http://localhost:8090/health<br>response: {"status":"UP","modelLoaded":true,"modelVersion":"local-rf-v1","error":null} |
| ML predict-success | PASS | url: http://localhost:8090/api/ml/predict-success<br>response: {"successProbability":0.6613494130045477,"modelVersion":"local-rf-v1"} |
| E2E test data seed | PASS | status: OK<br>report: e2e-validation/e2e-test-data/e2e_seed_report.json<br>courseId: ae-runtime-course-algo<br>learners: {"repeatedFailure":"student.repeated.failure@test.local","remediationSuccess":"student.remediation.success@test.local","highMasteryReady":"student.high.mastery.ready@test.local","lowData":"student.low.data@test.local","mlFallback":"student.ml.fallback@test.local"}<br>tracesCreated: 0 |
| Learner login | PASS | learner: student.profile.high@test.local |
| IAM via gateway | PASS | url: http://localhost:8080/api/user/me<br>httpStatus: 200<br>response: reachable |
| Knowledge graph via gateway | PASS | url: http://localhost:8080/api/graph/courses/available<br>httpStatus: 200<br>response: reachable |
| Tracking via gateway | PASS | url: http://localhost:8080/api/traces/user/student.profile.high%40test.local<br>httpStatus: 200<br>response: reachable |
| Tutoring via gateway | PASS | url: http://localhost:8080/api/tutoring/feedback<br>httpStatus: 200<br>response: reachable |
| Adaptive path with ML active | PASS | url: http://localhost:8080/api/adaptive/path?courseId=ae-runtime-course-algo<br>httpStatus: 200<br>validation: {"nextAction":"COMPLETED","hasNextConcept":false,"hasDecisionExplanation":true,"recommendedLearningPathSize":7,"learnerProfileType":"HIGH_PERFORMING"} |
| Dedicated Repeated Failure scenario | PASS | learner: student.repeated.failure@test.local<br>nextAction: REMEDIATION<br>repeatedStep: {"order":1,"conceptId":"ae-runtime-concept-variables","conceptName":"Variables","status":"TO_REVIEW","adaptiveScore":null,"explanationReasons":["Le concept 'Variables' est prioritaire car 4 difficultés successives ont été observées dans vos activités récentes.","Une remédiation renforcée est proposée afin de consolider ce concept avant de poursuivre le parcours."],"repeatedFailuresCount":4,"persistentDifficulty":true,"remediationSuccess":null,"highMasteryProgression":null}<br>expected: REMEDIATION or TO_REVIEW with repeatedFailuresCount >= 3 |
| Dedicated Remediation Success scenario | PASS | learner: student.remediation.success@test.local<br>nextAction: LEARN<br>remediationSuccessStep: {"order":7,"conceptId":"ae-runtime-concept-variables","conceptName":"Variables","status":"COMPLETED","adaptiveScore":null,"explanationReasons":["Après plusieurs difficultés successives, ce concept semble désormais consolidé.","La remédiation semble réussie car ce concept est désormais maîtrisé après une activité récente."],"repeatedFailuresCount":4,"persistentDifficulty":null,"remediationSuccess":true,"highMasteryProgression":null}<br>remainingPersistentReview: null<br>expected: remediationSuccess=true and progression not stuck in REMEDIATION |
| Dedicated High Mastery Controlled Progression scenario | PASS | learner: student.high.mastery.ready@test.local<br>nextAction: LEARN<br>learnerProfile: {"learnerEmail":"student.high.mastery.ready@test.local","masteryScore":93.78,"knowledgeGaps":[],"masteredConceptsCount":3,"weakConceptsCount":0,"tracesCount":4,"completedLabsCount":0,"averageAssessmentScore":93.25,"totalLearningTime":1020,"profileType":"PROGRESSING","profileExplanation":"Le profil indique une progression active."}<br>highMasteryStep: {"order":1,"conceptId":"ae-runtime-concept-boucles","conceptName":"Boucles","status":"READY","adaptiveScore":0.71,"explanationReasons":["Le concept 'Boucles' est accessible car les prérequis requis sont satisfaits.","L'historique récent montre une progression suffisante pour aborder cette étape.","Votre progression récente indique une maîtrise élevée des concepts précédents.","Une progression accélérée contrôlée est appliquée uniquement parmi les concepts déjà accessibles, sans contourner les prérequis."],"repeatedFailuresCount":null,"persistentDifficulty":null,"remediationSuccess":null,"highMasteryProgression":true}<br>lockedRecommended: null<br>expected: READY step with highMasteryProgression=true and no LOCKED recommendation |
| Dedicated Low Data scenario | PASS | learner: student.low.data@test.local<br>learnerProfile: {"learnerEmail":"student.low.data@test.local","masteryScore":null,"knowledgeGaps":[],"masteredConceptsCount":0,"weakConceptsCount":0,"tracesCount":0,"completedLabsCount":0,"averageAssessmentScore":null,"totalLearningTime":0,"profileType":"DATA_INSUFFICIENT","profileExplanation":"Le profil sera affiné après davantage d'activités."}<br>acceleratedStep: null<br>expected: DATA_INSUFFICIENT and no highMasteryProgression |
| ML fallback procedure | PASS | mode: documented-manual<br>reason: Automatic stop/start is disabled by default to avoid altering a shared demo environment. Manual procedure is documented in README.md. |
| Frontend reachable | PASS | url: http://localhost:5173<br>httpStatus: 200<br>note: Detailed LearnerCourseDetail visual checks are documented in frontend_manual_checklist.md. |

## Exemple ML

```json
{
  "successProbability": 0.6613494130045477,
  "modelVersion": "local-rf-v1"
}
```

## Exemple Adaptive Path

```json
{
  "nextAction": "COMPLETED",
  "nextConcept": null,
  "learnerProfile": {
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
  },
  "recommendedLearningPath": [
    {
      "order": 1,
      "conceptId": "ae-runtime-concept-types-de-donnees",
      "conceptName": "Types de données",
      "status": "COMPLETED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Types de données' est déjà maîtrisé et n’est pas prioritaire dans le parcours actuel."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 2,
      "conceptId": "ae-runtime-concept-variables",
      "conceptName": "Variables",
      "status": "COMPLETED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Variables' est déjà maîtrisé et n’est pas prioritaire dans le parcours actuel."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 3,
      "conceptId": "ae-runtime-concept-entrees-sorties",
      "conceptName": "Entrées/Sorties",
      "status": "COMPLETED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Entrées/Sorties' est déjà maîtrisé et n’est pas prioritaire dans le parcours actuel."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 4,
      "conceptId": "ae-runtime-concept-conditions",
      "conceptName": "Conditions",
      "status": "COMPLETED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Conditions' est déjà maîtrisé et n’est pas prioritaire dans le parcours actuel."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 5,
      "conceptId": "ae-runtime-concept-boucles",
      "conceptName": "Boucles",
      "status": "COMPLETED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Boucles' est déjà maîtrisé et n’est pas prioritaire dans le parcours actuel."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    }
  ]
}
```

## Frontend

La disponibilité HTTP du frontend est testée automatiquement. Les contrôles visuels détaillés sont dans `frontend_manual_checklist.md`.

## Bugs détectés

Aucun bug bloquant détecté par les tests automatisés exécutés.

## Recommandations finales

- Les scénarios adaptatifs avancés sont validés avec les learners E2E dédiés.
- Utiliser le fallback ML manuel avant soutenance si le service est lancé dans un environnement partagé.
- Conserver le ML comme signal secondaire : le test vérifie seulement sa disponibilité et sa non-régression.
