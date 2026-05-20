# E2E test data

Ce dossier contient un seed reproductible et non destructif pour les scénarios adaptatifs avancés.

Le seed utilise uniquement les APIs exposées via la gateway :

- création / approbation de comptes apprenants ;
- inscription à un cours runtime ;
- traces diagnostic et formative ;
- validation de mastery via knowledge graph.

Il n'écrit jamais directement dans PostgreSQL, MongoDB ou Neo4j.

## Learners créés

- `student.repeated.failure@test.local`
- `student.remediation.success@test.local`
- `student.high.mastery.ready@test.local`
- `student.low.data@test.local`
- `student.ml.fallback@test.local`

Mot de passe :

```text
moh123
```

## Prérequis

Le cours runtime `Algorithmique` doit exister. S'il n'existe pas, lancer :

```powershell
.\scripts\generate-runtime-dataset.ps1
```

## Exécution

Windows :

```powershell
.\e2e-validation\e2e-test-data\seed-e2e-data.ps1
```

Linux / Mac :

```bash
bash e2e-validation/e2e-test-data/seed-e2e-data.sh
```

Le script est idempotent : il réutilise les emails et les `evaluationId` stables pour éviter de créer des traces infinies.
