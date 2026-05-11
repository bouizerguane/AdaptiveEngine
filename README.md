# AdaptiveEngine

Plateforme d'apprentissage adaptatif organisee en microservices Spring Boot et une application React/Vite.

## Architecture

```text
frontend-app -> gateway-service -> iam-service
                              -> knowledge-graph-service
                              -> content-service
                              -> tracking-service
                              -> adaptive-engine-service
                              -> tutoring-service

Consul assure la decouverte des services pour la gateway et les appels internes load-balances.
RabbitMQ est utilise comme canal evenementiel complementaire. Les appels REST restent le flux principal.
```

## Services

| Service | Role | Port |
| --- | --- | --- |
| `frontend-app` | Interface React/Vite servie par Nginx en Docker | `5173` |
| `gateway-service` | Point d'entree API, routes `lb://` via Consul | `8080` |
| `iam-service` | Authentification JWT, utilisateurs, roles, parametres systeme | `8081` |
| `knowledge-graph-service` | Graphe pedagogique, cours/modules/chapitres/concepts, maitrise | `8082` |
| `content-service` | Contenus, evaluations, labs, uploads media | `8083` |
| `tracking-service` | Traces d'apprentissage, soumissions de labs, dashboard enseignant | `8084` |
| `adaptive-engine-service` | Orchestration du parcours adaptatif | `8085` |
| `tutoring-service` | Feedbacks pedagogiques simples et consommation d'evenements | `8086` |

## Bases de donnees

| Conteneur | Usage | Ports |
| --- | --- | --- |
| `postgres-iam` | Base IAM `iam_db` | interne Docker |
| `postgres-tracking` | Base tracking `tracking_db` | `5434:5432` |
| `neo4j-graph` | Graphe pedagogique Neo4j | `7474`, `7687` |
| `mongodb-content` | Contenus, evaluations, labs | interne Docker |
| `consul` | Service discovery | `8500` |
| `rabbitmq` | Broker evenementiel complementaire + management UI | `5672`, `15672` |

## Routes Gateway

La gateway expose les routes suivantes sur `http://localhost:8080` :

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

## RabbitMQ V1

RabbitMQ est ajoute comme canal evenementiel complementaire. Il ne remplace pas les appels REST existants : les soumissions de TP continuent a etre enregistrees par `tracking-service` via REST et l'evenement est publie ensuite.

Interface de gestion :

```text
RabbitMQ Management UI: http://localhost:15672
```

Variables d'environnement :

```text
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=change_me_rabbitmq_password
GATEWAY_STARTUP_DELAY_SECONDS=30
```

`GATEWAY_STARTUP_DELAY_SECONDS` laisse le temps aux services applicatifs de terminer leur enregistrement Consul avant que la gateway accepte du trafic. Cela reduit les erreurs `503 Service Unavailable` juste apres un `docker compose up --build`.

Evenements publies :

```text
exchange: adaptive.events
routingKey: lab.submitted
queue consommateur: tutoring.lab-submitted
queue consommateur: adaptive.lab-submitted

routingKey: quiz.completed
queue consommateur: tutoring.quiz-completed
queue consommateur: adaptive.quiz-completed
```

Payload `lab.submitted` :

```json
{
  "learnerEmail": "student@test.com",
  "courseId": "course-id",
  "conceptId": "concept-id",
  "labId": "lab-id",
  "status": "COMPLETED",
  "timestamp": "2026-05-10T12:00:00"
}
```

Payload `quiz.completed` :

```json
{
  "learnerEmail": "student@test.com",
  "courseId": "course-id",
  "targetId": "concept-id",
  "targetType": "CONCEPT",
  "evaluationId": "evaluation-id",
  "typeEvaluation": "FORMATIVE",
  "score": 85.0,
  "masterySource": "QUIZ_DIRECT",
  "conceptResults": "[...]",
  "timestamp": "2026-05-10T12:00:00"
}
```

Si RabbitMQ est indisponible, la soumission TP reste valide. `tracking-service` journalise seulement un warning `event publish failed`.

`adaptive-engine-service` ecoute aussi `lab.submitted` et `quiz.completed` en lecture seule. Cette ecoute prepare une future adaptation evenementielle, mais ne declenche pas encore de recalcul automatique et ne modifie aucune base.

### Probleme RabbitMQ - cookie Erlang et volume Docker

RabbitMQ stocke un fichier interne `.erlang.cookie` dans son volume de donnees. Si un ancien volume Docker a ete cree avec de mauvais droits, le conteneur peut sortir avec :

```text
Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces
```

En developpement, supprimer uniquement le volume RabbitMQ permet de repartir proprement. RabbitMQ reste un canal evenementiel complementaire : les donnees metier sont dans PostgreSQL, MongoDB et Neo4j.

