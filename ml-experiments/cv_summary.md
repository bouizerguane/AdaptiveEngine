# 5-Fold Cross Validation - Rule-based vs signal ML

## Objectif

Verifier si le poids ML observe dans l'evaluation simple est robuste ou s'il depend trop de la distribution synthetique.

## Protocole

- Validation : `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)`.
- Cible : `success`.
- Dans chaque fold, le modele RandomForest est reentraine sur le train split.
- Le fichier `model.pkl` n'est pas utilise pour calculer les scores de cross validation.
- Les poids testes sont : 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4.

## Critere de selection du meilleur poids par fold

1. `PrerequisiteCompliance@3` doit rester maximal.
2. `Precision@3` ne doit pas etre inferieure a la baseline rule-based.
3. `nDCG@3` ne doit pas baisser de plus de 2%.
4. Parmi les poids admissibles, le poids qui maximise `EstimatedSuccessRate@3` est retenu.

## Frequence du meilleur poids

| ML_WEIGHT | BestFoldCount |
| --- | --- |
| 0.1500 | 1 |
| 0.2500 | 1 |
| 0.3000 | 1 |
| 0.4000 | 2 |

## Moyenne +/- ecart type par poids

| ML_WEIGHT | BestFoldCount | Precision@3 | nDCG@3 | EstimatedSuccessRate@3 |
| --- | --- | --- | --- | --- |
| 0.0000 | 0 | 0.8333 +/- 0.0295 | 0.8426 +/- 0.0315 | 0.5604 +/- 0.0538 |
| 0.0500 | 0 | 0.8333 +/- 0.0295 | 0.8469 +/- 0.0283 | 0.5797 +/- 0.0523 |
| 0.1000 | 0 | 0.8333 +/- 0.0295 | 0.8469 +/- 0.0283 | 0.5916 +/- 0.0455 |
| 0.1500 | 1 | 0.8333 +/- 0.0295 | 0.8469 +/- 0.0283 | 0.6078 +/- 0.0348 |
| 0.2000 | 0 | 0.8333 +/- 0.0295 | 0.8469 +/- 0.0283 | 0.6115 +/- 0.0315 |
| 0.2500 | 1 | 0.8333 +/- 0.0295 | 0.8426 +/- 0.0315 | 0.6147 +/- 0.0341 |
| 0.3000 | 1 | 0.8333 +/- 0.0295 | 0.8426 +/- 0.0315 | 0.6250 +/- 0.0333 |
| 0.3500 | 0 | 0.8333 +/- 0.0295 | 0.8426 +/- 0.0315 | 0.6329 +/- 0.0268 |
| 0.4000 | 2 | 0.8333 +/- 0.0295 | 0.8426 +/- 0.0315 | 0.6412 +/- 0.0240 |

## Analyse automatique

- Possible sensitivity to synthetic data distribution.
- Experimental robustness acceptable.

Poids recommande pour experimentation : `0.2`.
Poids conservateur recommande pour une integration reelle : `0.2`.

## Interpretation scientifique

La validation croisee fournit une mesure de stabilite experimentale sur le dataset synthetique controle. Si les meilleurs poids varient fortement, le resultat doit etre presente comme sensible a la distribution synthetique. Si les poids eleves restent frequents sans degradation de nDCG, le signal ML peut etre considere comme utile en tant que facteur secondaire.

## Limites

- Dataset synthetique, non issu d'un deploiement massif.
- La pertinence pedagogique reste une approximation controlee fondee sur les regles existantes.
- La cross validation mesure la robustesse experimentale du protocole, pas une performance clinique ou pedagogique reelle.
- Pour integration reelle, un poids conservateur reste preferable tant que les traces reelles sont limitees.