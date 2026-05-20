# AdaptiveEngine

AdaptiveEngine est une plateforme pédagogique adaptative organisée en microservices Spring Boot, avec une interface React/Vite. Le système actuel est un moteur adaptatif rule-based explicable : il exploite le graphe de prérequis, les traces d'apprentissage, les diagnostics, les TP et le profil apprenant. Le projet est préparé pour une future phase ML grâce à la journalisation `RecommendationTrace`, mais aucun modèle ML réel n'est intégré pour le moment.

## 1. Architecture microservices

```text
frontend-app
   -> gateway-service
      -> iam-service
      -> knowledge-graph-service
      -> content-service
      -> tracking-service
      -> adaptive-engine-service
      -> tutoring-service
```

| Service | Rôle réel | Port |
| --- | --- | --- |
| `gateway-service` | Point d'entrée API, routage Spring Cloud Gateway via Consul | `8080` |
| `iam-service` | Authentification JWT, utilisateurs, rôles, paramètres système | `8081` |
| `knowledge-graph-service` | Cours, modules, chapitres, concepts, prérequis, maîtrise Neo4j | `8082` |
| `content-service` | Ressources, évaluations, questions, labs, uploads médias | `8083` |
| `tracking-service` | Traces, soumissions TP, événements de fraîcheur, RecommendationTrace, analytics enseignant | `8084` |
| `adaptive-engine-service` | Génération du parcours adaptatif, profil apprenant, PLP, remédiation explicable | `8085` |
| `tutoring-service` | Feedback pédagogique contextualisé | `8086` |
| `frontend-app` | Interface React/Vite servie en Docker | `5173` |

## 2. Bases de données

| Base | Usage |
| --- | --- |
| PostgreSQL IAM | Utilisateurs, rôles, comptes de test, paramètres IAM |
| PostgreSQL Tracking | Traces, soumissions de TP, événements adaptatifs persistés, RecommendationTrace |
| MongoDB Content | Ressources, évaluations, questions, labs |
| Neo4j Knowledge Graph | Graphe de cours/concepts/prérequis et état de maîtrise |

## 3. Infrastructure

La stack locale utilise Docker Compose avec :

- `consul-server` pour la découverte de services ;
- `rabbitmq` pour les événements `quiz.completed` et `lab.submitted` ;
- `postgres-iam` et `postgres-tracking` ;
- `mongodb-content` ;
- `neo4j-graph` ;
- les sept microservices backend ;
- `frontend-app`.

Interfaces utiles :

```text
Frontend:      http://localhost:5173
API Gateway:   http://localhost:8080
Consul UI:     http://localhost:8500
Neo4j Browser: http://localhost:7474
RabbitMQ UI:   http://localhost:15672
```

## 4. Fonctionnalités principales

- gestion des utilisateurs et authentification JWT ;
- gestion des cours, modules, chapitres, concepts et prérequis ;
- gestion des ressources pédagogiques avec image, vidéo et PDF sous forme de lien ouvrable ;
- évaluations de positionnement, formatives et validation finale de cours ;
- suivi des traces d'apprentissage et soumissions de TP ;
- Learner Profile calculé à la demande ;
- Personalized Learning Path avec statuts `TO_REVIEW`, `READY`, `LOCKED`, `COMPLETED` ;
- remédiation explicable ;
- feedback tutorat contextualisé ;
- règles post-activité :
  - Repeated Failure ;
  - Remediation Success ;
  - High Mastery ;
- `RecommendationTrace` ML-ready avec protection anti-duplication ;
- export du dataset de recommandations.

## 5. Moteur adaptatif

Le moteur actuel est :

- rule-based ;
- explicable ;
- fondé sur le graphe de connaissances ;
- learner-aware ;
- basé sur un scoring multicritère pondéré.

Il ne contient pas de TensorFlow, PyTorch, LSTM, RL, GNN ou autre modèle ML. La préparation ML repose uniquement sur la collecte de traces structurées permettant de constituer un futur dataset.

## 6. Endpoints utiles

Tous les appels applicatifs passent par la gateway :

```text
GET  http://localhost:8080/api/adaptive/path?courseId=...
GET  http://localhost:8080/api/tracking/recommendation-traces/export
POST http://localhost:8080/api/tutoring/feedback
```

Routes principales :

```text
/api/auth/**      -> iam-service
/api/user/**      -> iam-service
/api/admin/**     -> iam-service
/api/graph/**     -> knowledge-graph-service
/api/content/**   -> content-service
/api/traces/**    -> tracking-service
/api/labs/**      -> tracking-service
/api/tracking/**  -> tracking-service
/api/adaptive/**  -> adaptive-engine-service
/api/tutoring/**  -> tutoring-service
```

## 7. Commandes de lancement

Copier le fichier d'environnement :

```bash
copy .env.example .env
```

Démarrer la plateforme :

```bash
docker compose up --build -d
docker compose ps
```

Build backend, depuis la racine si Maven parent est disponible ou depuis chaque service :

```bash
mvn -q -DskipTests package
```

Build frontend :

```bash
cd frontend-app
npm run build
```

## 8. Comptes de test

Les comptes de test dépendent du seed IAM présent au démarrage. Vérifier `iam-service/src/main/java/com/ale/iam/DataSeeder.java` pour la liste exacte des comptes créés dans votre dépôt courant.

## 9. Configuration

Les variables locales sont décrites dans `.env.example`. Ne pas versionner de vrais secrets dans `.env`.

Variables importantes :

- `JWT_SECRET`
- variables PostgreSQL IAM et Tracking ;
- variables MongoDB ;
- variables Neo4j ;
- variables RabbitMQ ;
- `VITE_API_URL`
- `GATEWAY_STARTUP_DELAY_SECONDS`

## 10. Limites connues

- aucun modèle ML réel n'est encore intégré ;
- le système est ML-ready via `RecommendationTrace`, mais l'entraînement et l'inférence sont à venir ;
- Swagger/OpenAPI n'est pas généralisé sur tous les services ;
- le monitoring avancé reste à ajouter ;
- pas de WebSocket ni de push temps réel : le recalcul adaptatif est déclenché au retour/navigation via appels API ;
- RabbitMQ complète le flux REST, mais ne remplace pas l'orchestration principale.