```bash
docker compose down
docker volume rm adaptiveengine_rabbitmq_data
docker compose up --build
```

## Configuration locale

1. Copier le modele d'environnement :

```bash
copy .env.example .env
```

2. Remplacer les valeurs `change_me_*` dans `.env`.

3. Demarrer l'ensemble de la stack :

```bash
docker compose up --build
```

## Probleme MongoDB - identifiants et volume Docker

MongoDB cree ses utilisateurs uniquement lors de la premiere initialisation du volume Docker. Si les identifiants Mongo changent ensuite dans `.env`, le volume existant garde les anciens utilisateurs.

Symptomes possibles dans `content-service` :

```text
POST /api/content/save        -> 500
POST /api/content/evaluations -> 500
POST /api/content/labs        -> 500
Authentication failed
```

Solution en developpement : reinitialiser uniquement le volume MongoDB, puis relancer la stack.

```bash
docker compose down
docker volume rm adaptiveengine_mongo_data
docker compose up --build
```

Attention : cette commande supprime les donnees MongoDB existantes, donc les contenus, evaluations et labs deja enregistres. Elle ne supprime pas le code du projet.

4. Acceder aux interfaces :

```text
Frontend:      http://localhost:5173
API Gateway:   http://localhost:8080
Consul UI:     http://localhost:8500
Neo4j Browser: http://localhost:7474
RabbitMQ UI:   http://localhost:15672
```

## Lancement local hors Docker

Demarrer d'abord l'infrastructure avec Docker, puis lancer chaque service depuis son dossier :

```bash
mvn spring-boot:run
```

Pour le frontend :

```bash
cd frontend-app
npm install
npm run dev
```

Par defaut, le frontend utilise `VITE_API_URL` si defini, sinon `http://localhost:8080/api`.

## Compte admin de developpement

Au premier demarrage, `iam-service` cree un compte :

```text
Email: admin@system.com
Mot de passe: valeur de ADMIN_DEFAULT_PASSWORD
```

Ne pas utiliser la valeur de demonstration en production.

Si le volume PostgreSQL IAM existe deja, le compte `admin@system.com` peut conserver un ancien mot de passe. Dans ce cas, trois options existent en developpement :

1. Utiliser l'ancien mot de passe si vous le connaissez.
2. Activer temporairement le reset au demarrage :

```env
ADMIN_RESET_ON_STARTUP=true
```

Puis redemarrer `iam-service` :

```bash
docker compose up --build -d iam-service
```

Le service met alors a jour le mot de passe avec `ADMIN_DEFAULT_PASSWORD`, force le role `ADMIN` et garde `estApprouve=true`. Le log attendu est :

```text
Default admin password reset because ADMIN_RESET_ON_STARTUP=true
```

Apres verification de la connexion, remettre :

```env
ADMIN_RESET_ON_STARTUP=false
```

3. En developpement uniquement, supprimer le volume PostgreSQL IAM pour repartir d'une base vide. Cette option supprime les utilisateurs IAM existants.

## Securite actuelle

- Le JWT est emis par `iam-service`.
- Le JWT est valide dans `gateway-service` par un filtre global.
- La gateway extrait l'email et le role du token, puis propage les headers internes :

```text
X-User-Email
X-User-Role
```

- Les routes critiques sont protegees par role au niveau gateway :
  - `ADMIN` : `/api/admin/**`, `/api/graph/admin/**`, `/api/content/admin/**`
  - `TEACHER` / `ADMIN` : dashboard enseignant, gestion des inscriptions, creation/modification cours/contenus/evaluations/TP
  - `STUDENT` : inscription a un cours, traces, soumission TP, validation de sa propre maitrise
- Les endpoints non explicitement autorises sont refuses par defaut par la gateway.
- Les microservices gardent des controles simples sur les endpoints sensibles et utilisent `X-User-Email` en priorite lorsque le header est present.

## Limites connues

- Les microservices restent accessibles sans authentification forte s'ils sont exposes directement hors reseau Docker. En usage normal, le point d'entree doit rester `gateway-service`.
- Certains appels frontend conservent encore des parametres d'identite (`learnerEmail`, `teacherEmail`, `userId`) pour compatibilite, mais les backends privilegient les headers injectes par la gateway.
- RabbitMQ V1 est complementaire uniquement; REST reste la source principale et aucun traitement metier ne depend encore du broker.
- `adaptive-engine-service` et `tutoring-service` consomment les evenements RabbitMQ en lecture seule pour preparer l'evolution evenementielle.
- Pas de moteur ML/LSTM implemente dans ce depot.
- Pas de tests automatises detectes.
- Pas de documentation OpenAPI/Swagger.
- Les dossiers generes (`node_modules`, `target`, `dist`) et uploads locaux doivent rester exclus du controle de version.
