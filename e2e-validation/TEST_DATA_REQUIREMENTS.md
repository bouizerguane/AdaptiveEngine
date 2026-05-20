# Données nécessaires pour une validation E2E complète

Le runner `run-e2e-validation.mjs` crée désormais des données de test isolées via `e2e-test-data/seed-e2e-data.mjs`.

Le seed utilise uniquement les APIs gateway et reste idempotent.

## Variables minimales

- `E2E_LEARNER_EMAIL` : apprenant de test approuvé.
- `E2E_LEARNER_PASSWORD` : mot de passe de cet apprenant.
- `E2E_COURSE_ID` : cours contenant un arbre de concepts exploitable.

Si `E2E_COURSE_ID` est absent, le runner tente d'utiliser le premier cours inscrit, puis le premier cours disponible.

## Scénario Repeated Failure

Pour obtenir un PASS automatisé :

- un apprenant avec au moins un concept en remédiation ;
- au moins 3 échecs récents sur le même concept via traces quiz/formative ou labs ;
- le concept doit apparaître dans `recommendedLearningPath` avec :
  - `status = TO_REVIEW`
  - `repeatedFailuresCount > 0`
  - ou `persistentDifficulty = true`

## Scénario Remediation Success

Pour obtenir un PASS automatisé :

- un concept ayant été en remédiation ;
- une activité récente réussie sur ce concept ;
- le concept doit apparaître dans le PLP avec :
  - `status = COMPLETED`
  - `remediationSuccess = true`

## Scénario High Mastery

Pour obtenir un PASS automatisé :

- `learnerProfile.masteryScore >= 80`
- `learnerProfile.averageAssessmentScore >= 80`
- au moins 2 concepts maîtrisés ;
- aucune lacune active ;
- aucune difficulté persistante ;
- au moins un concept `READY` avec :
  - `highMasteryProgression = true`

## Scénario Low Data

Pour vérifier l'absence d'accélération :

- un apprenant avec peu ou pas de traces ;
- `profileType = DATA_INSUFFICIENT` ;
- aucun step `READY` ne doit contenir `highMasteryProgression = true`.

## Fallback ML

Le fallback ML ne doit pas casser `/api/adaptive/path`.

Procédure manuelle recommandée si l'environnement est partagé :

```bash
docker compose stop model-serving
node e2e-validation/run-e2e-validation.mjs
docker compose up -d model-serving
```

Le test doit confirmer que le parcours adaptatif répond encore sans erreur 500.
