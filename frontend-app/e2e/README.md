# Validation E2E apprenant

Ce test Playwright valide le parcours frontend principal de l'apprenant :

1. connexion avec un compte E2E existant ;
2. affichage du dashboard apprenant et de la recommandation AdaptiveEngine ;
3. ouverture d'un cours ;
4. consultation de l'onglet `Parcours adaptatif` ;
5. consultation de l'onglet `Remediation`, avec contenu ou etat vide accepte.

## Prerequis

- Gateway et microservices AdaptiveEngine disponibles sur `http://localhost:8080`.
- Frontend disponible sur `http://localhost:5173`, ou laisse a Playwright le demarrage de Vite.
- Donnees E2E existantes :

```text
student.profile.high@test.local
moh123
```

Pour regenerer les donnees E2E depuis la racine du depot :

```bash
node e2e-validation/e2e-test-data/seed-e2e-data.mjs
```

## Installation

Depuis `frontend-app` :

```bash
npm install
npx playwright install chromium
```

## Execution

```bash
npm run test:e2e
npm run test:e2e:headed
```

Variables optionnelles :

```text
PLAYWRIGHT_BASE_URL
E2E_LEARNER_EMAIL
E2E_LEARNER_PASSWORD
```
