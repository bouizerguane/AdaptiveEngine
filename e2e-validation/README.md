# AdaptiveEngine E2E Validation

Ce dossier contient une validation E2E légère et isolée. Elle ne modifie pas la logique métier et ne crée pas de données applicatives.

## Services nécessaires

- `gateway-service` via `http://localhost:8080/api`
- `iam-service`
- `knowledge-graph-service`
- `content-service`
- `tracking-service`
- `adaptive-engine-service`
- `tutoring-service`
- `model-serving` via `http://localhost:8090`
- `frontend-app` via `http://localhost:5173`
- PostgreSQL IAM
- PostgreSQL Tracking
- MongoDB Content
- Neo4j
- RabbitMQ
- Consul

## Lancement recommandé

```bash
docker compose up --build -d
docker compose ps
```

## Windows

```powershell
.\e2e-validation\run-e2e-validation.ps1
```

Avec variables explicites :

```powershell
$env:E2E_LEARNER_EMAIL="student.profile.high@test.local"
$env:E2E_LEARNER_PASSWORD="moh123"
$env:E2E_COURSE_ID="ae-runtime-course-algo"
.\e2e-validation\run-e2e-validation.ps1
```

## Linux / Mac

```bash
bash e2e-validation/run-e2e-validation.sh
```

## Variables

- `E2E_API_BASE_URL`, défaut `http://localhost:8080/api`
- `E2E_ML_SERVICE_URL`, défaut `http://localhost:8090`
- `E2E_FRONTEND_URL`, défaut `http://localhost:5173`
- `E2E_LEARNER_EMAIL`, défaut `student.profile.high@test.local`
- `E2E_LEARNER_PASSWORD`, défaut `moh123`
- `E2E_COURSE_ID`, optionnel
- `E2E_CHECK_DOCKER=true`, ajoute `docker compose ps` au rapport

## Tests automatisés

- seed idempotent des learners E2E dédiés ;
- disponibilité ML `/health`
- prédiction ML `/api/ml/predict-success`
- login apprenant
- routage gateway vers IAM, graph, tracking, tutoring
- `/api/adaptive/path`
- présence des champs :
  - `nextAction`
  - `decisionExplanation`
  - `recommendedLearningPath`
  - `learnerProfile`
  - champs ML optionnels si disponibles
- scénarios dédiés :
  - Repeated Failure ;
  - Remediation Success ;
  - High Mastery Controlled Progression ;
  - Low Data sans accélération ;
- disponibilité HTTP du frontend

## Fallback ML

Le runner documente le fallback mais ne stoppe pas automatiquement le conteneur `model-serving` pour éviter d'altérer un environnement de démonstration partagé.

Procédure manuelle :

```bash
docker compose stop model-serving
node e2e-validation/run-e2e-validation.mjs
docker compose up -d model-serving
```

## Seed E2E dédié

Le runner exécute automatiquement :

```bash
node e2e-validation/e2e-test-data/seed-e2e-data.mjs
```

Pour désactiver ce seed automatique :

```bash
E2E_SKIP_SEED=true node e2e-validation/run-e2e-validation.mjs
```

## Rapports

Le rapport est généré ici :

```text
e2e-validation/e2e_validation_report.md
```

Les scénarios qui nécessitent des données spécifiques sont documentés dans :

```text
e2e-validation/TEST_DATA_REQUIREMENTS.md
```
