# Adaptive Engine V4 Runtime Tests

Validation runtime du `LearnerProfileDto` ajoute a `/api/adaptive/path`.

Le script utilise uniquement la gateway :

```text
http://localhost:8080/api
```

Il ne modifie pas directement les bases, ne modifie pas RabbitMQ et ne change pas la logique du moteur.

## Execution

Depuis la racine du projet :

```powershell
node tools/adaptive-v4-runtime-tests/run-adaptive-v4-runtime-tests.mjs
```

## Cas couverts

- Apprenant sans donnees : `DATA_INSUFFICIENT`
- Apprenant avec lacunes : `NEEDS_REMEDIATION`
- Apprenant actif sans lacunes : `PROGRESSING`
- Apprenant ayant termine les concepts requis : `HIGH_PERFORMING`

## Rapports

Le script genere :

```text
tools/adaptive-v4-runtime-tests/adaptive-v4-test-report.json
tools/adaptive-v4-runtime-tests/adaptive-v4-test-report.md
```

Les rapports incluent les assertions, le profil retourne, les champs KMS et la reponse adaptive path.

