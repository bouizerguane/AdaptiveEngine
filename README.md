# AdaptiveEngine

Plateforme d'apprentissage adaptatif organisee en microservices Spring Boot et une application React/Vite.

## Architecture

```text
frontend-app -> gateway-service -> iam-service
                              -> knowledge-graph-service
                              -> content-service
                              -> tracking-service

Consul assure la decouverte des services pour la gateway et les appels internes load-balances.
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

## Bases de donnees

| Conteneur | Usage | Ports |
| --- | --- | --- |
| `postgres-iam` | Base IAM `iam_db` | interne Docker |
| `postgres-tracking` | Base tracking `tracking_db` | `5434:5432` |
| `neo4j-graph` | Graphe pedagogique Neo4j | `7474`, `7687` |
| `mongodb-content` | Contenus, evaluations, labs | interne Docker |
| `consul` | Service discovery | `8500` |

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

4. Acceder aux interfaces :

```text
Frontend:      http://localhost:5173
API Gateway:   http://localhost:8080
Consul UI:     http://localhost:8500
Neo4j Browser: http://localhost:7474
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

## Securite actuelle

- Le JWT est emis et valide dans `iam-service`.
- Les autres services restent largement ouverts pour l'instant.
- La prochaine etape recommandee est de centraliser la validation JWT dans `gateway-service`, puis de propager les claims utilisateur vers les services internes.

## Limites connues

- Pas encore de validation JWT centralisee dans la gateway.
- Pas de broker de messages; les communications sont HTTP synchrones.
- Pas de moteur ML/LSTM implemente dans ce depot.
- Pas de tests automatises detectes.
- Pas de documentation OpenAPI/Swagger.
- Les dossiers generes (`node_modules`, `target`, `dist`) et uploads locaux doivent rester exclus du controle de version.
