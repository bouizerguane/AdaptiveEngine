# Runtime Validation

Ce dossier fournit un point d'entree neutre pour les validations runtime finales d'AdaptiveEngine.

Les anciens dossiers de tests sont conserves pour compatibilite avec l'historique Git, les rapports existants et les scripts deja referencees. Ils representent des couches fonctionnelles du moteur final, pas des versions exposees a l'utilisateur.

## Correspondance fonctionnelle

| Chemin historique | Couche fonctionnelle |
| --- | --- |
| `tools/adaptive-v3-runtime-tests` | Scoring explicable |
| `tools/adaptive-v4-runtime-tests` | Profil apprenant |
| `tools/adaptive-v5-runtime-tests` | Strategie pedagogique |
| `tools/tutoring-v6-runtime-tests` | Feedback tutorat |
| `tools/final-validation-report` | Validation fonctionnelle finale |

## Execution complete

Depuis la racine du projet :

```powershell
node tools/runtime-validation/run-all-runtime-validation.mjs
```

Le script execute successivement les validations de scoring explicable, profil apprenant, strategie pedagogique, feedback tutorat, puis regenere le rapport final consolide.

## Contraintes

- Utilisation exclusive de la gateway `http://localhost:8080/api`.
- Aucune ecriture directe en base.
- Aucune modification de RabbitMQ.
- Aucun changement de logique metier.
