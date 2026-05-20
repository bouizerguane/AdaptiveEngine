# First ML Experiment - AdaptiveEngine

Ce dossier contient un pipeline ML expérimental **offline**. Il n'est pas intégré au moteur adaptatif et ne modifie pas les décisions pédagogiques existantes.

## Objectif

Prédire la target :

```text
conceptCompletedAfterRecommendation
```

Question expérimentale :

```text
Peut-on prédire si une recommandation a une forte probabilité d'aboutir à la réussite d'un concept ?
```

## Sources de données

Le script peut lire le dataset réel interne via :

```http
GET /api/tracking/recommendation-traces/export
```

Il peut aussi lire un dataset synthétique :

```text
synthetic experimental dataset generated from AdaptiveEngine feature schema
```

Ce dataset synthétique sert uniquement à valider le pipeline ML offline. Il ne représente pas des apprenants réels.

Il s'authentifie avec :

- `ADAPTIVE_ADMIN_EMAIL`, par défaut `admin@system.com` ;
- `ADAPTIVE_ADMIN_PASSWORD`, ou `ADMIN_DEFAULT_PASSWORD`, par défaut `admin123` ;
- `VITE_API_URL`, par défaut `http://localhost:8080/api`.

## Commandes

Depuis la racine du dépôt :

```bash
python ml-experiments/run_first_ml_experiment.py --source real
```

Générer un dataset synthétique reproductible :

```bash
python ml-experiments/generate_experimental_dataset.py --rows 260 --seed 42
```

Entraîner sur le dataset synthétique :

```bash
python ml-experiments/run_first_ml_experiment.py --source synthetic
```

Prérequis Python utilisés :

- pandas
- numpy
- scikit-learn

## Artefacts générés

- `recommendation-traces-raw.json` : export brut RecommendationTrace ;
- `recommendation-traces-cleaned.csv` : dataset ML nettoyé ;
- `synthetic-recommendation-traces.csv` : dataset synthétique expérimental ;
- `synthetic-recommendation-traces.json` : version JSON du dataset synthétique ;
- `synthetic-dataset-summary.json` : distribution des profils et de la target ;
- `metrics.json` : audit, métriques et résultats ;
- `confusion_matrix.csv` : matrices de confusion ;
- `feature_importance.csv` : importance des variables ;
- `first-ml-experiment-report.md` : rapport synthétique.
- `synthetic-ml-report.md` : rapport ML sur le dataset synthétique.

## Modèles testés

- Dummy Classifier, stratégie `most_frequent`, utilisé comme baseline naïve ;
- Logistic Regression ;
- Random Forest.

## Important

Aucun modèle ML n'est appelé depuis `adaptive-engine-service`. Le moteur principal reste rule-based, explicable et inchangé.

## Limites scientifiques

- Les données synthétiques sont cohérentes avec le schéma de features AdaptiveEngine, mais elles ne prouvent aucune performance réelle.
- Les outcomes inconnus restent `null` et ne sont pas transformés artificiellement en `false`.
- Les features à risque de leakage méthodologique (`lastActivityScore`, `remediationSuccess`) sont exclues de l'entraînement.
- Les résultats obtenus sur le dataset synthétique valident seulement la mécanique du pipeline offline ; ils ne sont pas généralisables à des apprenants réels.
- Toute future intégration devra être validée sur des traces réelles labellisées.
