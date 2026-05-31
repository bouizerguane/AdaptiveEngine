# AdaptiveEngine  
### Plateforme d’apprentissage adaptatif basée sur les graphes de compétences et la recommandation explicable

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Microservices-blue" />
  <img src="https://img.shields.io/badge/Backend-Spring%20Boot-brightgreen" />
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB" />
  <img src="https://img.shields.io/badge/Base%20de%20données-Neo4j%20%7C%20PostgreSQL%20%7C%20MongoDB-orange" />
  <img src="https://img.shields.io/badge/Machine%20Learning-Scikit--Learn-red" />
  <img src="https://img.shields.io/badge/Statut-Projet%20Académique-lightgrey" />
</p>

---

## Présentation du projet

**AdaptiveEngine** est une plateforme d’apprentissage adaptatif conçue pour générer des **parcours pédagogiques personnalisés** à partir d’un **graphe de compétences (Skill Graph)**, des **traces d’apprentissage**, des **prérequis pédagogiques**, du **profil apprenant** et d’un **moteur adaptatif explicable basé sur des règles pédagogiques**.

Le projet a été réalisé dans le cadre d’un **Projet de Fin d’Études (PFE) de Master** à l’**École Normale Supérieure de Marrakech – Université Cadi Ayyad**, dans le Master :

> **Didactique des Sciences et Ingénierie Éducative**  
> **Option : Technologies émergentes en éducation**

Contrairement aux plateformes d’apprentissage classiques proposant des parcours statiques identiques pour tous les apprenants, **AdaptiveEngine adapte dynamiquement les recommandations pédagogiques** selon :

- les performances de l’apprenant ;
- les prérequis maîtrisés ou non ;
- les traces d’apprentissage ;
- les difficultés détectées ;
- les mécanismes de remédiation ;
- l’évolution du profil apprenant.

Le système repose sur une **approche hybride**, combinant :

**Graphes de compétences (KG/SG)**  
+  
**Règles pédagogiques explicables**  
+  
**Signal prédictif expérimental basé sur le Machine Learning**

---

# Objectif du projet

L’objectif principal du projet est de concevoir un **moteur d’apprentissage adaptatif capable de recommander des parcours personnalisés**, tout en respectant :

- la cohérence pédagogique ;
- les relations de prérequis ;
- l’explicabilité des recommandations ;
- les contraintes de personnalisation.

Le projet vise notamment à répondre aux limites des systèmes éducatifs traditionnels reposant sur une approche **“one-size-fits-all”**, où tous les apprenants suivent le même parcours indépendamment de leurs besoins.

---

# Fonctionnalités principales

## 1. Génération de parcours personnalisés

Le moteur adaptatif est capable de :

- générer des **Personalized Learning Paths (PLP)** ;
- respecter automatiquement les prérequis pédagogiques ;
- verrouiller ou débloquer des concepts ;
- recommander des contenus adaptés au niveau de l’apprenant ;
- adapter dynamiquement le parcours.

Les concepts peuvent avoir différents statuts :

- `READY`
- `LOCKED`
- `TO_REVIEW`
- `COMPLETED`

---

## 2. Graphe de compétences (Knowledge Graph / Skill Graph)

Le système repose sur un **graphe de compétences pédagogique** permettant :

- la modélisation des concepts ;
- la gestion des dépendances pédagogiques ;
- la représentation des prérequis ;
- le raisonnement pédagogique explicable ;
- l’identification des lacunes.

---

## 3. Profil apprenant dynamique (Learner Profile)

Le système maintient un **profil apprenant dynamique** calculé à partir de plusieurs indicateurs pédagogiques :

- score de maîtrise (`masteryScore`) ;
- score moyen aux évaluations ;
- engagement pédagogique ;
- historique des traces ;
- TP complétés ;
- lacunes détectées (`knowledge gaps`) ;
- progression pédagogique.

---

