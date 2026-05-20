# Evaluation comparative rule-based vs signal ML

## Protocole experimental

Cette evaluation compare le classement produit par le score rule-based existant (`adaptiveScore`) avec un classement hybride qui ajoute un signal ML secondaire.

Formule hybride :

```text
combinedScore = (1 - ML_WEIGHT) * adaptiveScore + ML_WEIGHT * mlSuccessProbability
```

Poids ML testes : 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4. Le score rule-based reste dominant dans tous les cas.

## Hypothese

L'ajout d'un signal ML secondaire peut ameliorer le classement des recommandations pedagogiques sans remplacer la logique pedagogique explicable.

## Dataset

- Source : `ml-experiments\synthetic-recommendation-traces-cleaned.csv`
- Lignes : 250
- Nature : dataset synthetique controle genere depuis le schema RecommendationTrace d'AdaptiveEngine.
- Le dataset ne remplace pas une validation a grande echelle sur des traces reelles.

## Pertinence pedagogique controlee

La colonne `relevance_label` est construite sans utiliser la cible `success`. Elle s'appuie sur les regles presentes dans le moteur : progression normale de type READY, remediation justifiee par faiblesse diagnostique, respect des prerequis et coherence avec le profil de maitrise.

## Metriques

- Precision@K, K = 1, 3, 5
- nDCG@K, K = 1, 3, 5
- Estimated Success Rate
- Prerequisite Compliance Rate
- Recommendation Diversity
- Generation Time

## Resultats agreges

| method | generationTimeMs | precision@1 | ndcg@1 | estimatedSuccessRate@1 | prerequisiteCompliance@1 | diversity@1 | precision@3 | ndcg@3 | estimatedSuccessRate@3 | prerequisiteCompliance@3 | diversity@3 | precision@5 | ndcg@5 | estimatedSuccessRate@5 | prerequisiteCompliance@5 | diversity@5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rule_based | 2.1593 | 0.8750 | 0.8750 | 0.6038 | 1.0000 | 1.0000 | 0.8333 | 0.8457 | 0.5709 | 1.0000 | 1.1250 | 0.8500 | 0.8538 | 0.5768 | 1.0000 | 1.2500 |
| rule_based_ml_0.05 | 3.2919 | 0.8750 | 0.8750 | 0.6038 | 1.0000 | 1.0000 | 0.8333 | 0.8457 | 0.6158 | 1.0000 | 1.1250 | 0.8500 | 0.8538 | 0.6172 | 1.0000 | 1.1250 |
| rule_based_ml_0.1 | 3.1867 | 0.8750 | 0.8750 | 0.6038 | 1.0000 | 1.0000 | 0.8333 | 0.8457 | 0.6158 | 1.0000 | 1.1250 | 0.8500 | 0.8538 | 0.6329 | 1.0000 | 1.1250 |
| rule_based_ml_0.15 | 3.3058 | 0.8750 | 0.8750 | 0.6333 | 1.0000 | 1.0000 | 0.8333 | 0.8380 | 0.6468 | 1.0000 | 1.1250 | 0.8500 | 0.8483 | 0.6559 | 1.0000 | 1.1250 |
| rule_based_ml_0.2 | 3.3598 | 0.8750 | 0.8750 | 0.6831 | 1.0000 | 1.0000 | 0.8333 | 0.8380 | 0.6755 | 1.0000 | 1.1250 | 0.8500 | 0.8483 | 0.6820 | 1.0000 | 1.1250 |
| rule_based_ml_0.25 | 3.1713 | 0.8750 | 0.8750 | 0.7582 | 1.0000 | 1.0000 | 0.8333 | 0.8380 | 0.7152 | 1.0000 | 1.1250 | 0.8500 | 0.8483 | 0.6925 | 1.0000 | 1.1250 |
| rule_based_ml_0.3 | 3.3849 | 0.8750 | 0.8750 | 0.7582 | 1.0000 | 1.0000 | 0.8333 | 0.8380 | 0.7417 | 1.0000 | 1.1250 | 0.8500 | 0.8483 | 0.7123 | 1.0000 | 1.1250 |
| rule_based_ml_0.35 | 3.7467 | 0.8750 | 0.8750 | 0.7724 | 1.0000 | 1.0000 | 0.8333 | 0.8457 | 0.7498 | 1.0000 | 1.1250 | 0.8500 | 0.8538 | 0.7321 | 1.0000 | 1.1250 |
| rule_based_ml_0.4 | 2.8511 | 0.8750 | 0.8750 | 0.7874 | 1.0000 | 1.0000 | 0.8750 | 0.8750 | 0.7673 | 1.0000 | 1.0000 | 0.8500 | 0.8567 | 0.7702 | 0.9000 | 1.1250 |

