import csv
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
K = 3


SCENARIOS = [
    {
        "learnerId": "controlled.variables.failure",
        "situation": "Echec sur le premier concept du cours.",
        "evaluatedConcept": "variables",
        "score": 42,
        "masteryThreshold": 60,
        "detectedGaps": ["variables"],
        "generatedRecommendations": ["variables", "conditions", "boucles"],
        "expectedRecommendations": ["variables"],
        "rationale": "Le concept echoue doit etre propose en remediation avant la progression.",
    },
    {
        "learnerId": "controlled.prerequisite.gap",
        "situation": "Echec sur Conditions avec prerequis Variables non maitrise.",
        "evaluatedConcept": "conditions",
        "score": 48,
        "masteryThreshold": 60,
        "detectedGaps": ["variables", "conditions"],
        "generatedRecommendations": ["variables", "conditions", "boucles"],
        "expectedRecommendations": ["variables", "conditions"],
        "rationale": "Le prerequis faible doit preceder le concept echoue.",
    },
    {
        "learnerId": "controlled.loop.remediation",
        "situation": "Echec sur Boucles avec prerequis deja maitrises.",
        "evaluatedConcept": "boucles",
        "score": 51,
        "masteryThreshold": 60,
        "detectedGaps": ["boucles"],
        "generatedRecommendations": ["boucles", "fonctions", "tableaux"],
        "expectedRecommendations": ["boucles"],
        "rationale": "Le concept echoue est la cible directe de remediation.",
    },
    {
        "learnerId": "controlled.ready.progression",
        "situation": "Variables et Conditions maitrisees, progression normale vers Boucles.",
        "evaluatedConcept": "conditions",
        "score": 84,
        "masteryThreshold": 60,
        "detectedGaps": [],
        "generatedRecommendations": ["boucles", "fonctions", "tableaux"],
        "expectedRecommendations": ["boucles", "fonctions"],
        "rationale": "Le moteur doit recommander les concepts accessibles en respectant la chaine de prerequis.",
    },
    {
        "learnerId": "controlled.advanced.locked",
        "situation": "Fonctions echoue, Tableaux reste avance car son prerequis n'est pas maitrise.",
        "evaluatedConcept": "fonctions",
        "score": 55,
        "masteryThreshold": 60,
        "detectedGaps": ["fonctions"],
        "generatedRecommendations": ["fonctions", "boucles", "tableaux"],
        "expectedRecommendations": ["fonctions", "boucles"],
        "rationale": "La remediation porte sur le concept echoue et son voisin pedagogique proche, sans favoriser un concept avance bloque.",
    },
]


def relevance_labels(recommendations, expected, k):
    expected_set = set(expected)
    return [1 if item in expected_set else 0 for item in recommendations[:k]]


def precision_at_k(recommendations, expected, k):
    labels = relevance_labels(recommendations, expected, k)
    return sum(labels) / k


def recall_at_k(recommendations, expected, k):
    if not expected:
        return 0.0
    labels = relevance_labels(recommendations, expected, k)
    return sum(labels) / len(set(expected))


def dcg_at_k(labels):
    return sum(label / math.log2(index + 2) for index, label in enumerate(labels))


def ndcg_at_k(recommendations, expected, k):
    labels = relevance_labels(recommendations, expected, k)
    ideal_labels = sorted(labels, reverse=True)
    ideal_dcg = dcg_at_k(ideal_labels)
    if ideal_dcg == 0:
        return 0.0
    return dcg_at_k(labels) / ideal_dcg


