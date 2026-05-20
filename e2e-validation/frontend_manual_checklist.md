# Checklist manuelle frontend

Route cible :

```text
http://localhost:5173/learner/courses/:courseId
```

## Préparation

1. Démarrer Docker Compose.
2. Se connecter avec un apprenant approuvé.
3. Ouvrir un cours inscrit.
4. Aller dans l'onglet `Parcours adaptatif`.

## Éléments attendus

- L'onglet `Parcours adaptatif` s'affiche sans crash.
- La carte `Prochaine étape` reste visible.
- La section `Pourquoi cette recommandation ?` apparaît si une recommandation existe.
- Les badges pédagogiques apparaissent selon le contexte :
  - `Difficultés détectées`
  - `Remédiation recommandée`
  - `Progression accélérée contrôlée`
  - `Prérequis validés`
  - `Niveau de maîtrise élevé`
- `Signal ML expérimental` apparaît uniquement si `mlSuccessProbability` est présent.
- Si le service ML est arrêté, la page ne crash pas et le signal ML disparaît proprement.
- Aucun UUID technique ne doit dominer l'affichage apprenant.
- Les explications restent en langage pédagogique compréhensible.

## Scénarios à observer

1. Apprenant avec remédiation : badge remédiation ou difficultés.
2. Apprenant high mastery : badge progression accélérée contrôlée.
3. Apprenant low data : pas de progression accélérée.
4. ML actif : signal ML visible.
5. ML arrêté : aucun crash.
