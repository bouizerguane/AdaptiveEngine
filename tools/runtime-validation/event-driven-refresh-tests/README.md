# Rafraichissement evenementiel persistant - Runtime Tests

Validation runtime du rafraichissement adaptatif declenche par les evenements RabbitMQ existants.

Le script utilise uniquement la gateway :

```text
http://localhost:8080/api
```

Il ne modifie pas directement les bases, ne cree pas de nouveau contrat RabbitMQ et ne change pas la logique metier du moteur adaptatif.

## Execution

Depuis la racine du projet :

```powershell
node tools/runtime-validation/event-driven-refresh-tests/run-event-driven-refresh-tests.mjs
```

## Cas couverts

- Trace quiz publiee via `/api/traces` puis detection `pathFreshness.refreshedAfterEvent = true`.
- Deuxieme appel `/api/adaptive/path` apres consommation : `refreshedAfterEvent = false`.
- Verification via tracking-service : `pending = false` apres consommation.
- Soumission TP via `/api/labs/submit` puis detection `pathFreshness.refreshedAfterEvent = true`.
- Le scenario de redemarrage d'`adaptive-engine-service` est documente comme validation manuelle possible, car il depend de Docker dans l'environnement local.

## Rapports

Le script genere :

```text
tools/runtime-validation/event-driven-refresh-tests/event-driven-refresh-test-report.json
tools/runtime-validation/event-driven-refresh-tests/event-driven-refresh-test-report.md
```