def evaluate():
    rows = []
    for scenario in SCENARIOS:
        recommendations = scenario["generatedRecommendations"]
        expected = scenario["expectedRecommendations"]
        labels = relevance_labels(recommendations, expected, K)
        row = {
            **scenario,
            "relevanceTop3": labels,
            "Precision@3": round(precision_at_k(recommendations, expected, K), 6),
            "Recall@3": round(recall_at_k(recommendations, expected, K), 6),
            "nDCG@3": round(ndcg_at_k(recommendations, expected, K), 6),
        }
        rows.append(row)
    return rows


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def write_csv(path, rows):
    fieldnames = [
        "learnerId",
        "situation",
        "evaluatedConcept",
        "score",
        "masteryThreshold",
        "detectedGaps",
        "generatedRecommendations",
        "expectedRecommendations",
        "relevanceTop3",
        "Precision@3",
        "Recall@3",
        "nDCG@3",
        "rationale",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({
                key: json.dumps(row[key], ensure_ascii=False) if isinstance(row[key], list) else row[key]
                for key in fieldnames
            })


def write_report(path, rows):
    avg_precision = sum(row["Precision@3"] for row in rows) / len(rows)
    avg_recall = sum(row["Recall@3"] for row in rows) / len(rows)
    avg_ndcg = sum(row["nDCG@3"] for row in rows) / len(rows)

    lines = [
        "# Evaluation experimentale controlee des recommandations AdaptiveEngine",
        "",
        "Cette evaluation est une validation controlee de coherence des recommandations. "
        "Elle ne constitue pas une preuve d'efficacite pedagogique generalisable.",
        "",
        "## Protocole",
        "",
        "- Mini-cours controle : Variables, Conditions, Boucles, Fonctions, Tableaux.",
        "- Graphe de prerequis : Variables -> Conditions -> Boucles -> Fonctions -> Tableaux.",
        "- Top K evalue : K = 3.",
        "- Pertinence : une recommandation est pertinente si elle correspond au concept echoue, "
        "a un prerequis faible ou a un concept pedagogiquement proche et accessible.",
        "",
        "## Formules",
        "",
        "- Precision@K = recommandations pertinentes dans le top K / K.",
        "- Recall@K = recommandations pertinentes dans le top K / recommandations pertinentes attendues.",
        "- DCG@K = somme(rel_i / log2(i + 1)).",
        "- nDCG@K = DCG@K / IDCG@K.",
        "",
        "## Resultats",
        "",
        "| learnerId | Situation | Generees | Attendues | Precision@3 | Recall@3 | nDCG@3 |",
        "|---|---|---|---|---:|---:|---:|",
    ]
    for row in rows:
        lines.append(
            "| {learnerId} | {situation} | {generated} | {expected} | {precision:.3f} | {recall:.3f} | {ndcg:.3f} |".format(
                learnerId=row["learnerId"],
                situation=row["situation"],
                generated=", ".join(row["generatedRecommendations"]),
                expected=", ".join(row["expectedRecommendations"]),
                precision=row["Precision@3"],
                recall=row["Recall@3"],
                ndcg=row["nDCG@3"],
            )
        )
    lines.extend([
        "",
        "## Moyennes",
        "",
        f"- Precision@3 moyenne : {avg_precision:.3f}",
        f"- Recall@3 moyen : {avg_recall:.3f}",
        f"- nDCG@3 moyen : {avg_ndcg:.3f}",
        "",
        "## Texte exploitable dans le rapport",
        "",
        "Afin de repondre a la remarque relative aux metriques Precision@K, Recall@K et nDCG@K, "
        "une evaluation experimentale controlee a ete definie sur un mini-cours compose de cinq concepts "
        "ordonnes par des relations de prerequis. Les recommandations attendues ne proviennent pas d'une "
        "etude utilisateur a grande echelle, mais d'un oracle pedagogique construit a partir des regles "
        "du systeme : remediation d'un concept echoue, respect des prerequis, absence de recommandation "
        "d'un concept avance verrouille et priorite aux concepts proches de la lacune detectee. "
        "Pour chaque scenario, les recommandations produites sont comparees aux recommandations attendues "
        "a l'aide de Precision@3, Recall@3 et nDCG@3. Cette evaluation verifie donc la coherence du classement "
        "des recommandations avec les regles pedagogiques implementees, sans pretendre mesurer l'efficacite "
        "pedagogique reelle sur des apprenants.",
        "",
        "References possibles : Herlocker et al. (2004) pour Precision/Recall dans les systemes de recommandation "
        "et Jarvelin et Kekalainen (2002) pour DCG/nDCG.",
    ])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    rows = evaluate()
    write_json(ROOT / "controlled_recommendation_scenarios.json", SCENARIOS)
    write_json(ROOT / "controlled_recommendation_results.json", rows)
    write_csv(ROOT / "controlled_recommendation_results.csv", rows)
    write_report(ROOT / "controlled_recommendation_report.md", rows)
    print("Controlled recommendation evaluation generated")
    print(f"Scenarios: {len(rows)}")
    print(f"Output: {ROOT / 'controlled_recommendation_results.csv'}")
    print(f"Report: {ROOT / 'controlled_recommendation_report.md'}")


if __name__ == "__main__":
    main()
