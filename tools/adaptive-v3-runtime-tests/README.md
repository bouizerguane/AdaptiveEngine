# Adaptive Engine V3 Runtime Tests

Framework de validation runtime pour `adaptive-engine-service` V3.

Ce dossier ne modifie pas le moteur, ne modifie pas RabbitMQ et n'écrit jamais directement en base. Le script utilise uniquement les APIs exposees par la gateway :

```text
http://localhost:8080/api
```

## Prerequis

- Stack AdaptiveEngine demarree.
- Dataset pedagogique existant charge : Algorithmique, Programmation en C, Structures de donnees.
- Compte admin disponible :
  - email par defaut : `admin@system.com`
  - mot de passe lu depuis `ADMIN_DEFAULT_PASSWORD` dans `.env`, sinon `admin123`

Variables optionnelles :

```powershell
$env:ADAPTIVE_API_BASE_URL="http://localhost:8080/api"
$env:ADAPTIVE_ADMIN_EMAIL="admin@system.com"
$env:ADAPTIVE_ADMIN_PASSWORD="admin123"
```

## Execution

Depuis la racine du projet :

```powershell
node tools/adaptive-v3-runtime-tests/run-adaptive-v3-runtime-tests.mjs
```

## Ce que le script teste

- Creation et approbation automatique des apprenants de test.
- Inscription aux cours via API.
- Simulation de diagnostics via `/api/traces` et `/api/graph/adaptive/diagnostic`.
- Appel reel de `/api/adaptive/path`.
- Assertions sur :
  - `nextAction`
  - `nextConcept`
  - `adaptiveScore`
  - `scoreBreakdown`
  - `explanationReasons`
  - `decisionExplanation`
  - tri des `learnableConcepts` par score adaptatif decroissant
  - influence du score d'engagement

Cas couverts :

- A1 : apprenant fort avec une lacune detectee au diagnostic, donc `REMEDIATION`.
- A2 : apprenant fort sans lacune detectee, donc scoring V3 en mode `LEARN`.
- B : apprenant faible avec prerequis critique a remedier.
- C : concept externe detecte dans le diagnostic.
- D : comparaison de l'effet engagement sur le score adaptatif.

## Rapports generes

Le script ecrit :

```text
tools/adaptive-v3-runtime-tests/adaptive-v3-test-report.json
tools/adaptive-v3-runtime-tests/adaptive-v3-test-report.md
```

Les rapports contiennent les valeurs attendues, les valeurs observees, le statut PASS/FAIL, les reponses adaptive path et les explications.
