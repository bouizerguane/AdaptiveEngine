# Evaluation experimentale controlee des recommandations AdaptiveEngine

Cette evaluation est une validation controlee de coherence des recommandations. Elle ne constitue pas une preuve d'efficacite pedagogique generalisable.

## Protocole

- Mini-cours controle : Variables, Conditions, Boucles, Fonctions, Tableaux.
- Graphe de prerequis : Variables -> Conditions -> Boucles -> Fonctions -> Tableaux.
- Top K evalue : K = 3.
- Pertinence : une recommandation est pertinente si elle correspond au concept echoue, a un prerequis faible ou a un concept pedagogiquement proche et accessible.

## Formules

- Precision@K = recommandations pertinentes dans le top K / K.
- Recall@K = recommandations pertinentes dans le top K / recommandations pertinentes attendues.
- DCG@K = somme(rel_i / log2(i + 1)).
- nDCG@K = DCG@K / IDCG@K.

## Resultats

| learnerId | Situation | Generees | Attendues | Precision@3 | Recall@3 | nDCG@3 |
|---|---|---|---|---:|---:|---:|
| controlled.variables.failure | Echec sur le premier concept du cours. | variables, conditions, boucles | variables | 0.333 | 1.000 | 1.000 |
| controlled.prerequisite.gap | Echec sur Conditions avec prerequis Variables non maitrise. | variables, conditions, boucles | variables, conditions | 0.667 | 1.000 | 1.000 |
| controlled.loop.remediation | Echec sur Boucles avec prerequis deja maitrises. | boucles, fonctions, tableaux | boucles | 0.333 | 1.000 | 1.000 |
| controlled.ready.progression | Variables et Conditions maitrisees, progression normale vers Boucles. | boucles, fonctions, tableaux | boucles, fonctions | 0.667 | 1.000 | 1.000 |
| controlled.advanced.locked | Fonctions echoue, Tableaux reste avance car son prerequis n'est pas maitrise. | fonctions, boucles, tableaux | fonctions, boucles | 0.667 | 1.000 | 1.000 |

## Moyennes

- Precision@3 moyenne : 0.533
- Recall@3 moyen : 1.000
- nDCG@3 moyen : 1.000

## Texte exploitable dans le rapport

Afin de repondre a la remarque relative aux metriques Precision@K, Recall@K et nDCG@K, une evaluation experimentale controlee a ete definie sur un mini-cours compose de cinq concepts ordonnes par des relations de prerequis. Les recommandations attendues ne proviennent pas d'une etude utilisateur a grande echelle, mais d'un oracle pedagogique construit a partir des regles du systeme : remediation d'un concept echoue, respect des prerequis, absence de recommandation d'un concept avance verrouille et priorite aux concepts proches de la lacune detectee. Pour chaque scenario, les recommandations produites sont comparees aux recommandations attendues a l'aide de Precision@3, Recall@3 et nDCG@3. Cette evaluation verifie donc la coherence du classement des recommandations avec les regles pedagogiques implementees, sans pretendre mesurer l'efficacite pedagogique reelle sur des apprenants.

References possibles : Herlocker et al. (2004) pour Precision/Recall dans les systemes de recommandation et Jarvelin et Kekalainen (2002) pour DCG/nDCG.
