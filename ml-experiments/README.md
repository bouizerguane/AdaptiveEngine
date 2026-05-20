# First ML Experiment - AdaptiveEngine

Ce dossier contient un pipeline ML expérimental **offline** et un petit service FastAPI optionnel. Il ne remplace pas le moteur adaptatif et ne modifie pas les décisions pédagogiques existantes.

## Objectif

Prédire la target de serving :

```text
success
```

Quand le dataset exporté contient l'ancien champ `conceptCompletedAfterRecommendation`, le script le convertit en cible `success` pour le modèle de serving.

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
- joblib

La commande d'entraînement sauvegarde aussi le meilleur pipeline dans :

```text
ml-experiments/model-serving/model.pkl
```

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
- `model-serving/model.pkl` : pipeline expérimental sérialisé pour l'API FastAPI.

## Modèles testés

- Dummy Classifier, stratégie `most_frequent`, utilisé comme baseline naïve ;
- Logistic Regression ;
- Random Forest.

## Important

Le modèle peut être appelé depuis `adaptive-engine-service` comme signal secondaire non bloquant. Le moteur principal reste rule-based, explicable et inchangé.

## Serving expérimental optionnel

Le dossier `model-serving/` expose une API FastAPI minimale :

```http
POST /api/ml/predict-success
```

Lancer localement après entraînement :

```bash
cd ml-experiments/model-serving
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8090
```

Exemple curl :

```bash
curl -X POST http://localhost:8090/api/ml/predict-success \
  -H "Content-Type: application/json" \
  -d "{\"adaptiveScore\":0.82,\"prerequisiteScore\":0.9,\"historicalPerformanceScore\":0.75,\"pedagogicalOrderScore\":0.8,\"engagementScore\":0.7,\"diagnosticWeaknessScore\":0.3,\"masteryScore\":0.65,\"averageAssessmentScore\":72,\"completedLabsCount\":5,\"tracesCount\":18,\"profileType\":\"INTERMEDIATE\",\"recommendationType\":\"NORMAL_PROGRESS\"}"
```

Réponse attendue :

```json
{
  "successProbability": 0.78,
  "modelVersion": "local-rf-v1"
}
```

Si le service ML est arrêté ou si `model.pkl` est absent, `adaptive-engine-service` garde automatiquement le score rule-based sans bloquer `/api/adaptive/path`.

## Limites scientifiques

- Les données synthétiques sont cohérentes avec le schéma de features AdaptiveEngine, mais elles ne prouvent aucune performance réelle.
- Les outcomes inconnus restent `null` et ne sont pas transformés artificiellement en `false`.
- Les features à risque de leakage méthodologique (`lastActivityScore`, `remediationSuccess`) sont exclues de l'entraînement.
- Les résultats obtenus sur le dataset synthétique valident seulement la mécanique du pipeline offline ; ils ne sont pas généralisables à des apprenants réels.
- Toute future intégration devra être validée sur des traces réelles labellisées.
