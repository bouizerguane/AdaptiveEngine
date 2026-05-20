# Validation fonctionnelle finale

Ce dossier consolide les resultats runtime deja produits pour AdaptiveEngine.

Le script ne modifie aucun service, ne relance pas la logique metier et ne cree pas de donnees de test. Il lit uniquement les rapports existants :

```text
tools/adaptive-v3-runtime-tests/adaptive-v3-test-report.json
tools/adaptive-v4-runtime-tests/adaptive-v4-test-report.json
tools/adaptive-v5-runtime-tests/adaptive-v5-test-report.json
tools/tutoring-v6-runtime-tests/tutoring-v6-test-report.json
tools/runtime-validation/event-driven-refresh-tests/event-driven-refresh-test-report.json
```

## Execution

Depuis la racine du projet :

```powershell
node tools/final-validation-report/run-final-validation.mjs
```

## Sorties

Le script genere :

```text
tools/final-validation-report/final-validation-report.json
tools/final-validation-report/final-validation-report.md
```

Le rapport final contient les totaux PASS/FAIL, les durees disponibles, un resume par composant fonctionnel, des exemples de reponses reelles, les limites et une checklist screenshots pour le rapport PFE.