## Interpretation

- Meilleure Precision@3 moyenne : `rule_based_ml_0.4` (0.875).
- Meilleur nDCG@3 moyen : `rule_based_ml_0.4` (0.875).
- Les differences doivent etre interpretees comme une validation experimentale du protocole, pas comme une preuve de performance en conditions reelles.

## Analyse de sensibilite du poids ML

Plusieurs poids ML sont testes afin d'observer l'effet d'un signal predictif secondaire sans remplacer le moteur pedagogique explicable. Le poids `0.0` correspond au rule-based pur, puis les poids augmentent progressivement jusqu'a `0.4`, ce qui laisse toujours le score rule-based majoritaire.

Critere de selection : le respect des prerequis a Precision@3 doit rester maximal, Precision@3 ne doit pas baisser par rapport a la baseline, nDCG@3 ne doit pas perdre plus de 2%, puis le poids retenu maximise EstimatedSuccessRate@3.

Le meilleur compromis experimental est `ML_WEIGHT=0.4` avec Precision@3=0.8750, nDCG@3=0.8750, EstimatedSuccessRate@3=0.7673.

| ML_WEIGHT | Precision@3 | nDCG@3 | EstimatedSuccessRate@3 | PrerequisiteCompliance@3 | GenerationTime | nDCGDropPercent | SuccessRateGainPercent | SelectedBestWeight |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.0000 | 0.8333 | 0.8457 | 0.5709 | 1.0000 | 2.1593 | 0.0000 | 0.0000 | False |
| 0.0500 | 0.8333 | 0.8457 | 0.6158 | 1.0000 | 3.2919 | 0.0000 | 7.8557 | False |
| 0.1000 | 0.8333 | 0.8457 | 0.6158 | 1.0000 | 3.1867 | 0.0000 | 7.8557 | False |
| 0.1500 | 0.8333 | 0.8380 | 0.6468 | 1.0000 | 3.3058 | 0.9082 | 13.3006 | False |
| 0.2000 | 0.8333 | 0.8380 | 0.6755 | 1.0000 | 3.3598 | 0.9082 | 18.3275 | False |
| 0.2500 | 0.8333 | 0.8380 | 0.7152 | 1.0000 | 3.1713 | 0.9082 | 25.2818 | False |
| 0.3000 | 0.8333 | 0.8380 | 0.7417 | 1.0000 | 3.3849 | 0.9082 | 29.9113 | False |
| 0.3500 | 0.8333 | 0.8457 | 0.7498 | 1.0000 | 3.7467 | 0.0000 | 31.3261 | False |
| 0.4000 | 0.8750 | 0.8750 | 0.7673 | 1.0000 | 2.8511 | 0.0000 | 34.4043 | True |

Cette analyse montre si le ML ameliore surtout le succes estime et si un poids plus eleve degrade legerement le classement pedagogique. Le moteur rule-based reste dominant car le score hybride conserve au minimum 60% de poids rule-based dans le test le plus favorable au ML.

## Robustesse

Le script verifie le cas avec modele disponible et documente le fallback : si le modele ML est indisponible, le classement revient au score rule-based seul.

## Limites

- Dataset synthetique controle, non issu d'un deploiement massif.
- La pertinence pedagogique est une approximation construite a partir des regles existantes.
- Les resultats ne sont pas generalisables sans traces reelles plus nombreuses.
- L'integration ML reste secondaire et experimentale.

## Fichiers produits

- `ml-experiments/evaluation_results.json`
- `ml-experiments/rule_based_vs_ml.csv`
- `ml-experiments/precision_at_k.png`
- `ml-experiments/ndcg_comparison.png`
- `ml-experiments/generation_time.png`
- `ml-experiments/success_rate_comparison.png`
- `ml-experiments/ml_weight_sensitivity.csv`
- `ml-experiments/ml_weight_sensitivity.png`