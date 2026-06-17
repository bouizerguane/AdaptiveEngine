# Real API Recommendation Evaluation - AdaptiveEngine

Cette évaluation exécute un scénario expérimental unique via les API réelles exposées par l'API Gateway.
Elle ne constitue pas une preuve d'efficacité pédagogique réelle ; elle valide uniquement la cohérence fonctionnelle du classement dans un cas contrôlé.

## Configuration

- API Gateway : `http://localhost:8080`
- Enseignant : `bouizerguane@gmail.com`
- Apprenant : `kamal@gmail.com`
- Cours : `ae-real-api-course-programming`

## Endpoints réellement utilisés

- `POST /api/auth/login`
- `POST /api/graph/courses`
- `POST /api/graph/modules?courseId=...`
- `POST /api/graph/modules/{moduleId}/chapitres`
- `POST /api/graph/chapitres/{chapitreId}/concepts`
- `POST /api/graph/concepts/{sourceId}/exige/{targetId}`
- `GET /api/graph/courses/{courseId}/tree`
- `POST /api/content/save`
- `POST /api/content/evaluations`
- `POST /api/content/labs`
- `POST /api/graph/courses/{courseId}/enroll`
- `POST /api/graph/adaptive/diagnostic`
- `POST /api/traces`
- `GET /api/adaptive/path?courseId=...`
- `POST /api/tutoring/feedback`

## Oracle pédagogique contrôlé

- Conditions échoué : `ae-real-concept-conditions` doit être recommandé en remédiation.
- Variables maîtrisé : il ne doit pas être priorisé comme lacune principale.
- Boucles, Fonctions et Tableaux ne doivent pas être priorisés avant la remédiation de Conditions.

## Recommandations et métriques

- Recommandations retournées : `['ae-real-concept-conditions', 'ae-real-concept-boucles', 'ae-real-concept-fonctions', 'ae-real-concept-tableaux', 'ae-real-concept-variables']`
- Recommandations attendues : `['ae-real-concept-conditions']`
- Pertinence top 3 : `[1, 0, 0]`
- Precision@3 : `0.333333`
- Recall@3 : `1.0`
- nDCG@3 : `1.0`

## Réponse adaptative brute utilisée

Voir `raw_api_responses.json`, clé `21_adaptive_path_after_conditions_failure`.

