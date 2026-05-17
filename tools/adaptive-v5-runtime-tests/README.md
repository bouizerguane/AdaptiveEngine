# Strategie pedagogique - Runtime Tests

Validation runtime de `pedagogicalStrategy` ajoute a `/api/adaptive/path`.

Le script utilise uniquement la gateway :

```text
http://localhost:8080/api
```

Il ne modifie pas directement les bases, ne modifie pas RabbitMQ et ne change pas la logique du moteur.

## Execution

Depuis la racine du projet :

```powershell
node tools/adaptive-v5-runtime-tests/run-adaptive-v5-runtime-tests.mjs
```

## Cas couverts

- Apprenant avec lacunes : `RECOVERY`
- Apprenant sans donnees : `SUPPORTIVE`
- Apprenant en progression normale : `STANDARD`
- Apprenant performant : `ADVANCED`

## Rapports

Le script genere :

```text
tools/adaptive-v5-runtime-tests/adaptive-v5-test-report.json
tools/adaptive-v5-runtime-tests/adaptive-v5-test-report.md
```

Les rapports incluent les assertions, le profil retourne, la strategie pedagogique et la reponse adaptive path.