## 4. Règles pédagogiques post-activité

Le moteur adaptatif repose principalement sur des **règles pédagogiques explicables**.

### Repeated Failure → Remédiation renforcée

Lorsque plusieurs échecs sont détectés sur un concept :

- le système recommande automatiquement une remédiation ;
- des ressources de consolidation sont proposées ;
- la progression est temporairement réorientée.

---

### Remediation Success → Progression normale

Lorsqu’un apprenant réussit une remédiation :

- la progression pédagogique normale est restaurée ;
- les concepts dépendants peuvent être débloqués.

---

### High Mastery → Progression accélérée contrôlée

Lorsqu’un apprenant démontre une maîtrise élevée :

- le système priorise certains concepts `READY` plus avancés ;
- les prérequis restent obligatoires ;
- aucune progression agressive ou incohérente n’est effectuée.

---

## 5. Gestion des contenus pédagogiques

La plateforme permet la gestion de :

- cours ;
- chapitres ;
- concepts pédagogiques ;
- ressources d’apprentissage ;
- évaluations ;
- laboratoires (TP) ;
- médias pédagogiques.

---

## 6. Suivi des traces pédagogiques

Le système collecte et exploite les traces d’apprentissage :

- résultats de quiz ;
- interactions utilisateur ;
- soumissions de TP ;
- progression pédagogique ;
- historique des recommandations.

---

## 7. Tutorat pédagogique contextualisé

Un service de tutorat permet de générer :

- du feedback pédagogique ;
- des conseils contextualisés ;
- des recommandations explicables.

---

## 8. Machine Learning expérimental

Un module **Machine Learning expérimental** a été intégré afin d’évaluer la faisabilité d’un **signal prédictif complémentaire**.

### Modèles évalués

- Logistic Regression
- Random Forest

### Important

Le ML est :

✅ **optionnel**  
✅ **non bloquant**  
✅ **expérimental**  
✅ **secondaire**

Le moteur principal reste :

> **un moteur rule-based explicable fondé sur le graphe de compétences**

Si le service ML est indisponible :

> le système continue de fonctionner normalement.

---

# Architecture du système

AdaptiveEngine suit une **architecture microservices distribuée**.

```text
frontend-app
       │
       ▼
gateway-service
       │
 ┌─────┼───────────────────────────┐
 │     │       │        │         │
 ▼     ▼       ▼        ▼         ▼
IAM   KG   Content   Tracking  Adaptive
Service Service Service Service Engine
                                      │
                                      ▼
                               Tutoring Service
```

---

# Microservices

| Service | Rôle | Port |
|----------|------|------|
| `gateway-service` | Point d’entrée API & routage | `8080` |
| `iam-service` | Authentification JWT et gestion utilisateurs | `8081` |
| `knowledge-graph-service` | Gestion du graphe pédagogique | `8082` |
| `content-service` | Gestion des contenus pédagogiques | `8083` |
| `tracking-service` | Traces pédagogiques et analytics | `8084` |
| `adaptive-engine-service` | Génération du parcours adaptatif | `8085` |
| `tutoring-service` | Feedback pédagogique contextualisé | `8086` |
| `frontend-app` | Interface utilisateur React/Vite | `5173` |
| `model-serving` | Service ML expérimental | `8090` |

---

# Technologies utilisées

## Backend

- Java 21
- Spring Boot
- Spring Security
- Spring Cloud Gateway
- Spring Data JPA
- JWT Authentication
- REST APIs

---

## Frontend

- React
- Vite
- JavaScript
- Tailwind CSS

---

## Bases de données

| Base | Usage |
|------|------|
| PostgreSQL | Utilisateurs & tracking |
| MongoDB | Ressources pédagogiques |
| Neo4j | Graphe de compétences |

---

## Infrastructure

- Docker
- Docker Compose
- RabbitMQ
- Consul Service Discovery

---

## Machine Learning