```json
{
  "learnerEmail": "kamal@gmail.com",
  "courseId": "ae-real-api-course-programming",
  "courseTitle": "Introduction à la programmation adaptative",
  "diagnosticPassed": true,
  "masteredConcepts": [
    {
      "conceptId": "ae-real-concept-variables",
      "conceptName": "Variables",
      "courseId": "ae-real-api-course-programming",
      "type": "INTERNAL",
      "moduleTitle": "Bases de la programmation",
      "chapitreTitle": "Variables et conditions",
      "status": "MASTERED",
      "missingPrerequisiteIds": [],
      "adaptiveScore": null,
      "scoreBreakdown": null,
      "explanationReasons": null,
      "mlSuccessProbability": null,
      "mlEnhancedScore": null,
      "mlExplanation": null
    }
  ],
  "learnableConcepts": [
    {
      "conceptId": "ae-real-concept-conditions",
      "conceptName": "Conditions",
      "courseId": "ae-real-api-course-programming",
      "type": "INTERNAL",
      "moduleTitle": "Bases de la programmation",
      "chapitreTitle": "Variables et conditions",
      "status": "LEARNABLE",
      "missingPrerequisiteIds": [],
      "adaptiveScore": 0.71,
      "scoreBreakdown": {
        "prerequisiteScore": 1.0,
        "diagnosticWeaknessScore": 0.3,
        "historicalPerformanceScore": 0.4,
        "pedagogicalOrderScore": 1.0,
        "engagementScore": 0.7
      },
      "explanationReasons": [
        "Le concept 'Conditions' est accessible car les prérequis requis sont satisfaits.",
        "Ce choix respecte l'ordre pédagogique prévu dans le cours.",
        "Cette recommandation tient compte des difficultés observées dans les activités précédentes.",
        "Signal ML expérimental : probabilité estimée de réussite calculée à partir des traces de recommandation historiques."
      ],
      "mlSuccessProbability": 0.45,
      "mlEnhancedScore": 0.66,
      "mlExplanation": "ML signal estimates the probability of successful recommendation based on historical recommendation traces."
    }
  ],
  "blockedConcepts": [
    {
      "conceptId": "ae-real-concept-boucles",
      "conceptName": "Boucles",
      "courseId": "ae-real-api-course-programming",
      "type": "INTERNAL",
      "moduleTitle": "Bases de la programmation",
      "chapitreTitle": "Structures répétitives",
      "status": "BLOCKED",
      "missingPrerequisiteIds": [
        "ae-real-concept-conditions"
      ],
      "adaptiveScore": null,
      "scoreBreakdown": null,
      "explanationReasons": null,
      "mlSuccessProbability": null,
      "mlEnhancedScore": null,
      "mlExplanation": null
    },
    {
      "conceptId": "ae-real-concept-fonctions",
      "conceptName": "Fonctions",
      "courseId": "ae-real-api-course-programming",
      "type": "INTERNAL",
      "moduleTitle": "Modularité et structures de données",
      "chapitreTitle": "Fonctions et tableaux",
      "status": "BLOCKED",
      "missingPrerequisiteIds": [
        "ae-real-concept-boucles"
      ],
      "adaptiveScore": null,
      "scoreBreakdown": null,
      "explanationReasons": null,
      "mlSuccessProbability": null,
      "mlEnhancedScore": null,
      "mlExplanation": null
    },
    {
      "conceptId": "ae-real-concept-tableaux",
      "conceptName": "Tableaux",
      "courseId": "ae-real-api-course-programming",
      "type": "INTERNAL",
      "moduleTitle": "Modularité et structures de données",
      "chapitreTitle": "Fonctions et tableaux",
      "status": "BLOCKED",
      "missingPrerequisiteIds": [
        "ae-real-concept-fonctions"
      ],
      "adaptiveScore": null,
      "scoreBreakdown": null,
      "explanationReasons": null,
      "mlSuccessProbability": null,
      "mlEnhancedScore": null,
      "mlExplanation": null
    }
  ],
  "conceptsToReview": [],
  "recommendedLearningPath": [
    {
      "order": 1,
      "conceptId": "ae-real-concept-conditions",
      "conceptName": "Conditions",
      "status": "TO_REVIEW",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Conditions' est prioritaire car 3 difficultés successives ont été observées dans vos activités récentes.",
        "Une remédiation renforcée est proposée afin de consolider ce concept avant de poursuivre le parcours."
      ],
      "repeatedFailuresCount": 3,
      "persistentDifficulty": true,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 2,
      "conceptId": "ae-real-concept-boucles",
      "conceptName": "Boucles",
      "status": "LOCKED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Boucles' est verrouillé car certains prérequis ne sont pas encore maîtrisés."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 3,
      "conceptId": "ae-real-concept-fonctions",
      "conceptName": "Fonctions",
      "status": "LOCKED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Fonctions' est verrouillé car certains prérequis ne sont pas encore maîtrisés."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 4,
      "conceptId": "ae-real-concept-tableaux",
      "conceptName": "Tableaux",
      "status": "LOCKED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Tableaux' est verrouillé car certains prérequis ne sont pas encore maîtrisés."
      ],
      "repeatedFailuresCount": null,
      "persistentDifficulty": null,
      "remediationSuccess": null,
      "highMasteryProgression": null
    },
    {
      "order": 5,
      "conceptId": "ae-real-concept-variables",
      "conceptName": "Variables",
      "status": "COMPLETED",
      "adaptiveScore": null,
      "explanationReasons": [
        "Le concept 'Variables' est déjà maîtrisé et n’est pas prioritaire dans le parcours 
```

## Limites

- Scénario unique, contrôlé, non généralisable.
- Les recommandations attendues sont définies par un oracle pédagogique, pas par une étude utilisateur.
- La preuve RabbitMQ doit être complétée par les logs ou l'interface RabbitMQ Management si elle est requise dans le mémoire.
- Une validation robuste demanderait plusieurs cours, plusieurs profils et plusieurs tentatives.
