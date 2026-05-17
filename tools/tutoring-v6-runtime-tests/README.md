# Feedback tutorat - Runtime Tests

Validation runtime du feedback contextualise par `pedagogicalStrategy`.

Le script utilise uniquement la gateway :

```text
http://localhost:8080/api
```

Il ne modifie pas directement les bases, ne modifie pas RabbitMQ et ne change pas la logique Adaptive Engine.

## Execution

Depuis la racine du projet :

```powershell
node tools/tutoring-v6-runtime-tests/run-tutoring-v6-runtime-tests.mjs
```

## Cas couverts

- `RECOVERY` -> `REMEDIATION_FEEDBACK`
- `SUPPORTIVE` -> `GUIDED_SUPPORT`
- `STANDARD` -> `STANDARD_GUIDANCE`
- `ADVANCED` -> `ENRICHMENT_FEEDBACK`
- Fallback sans `strategyType` -> logique historique par `eventType`

## Rapports

Le script genere :

```text
tools/tutoring-v6-runtime-tests/tutoring-v6-test-report.json
tools/tutoring-v6-runtime-tests/tutoring-v6-test-report.md
```