- Python
- FastAPI
- Scikit-learn
- Random Forest
- Logistic Regression

---

# Communication événementielle

RabbitMQ est utilisé pour gérer les événements pédagogiques asynchrones.

### Événements supportés

```text
quiz.completed
lab.submitted
```

Ces événements permettent :

- le recalcul adaptatif ;
- le rafraîchissement du parcours ;
- la mise à jour du tutorat.

---

# URLs utiles

Une fois la plateforme démarrée :

```text
Frontend       → http://localhost:5173
API Gateway    → http://localhost:8080
Consul UI      → http://localhost:8500
RabbitMQ UI    → http://localhost:15672
Neo4j Browser  → http://localhost:7474
ML Service     → http://localhost:8090
```

---

# Endpoints principaux

Toutes les requêtes passent via la Gateway.

```text
/api/auth/**       → IAM Service
/api/user/**       → IAM Service
/api/admin/**      → IAM Service

/api/graph/**      → Knowledge Graph Service

/api/content/**    → Content Service

/api/traces/**     → Tracking Service
/api/labs/**       → Tracking Service
/api/tracking/**   → Tracking Service

/api/adaptive/**   → Adaptive Engine Service

/api/tutoring/**   → Tutoring Service
```

Exemples :

```http
GET /api/adaptive/path?courseId=...
POST /api/tutoring/feedback
GET /api/tracking/recommendation-traces/export
POST /api/ml/predict-success
```

---

# Installation et démarrage

## 1. Cloner le dépôt

```bash
git clone https://github.com/bouizerguane/AdaptiveEngine.git

cd AdaptiveEngine
```

---

## 2. Variables d’environnement

Copier le fichier `.env` :

```bash
copy .env.example .env
```

Configurer ensuite les variables nécessaires.

---

## 3. Lancer la plateforme

```bash
docker compose up --build -d
```

Vérifier les services :

```bash
docker compose ps
```

---

## 4. Build Backend

```bash
mvn -DskipTests package
```

---

## 5. Lancer le Frontend

```bash
cd frontend-app

npm install
npm run dev
```

---

## 6. Lancer le service ML (optionnel)

### Entraînement du modèle

```bash
python ml-experiments/run_first_ml_experiment.py --source synthetic
```

### Lancer FastAPI

```bash
cd ml-experiments/model-serving

pip install -r requirements.txt

uvicorn app:app --host 0.0.0.0 --port 8090
```

---

# Validation et tests

La plateforme inclut plusieurs mécanismes de validation :

### Tests unitaires
- JUnit

### Tests API
- Postman
- Newman

### Tests End-to-End
- Playwright

### Validation RabbitMQ
- vérification de la consommation des événements ;
- validation du rafraîchissement adaptatif.

Scénarios validés :

- authentification ;
- génération du parcours adaptatif ;
- remédiation automatique ;
- tutorat pédagogique ;
- communication interservices ;
- fallback ML ;
- respect des prérequis.

---

# Limites actuelles

- le module ML reste expérimental ;
- les données réelles d’apprentissage sont limitées ;
- pas encore de déploiement à grande échelle ;
- absence de WebSocket / temps réel ;
- monitoring avancé à compléter.

---

# Perspectives

Parmi les améliorations futures envisagées :

- intégration de données réelles ;
- amélioration du Learner Profile ;
- intégration de Knowledge Tracing ;
- amélioration de l’explicabilité ;
- adaptation temps réel ;
- dashboard analytics avancé ;
- expérimentation Reinforcement Learning.

---

# Contexte académique

**Auteur :**  
**Mohamed BOUIZERGUANE**

**Encadrant :**  
**Pr. Mohamed LACHGAR**

**Établissement :**  
École Normale Supérieure de Marrakech  
Université Cadi Ayyad

**Année universitaire :**  
2025–2026

---

# Dépôt GitHub

**Repository :**

https://github.com/bouizerguane/AdaptiveEngine
