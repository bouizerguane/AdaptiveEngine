# Real API Recommendation Evaluation

Ce dossier contient un scénario expérimental bout en bout exécuté via les API réelles d'AdaptiveEngine.

Objectif : vérifier la cohérence fonctionnelle des recommandations retournées par `/api/adaptive/path` sur un cas contrôlé, puis calculer :

- `Precision@3`
- `Recall@3`
- `nDCG@3`

Cette évaluation ne prétend pas démontrer une efficacité pédagogique réelle. Elle valide seulement que le moteur adaptatif classe correctement les recommandations dans un scénario pédagogique contrôlé exécuté via les microservices.

## Préconditions

La plateforme doit être démarrée :

```powershell
docker compose up --build -d
docker compose ps
```

URL par défaut :

```text
http://localhost:8080
```

Comptes utilisés :

```text
Enseignant : bouizerguane@gmail.com / moh123
Apprenant  : kamal@gmail.com / kamal123
```

Ces comptes doivent exister dans IAM. Si ce n'est pas le cas, le script s'arrête après l'étape de login et documente l'erreur dans `raw_api_responses.json`.

## Exécution

Depuis la racine du dépôt :

```powershell
python ml-experiments\real_api_recommendation_evaluation\run_real_api_scenario.py
```

Variables optionnelles :

```powershell
$env:AE_BASE_URL="http://localhost:8080"
$env:AE_TEACHER_EMAIL="bouizerguane@gmail.com"
$env:AE_TEACHER_PASSWORD="moh123"
$env:AE_LEARNER_EMAIL="kamal@gmail.com"
$env:AE_LEARNER_PASSWORD="kamal123"
```

## Endpoints utilisés

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

## Fichiers générés

- `scenario_payloads.json` : tous les payloads envoyés.
- `raw_api_responses.json` : toutes les réponses API brutes.
- `recommendation_metrics_results.json` : recommandations extraites et métriques.
- `recommendation_metrics_results.csv` : version tabulaire.
- `real_api_recommendation_report.md` : rapport Markdown.
- `real_api_recommendation_report.tex` : section LaTeX pour le mémoire.

## Oracle pédagogique

Scénario contrôlé :

- `Variables` est maîtrisé.
- `Conditions` est échoué avec un score insuffisant.
- `Boucles`, `Fonctions` et `Tableaux` ne doivent pas être prioritaires avant la remédiation de `Conditions`.

Recommandation attendue :

```json
["ae-real-concept-conditions"]
```

## Limites scientifiques

- Un seul scénario contrôlé.
- Pas d'étude utilisateur.
- Pas de preuve d'amélioration réelle de l'apprentissage.
- Les recommandations attendues sont définies par les règles pédagogiques du système.
- La preuve RabbitMQ doit être complétée par les logs ou l'interface RabbitMQ Management si elle est demandée.
