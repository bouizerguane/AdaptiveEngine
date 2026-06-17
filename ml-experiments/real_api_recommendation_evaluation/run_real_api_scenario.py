import csv
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = os.environ.get("AE_BASE_URL", "http://localhost:8080").rstrip("/")
TEACHER_EMAIL = os.environ.get("AE_TEACHER_EMAIL", "bouizerguane@gmail.com")
TEACHER_PASSWORD = os.environ.get("AE_TEACHER_PASSWORD", "moh123")
LEARNER_EMAIL = os.environ.get("AE_LEARNER_EMAIL", "kamal@gmail.com")
LEARNER_PASSWORD = os.environ.get("AE_LEARNER_PASSWORD", "kamal123")

OUT_DIR = Path(__file__).resolve().parent
K = 3

COURSE_ID = "ae-real-api-course-programming"
COURSE_TITLE = "Introduction à la programmation adaptative"

CONCEPTS = [
    {
        "id": "ae-real-concept-variables",
        "label": "Variables",
        "description": "Déclaration, affectation et utilisation des variables.",
        "chapterId": "ae-real-chapter-variables-conditions",
        "orderIndex": 0,
    },
    {
        "id": "ae-real-concept-conditions",
        "label": "Conditions",
        "description": "Structures conditionnelles et branchements simples.",
        "chapterId": "ae-real-chapter-variables-conditions",
        "orderIndex": 1,
    },
    {
        "id": "ae-real-concept-boucles",
        "label": "Boucles",
        "description": "Structures répétitives while et for.",
        "chapterId": "ae-real-chapter-loops",
        "orderIndex": 2,
    },
    {
        "id": "ae-real-concept-fonctions",
        "label": "Fonctions",
        "description": "Décomposition du programme en fonctions réutilisables.",
        "chapterId": "ae-real-chapter-functions-arrays",
        "orderIndex": 3,
    },
    {
        "id": "ae-real-concept-tableaux",
        "label": "Tableaux",
        "description": "Manipulation de collections indexées.",
        "chapterId": "ae-real-chapter-functions-arrays",
        "orderIndex": 4,
    },
]

PREREQUISITES = [
    ("ae-real-concept-variables", "ae-real-concept-conditions"),
    ("ae-real-concept-conditions", "ae-real-concept-boucles"),
    ("ae-real-concept-boucles", "ae-real-concept-fonctions"),
    ("ae-real-concept-fonctions", "ae-real-concept-tableaux"),
]

EXPECTED_RECOMMENDATIONS = ["ae-real-concept-conditions"]


class ScenarioRunner:
    def __init__(self):
        self.payloads = {}
        self.responses = {}
        self.teacher_token = None
        self.learner_token = None

    def request_json(self, step, method, path, payload=None, token=None, expected=(200, 201, 204), pause=0):
        url = f"{BASE_URL}{path}"
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json; charset=utf-8"
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        self.payloads[step] = {
            "method": method,
            "url": url,
            "payload": payload,
        }

        request = Request(url, data=data, headers=headers, method=method)
        started = time.time()
        try:
            with urlopen(request, timeout=20) as response:
                raw = response.read().decode("utf-8")
                body = parse_json(raw)
                record = {
                    "status": response.status,
                    "durationMs": round((time.time() - started) * 1000, 2),
                    "body": body,
                }
        except HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            record = {
                "status": exc.code,
                "durationMs": round((time.time() - started) * 1000, 2),
                "body": parse_json(raw),
                "error": str(exc),
            }
        except URLError as exc:
            record = {
                "status": None,
                "durationMs": round((time.time() - started) * 1000, 2),
                "body": None,
                "error": f"{type(exc).__name__}: {exc.reason}",
            }
        except Exception as exc:
            record = {
                "status": None,
                "durationMs": round((time.time() - started) * 1000, 2),
                "body": None,
                "error": f"{type(exc).__name__}: {exc}",
            }

        record["ok"] = record["status"] in expected if record["status"] is not None else False
        self.responses[step] = record
        if pause:
            time.sleep(pause)
        return record

    def login(self):
        teacher = self.request_json(
            "01_login_teacher",
            "POST",
            "/api/auth/login",
            {"email": TEACHER_EMAIL, "password": TEACHER_PASSWORD},
            expected=(200,),
        )
        learner = self.request_json(
            "02_login_learner",
            "POST",
            "/api/auth/login",
            {"email": LEARNER_EMAIL, "password": LEARNER_PASSWORD},
            expected=(200,),
        )
        self.teacher_token = extract_token(teacher.get("body"))
        self.learner_token = extract_token(learner.get("body"))
        return bool(self.teacher_token and self.learner_token)

    def create_course_graph(self):
        self.request_json(
            "03_create_course",
            "POST",
            "/api/graph/courses",
            {
                "id": COURSE_ID,
                "title": COURSE_TITLE,
                "description": "Cours de test reproductible pour l'évaluation contrôlée via API.",
                "objectifs": "Valider la cohérence des recommandations adaptatives.",
                "prerequisTextuels": "Aucun prérequis externe.",
                "status": "PUBLISHED",
                "authorEmail": TEACHER_EMAIL,
                "authorName": "Enseignant E2E",
            },
            token=self.teacher_token,
        )

        modules = [
            {
                "step": "04_create_module_bases",
                "id": "ae-real-module-bases",
                "title": "Bases de la programmation",
                "description": "Variables, conditions et boucles.",
                "orderIndex": 0,
            },
            {
                "step": "05_create_module_modularity",
                "id": "ae-real-module-modularity",
                "title": "Modularité et structures de données",
                "description": "Fonctions et tableaux.",
                "orderIndex": 1,
            },
        ]
        for module in modules:
            payload = {k: v for k, v in module.items() if k != "step"}
            self.request_json(
                module["step"],
                "POST",
                f"/api/graph/modules?courseId={COURSE_ID}",
                payload,
                token=self.teacher_token,
            )

        chapters = [
            ("06_create_chapter_variables_conditions", "ae-real-module-bases", {
                "id": "ae-real-chapter-variables-conditions",
                "title": "Variables et conditions",
                "description": "Bases déclaratives et décisions.",
                "orderIndex": 0,
            }),
            ("07_create_chapter_loops", "ae-real-module-bases", {
                "id": "ae-real-chapter-loops",
                "title": "Structures répétitives",
                "description": "Répétitions et itérations.",
                "orderIndex": 1,
            }),
            ("08_create_chapter_functions_arrays", "ae-real-module-modularity", {
                "id": "ae-real-chapter-functions-arrays",
                "title": "Fonctions et tableaux",
                "description": "Modularité et collections.",
                "orderIndex": 0,
            }),
        ]
        for step, module_id, payload in chapters:
            self.request_json(
                step,
                "POST",
                f"/api/graph/modules/{module_id}/chapitres",
                payload,
                token=self.teacher_token,
            )

        for concept in CONCEPTS:
            self.request_json(
                f"09_create_concept_{concept['id']}",
                "POST",
                f"/api/graph/chapitres/{concept['chapterId']}/concepts",
                {
                    "id": concept["id"],
                    "labelPedagogique": concept["label"],
                    "description": concept["description"],
                    "poidsCognitif": 1.0,
                    "estVerrouille": False,
                    "orderIndex": concept["orderIndex"],
                },
                token=self.teacher_token,
            )

        for source, target in PREREQUISITES:
            self.request_json(
                f"10_prerequisite_{source}_to_{target}",
                "POST",
                f"/api/graph/concepts/{source}/exige/{target}",
                None,
                token=self.teacher_token,
                expected=(200, 400),
            )

        self.request_json(
            "11_get_course_tree",
            "GET",
            f"/api/graph/courses/{COURSE_ID}/tree",
            token=self.teacher_token,
            expected=(200,),
        )

    def create_content(self):
        for concept in CONCEPTS:
            self.request_json(
                f"12_save_resource_{concept['id']}",
                "POST",
                "/api/content/save",
                {
                    "conceptId": concept["id"],
                    "htmlContent": (
                        f"<h2>{concept['label']}</h2>"
                        f"<p>Ressource pédagogique de remédiation et d'apprentissage pour {concept['label']}.</p>"
                    ),
                },
                token=self.teacher_token,
            )
            self.request_json(
                f"13_save_formative_eval_{concept['id']}",
                "POST",
                "/api/content/evaluations",
                {
                    "courseId": COURSE_ID,
                    "targetId": concept["id"],
                    "targetType": "CONCEPT",
                    "typeEvaluation": "FORMATIVE",
                    "seuilReussite": 60,
                    "nbrTentativesMax": 3,
                    "tempsImparti": 20,
                    "questions": [
                        {
                            "conceptId": concept["id"],
                            "text": f"Question formative sur {concept['label']} ?",
                            "type": "QCM",
                            "options": ["Réponse correcte", "Réponse incorrecte A", "Réponse incorrecte B"],
                            "correctAnswer": "Réponse correcte",
                            "difficulty": "MEDIUM",
                            "hintText": f"Relisez la ressource sur {concept['label']}.",
                        }
                    ],
                },
                token=self.teacher_token,
            )
            self.request_json(
                f"14_save_lab_{concept['id']}",
                "POST",
                "/api/content/labs",
                {
                    "targetId": concept["id"],
                    "courseId": COURSE_ID,
                    "title": f"TP - {concept['label']}",
                    "difficulty": "EASY",
                    "estimatedTime": 30,
                    "requireGithub": True,
                    "steps": [
                        {
                            "id": f"step-{concept['id']}-1",
                            "title": "Mise en pratique",
                            "content": f"<p>Implémenter un exercice simple sur {concept['label']}.</p>",
                            "orderIndex": 0,
                        }
                    ],
                },
                token=self.teacher_token,
            )

        self.request_json(
            "15_save_positioning_eval",
            "POST",
            "/api/content/evaluations",
            {
                "courseId": COURSE_ID,
                "targetId": COURSE_ID,
                "targetType": "COURSE",
                "typeEvaluation": "DIAGNOSTIC_POSITIONNEMENT",
                "seuilReussite": 60,
                "nbrTentativesMax": 1,
                "tempsImparti": 30,
                "questions": [
                    {
                        "conceptId": concept["id"],
                        "text": f"Question de positionnement sur {concept['label']} ?",
                        "type": "QCM",
                        "options": ["Réponse correcte", "Réponse incorrecte A", "Réponse incorrecte B"],
                        "correctAnswer": "Réponse correcte",
                        "difficulty": "MEDIUM",
                    }
                    for concept in CONCEPTS[:2]
                ],
            },
            token=self.teacher_token,
        )

    def learner_activity(self):
        self.request_json(
            "16_enroll_learner",
            "POST",
            f"/api/graph/courses/{COURSE_ID}/enroll",
            {
                "learnerEmail": LEARNER_EMAIL,
                "nom": "Kamal",
                "prenom": "Apprenant",
            },
            token=self.learner_token,
            expected=(200, 404),
        )

        concept_results = [
            {"conceptId": "ae-real-concept-variables", "mastered": True, "score": 80},
            {"conceptId": "ae-real-concept-conditions", "mastered": False, "score": 45},
        ]
        self.request_json(
            "17_apply_diagnostic_graph",
            "POST",
            "/api/graph/adaptive/diagnostic",
            {
                "learnerEmail": LEARNER_EMAIL,
                "courseId": COURSE_ID,
                "typeEvaluation": "DIAGNOSTIC_POSITIONNEMENT",
                "conceptResults": concept_results,
            },
            token=self.learner_token,
        )
        self.request_json(
            "18_save_diagnostic_trace",
            "POST",
            "/api/traces",
            {
                "learnerEmail": LEARNER_EMAIL,
                "studentEmail": LEARNER_EMAIL,
                "userId": LEARNER_EMAIL,
                "courseId": COURSE_ID,
                "targetId": COURSE_ID,
                "targetType": "COURSE",
                "evaluationId": "ae-real-eval-positioning",
                "typeEvaluation": "DIAGNOSTIC_POSITIONNEMENT",
                "masterySource": "DIAGNOSTIC_POSITIONNEMENT",
                "scoreObtenu": 62.5,
                "tempsConsultation": 480,
                "conceptResults": serialize_concept_results(concept_results),
            },
            token=self.learner_token,
            pause=2,
        )
        self.request_json(
            "19_adaptive_path_after_positioning",
            "GET",
            f"/api/adaptive/path?courseId={COURSE_ID}",
            token=self.learner_token,
        )

        self.request_json(
            "20_save_conditions_formative_failure",
            "POST",
            "/api/traces",
            {
                "learnerEmail": LEARNER_EMAIL,
                "studentEmail": LEARNER_EMAIL,
                "userId": LEARNER_EMAIL,
                "courseId": COURSE_ID,
                "targetId": "ae-real-concept-conditions",
                "targetType": "CONCEPT",
                "evaluationId": "ae-real-eval-conditions-formative",
                "typeEvaluation": "FORMATIVE",
                "masterySource": "FORMATIVE",
                "scoreObtenu": 45,
                "tempsConsultation": 360,
                "conceptResults": serialize_concept_results([
                    {"conceptId": "ae-real-concept-conditions", "mastered": False, "score": 45}
                ]),
            },
            token=self.learner_token,
            pause=2,
        )

        self.request_json(
            "21_adaptive_path_after_conditions_failure",
            "GET",
            f"/api/adaptive/path?courseId={COURSE_ID}",
            token=self.learner_token,
        )

    def tutoring_feedback(self):
        adaptive = self.responses.get("21_adaptive_path_after_conditions_failure", {}).get("body") or {}
        next_concept = adaptive.get("nextConcept") or {}
        learner_profile = adaptive.get("learnerProfile") or {}
        strategy = adaptive.get("pedagogicalStrategy") or {}
        self.request_json(
            "22_tutoring_feedback",
            "POST",
            "/api/tutoring/feedback",
            {
                "eventType": "ADAPTIVE_RECOMMENDATION",
                "learnerEmail": LEARNER_EMAIL,
                "courseId": COURSE_ID,
                "courseTitle": COURSE_TITLE,
                "conceptId": next_concept.get("conceptId"),
                "conceptName": next_concept.get("conceptName"),
                "score": 45,
                "evaluationType": "FORMATIVE",
                "strategyType": strategy.get("strategyType", "RECOVERY"),
                "nextAction": adaptive.get("nextAction"),
                "profileType": learner_profile.get("profileType"),
                "masteryScore": learner_profile.get("masteryScore"),
                "knowledgeGaps": learner_profile.get("knowledgeGaps", []),
                "recommendedSequence": strategy.get("recommendedSequence", []),
                "tutoringMessageHint": "Feedback généré après échec contrôlé sur Conditions.",
            },
            token=self.learner_token,
            expected=(200, 400),
        )

    def run(self):
        if self.login():
            self.create_course_graph()
            self.create_content()
            self.learner_activity()
            self.tutoring_feedback()
        else:
            self.responses["scenario_status"] = {
                "ok": False,
                "error": "Authentification enseignant ou apprenant impossible. Vérifier que la plateforme et les comptes de test existent.",
            }

        generated = extract_recommendations(
            self.responses.get("21_adaptive_path_after_conditions_failure", {}).get("body")
        )
        metrics = compute_metrics(generated, EXPECTED_RECOMMENDATIONS, K)
        result = {
            "executedAt": datetime.now(timezone.utc).isoformat(),
            "baseUrl": BASE_URL,
            "courseId": COURSE_ID,
            "learnerEmail": LEARNER_EMAIL,
            "expectedRecommendations": EXPECTED_RECOMMENDATIONS,
            "generatedRecommendations": generated,
            **metrics,
            "scenarioComplete": bool(generated),
            "limitations": [
                "Scénario expérimental unique.",
                "Ne prouve pas une efficacité pédagogique réelle.",
                "RabbitMQ est déclenché indirectement par POST /api/traces ; la preuve UI/logs RabbitMQ doit être capturée séparément si nécessaire.",
            ],
        }
        write_outputs(self.payloads, self.responses, result)
        print_summary(result)


def parse_json(raw):
    if raw is None or raw == "":
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def extract_token(body):
    if isinstance(body, dict):
        return body.get("token") or body.get("accessToken")
    return None


def serialize_concept_results(concept_results):
    return json.dumps({
        "concepts": concept_results,
        "externalPrerequisites": [],
    }, ensure_ascii=False)


def extract_recommendations(adaptive_body):
    if not isinstance(adaptive_body, dict):
        return []

    recommendations = []
    for step in adaptive_body.get("recommendedLearningPath") or []:
        concept_id = step.get("conceptId")
        if concept_id and concept_id not in recommendations:
            recommendations.append(concept_id)

    if not recommendations:
        for item in adaptive_body.get("conceptsToReview") or []:
            concept_id = item.get("conceptId")
            if concept_id and concept_id not in recommendations:
                recommendations.append(concept_id)

    next_concept = adaptive_body.get("nextConcept") or {}
    concept_id = next_concept.get("conceptId")
    if concept_id and concept_id not in recommendations:
        recommendations.insert(0, concept_id)

    return recommendations


def relevance_labels(recommendations, expected, k):
    expected_set = set(expected)
    top_k = recommendations[:k]
    while len(top_k) < k:
        top_k.append(None)
    return [1 if item in expected_set else 0 for item in top_k]


def precision_at_k(recommendations, expected, k):
    return sum(relevance_labels(recommendations, expected, k)) / k


def recall_at_k(recommendations, expected, k):
    if not expected:
        return 0.0
    return sum(relevance_labels(recommendations, expected, k)) / len(set(expected))


def dcg(labels):
    return sum(label / math.log2(index + 2) for index, label in enumerate(labels))


def ndcg_at_k(recommendations, expected, k):
    labels = relevance_labels(recommendations, expected, k)
    ideal = sorted(labels, reverse=True)
    ideal_dcg = dcg(ideal)
    return dcg(labels) / ideal_dcg if ideal_dcg else 0.0


def compute_metrics(recommendations, expected, k):
    labels = relevance_labels(recommendations, expected, k)
    return {
        "k": k,
        "relevanceTopK": labels,
        "Precision@3": round(precision_at_k(recommendations, expected, k), 6),
        "Recall@3": round(recall_at_k(recommendations, expected, k), 6),
        "nDCG@3": round(ndcg_at_k(recommendations, expected, k), 6),
    }


def write_outputs(payloads, responses, result):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_json(OUT_DIR / "scenario_payloads.json", payloads)
    write_json(OUT_DIR / "raw_api_responses.json", responses)
    write_json(OUT_DIR / "recommendation_metrics_results.json", result)
    write_csv(OUT_DIR / "recommendation_metrics_results.csv", result)
    write_markdown_report(OUT_DIR / "real_api_recommendation_report.md", responses, result)
    write_latex_report(OUT_DIR / "real_api_recommendation_report.tex", result)


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def write_csv(path, result):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "executedAt",
            "baseUrl",
            "courseId",
            "learnerEmail",
            "generatedRecommendations",
            "expectedRecommendations",
            "relevanceTopK",
            "Precision@3",
            "Recall@3",
            "nDCG@3",
            "scenarioComplete",
        ])
        writer.writeheader()
        writer.writerow({
            key: json.dumps(result[key], ensure_ascii=False) if isinstance(result.get(key), list) else result.get(key)
            for key in writer.fieldnames
        })


def write_markdown_report(path, responses, result):
    adaptive_response = responses.get("21_adaptive_path_after_conditions_failure", {}).get("body")
    lines = [
        "# Real API Recommendation Evaluation - AdaptiveEngine",
        "",
        "Cette évaluation exécute un scénario expérimental unique via les API réelles exposées par l'API Gateway.",
        "Elle ne constitue pas une preuve d'efficacité pédagogique réelle ; elle valide uniquement la cohérence fonctionnelle du classement dans un cas contrôlé.",
        "",
        "## Configuration",
        "",
        f"- API Gateway : `{BASE_URL}`",
        f"- Enseignant : `{TEACHER_EMAIL}`",
        f"- Apprenant : `{LEARNER_EMAIL}`",
        f"- Cours : `{COURSE_ID}`",
        "",
        "## Endpoints réellement utilisés",
        "",
        "- `POST /api/auth/login`",
        "- `POST /api/graph/courses`",
        "- `POST /api/graph/modules?courseId=...`",
        "- `POST /api/graph/modules/{moduleId}/chapitres`",
        "- `POST /api/graph/chapitres/{chapitreId}/concepts`",
        "- `POST /api/graph/concepts/{sourceId}/exige/{targetId}`",
        "- `GET /api/graph/courses/{courseId}/tree`",
        "- `POST /api/content/save`",
        "- `POST /api/content/evaluations`",
        "- `POST /api/content/labs`",
        "- `POST /api/graph/courses/{courseId}/enroll`",
        "- `POST /api/graph/adaptive/diagnostic`",
        "- `POST /api/traces`",
        "- `GET /api/adaptive/path?courseId=...`",
        "- `POST /api/tutoring/feedback`",
        "",
        "## Oracle pédagogique contrôlé",
        "",
        "- Conditions échoué : `ae-real-concept-conditions` doit être recommandé en remédiation.",
        "- Variables maîtrisé : il ne doit pas être priorisé comme lacune principale.",
        "- Boucles, Fonctions et Tableaux ne doivent pas être priorisés avant la remédiation de Conditions.",
        "",
        "## Recommandations et métriques",
        "",
        f"- Recommandations retournées : `{result['generatedRecommendations']}`",
        f"- Recommandations attendues : `{result['expectedRecommendations']}`",
        f"- Pertinence top 3 : `{result['relevanceTopK']}`",
        f"- Precision@3 : `{result['Precision@3']}`",
        f"- Recall@3 : `{result['Recall@3']}`",
        f"- nDCG@3 : `{result['nDCG@3']}`",
        "",
        "## Réponse adaptative brute utilisée",
        "",
        "Voir `raw_api_responses.json`, clé `21_adaptive_path_after_conditions_failure`.",
        "",
        "```json",
        json.dumps(adaptive_response, indent=2, ensure_ascii=False)[:6000],
        "```",
        "",
        "## Limites",
        "",
        "- Scénario unique, contrôlé, non généralisable.",
        "- Les recommandations attendues sont définies par un oracle pédagogique, pas par une étude utilisateur.",
        "- La preuve RabbitMQ doit être complétée par les logs ou l'interface RabbitMQ Management si elle est requise dans le mémoire.",
        "- Une validation robuste demanderait plusieurs cours, plusieurs profils et plusieurs tentatives.",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_latex_report(path, result):
    latex = rf"""
\subsection{{Evaluation experimentale via les API reelles}}

Un scenario experimental bout en bout a ete execute via les API reelles
d'AdaptiveEngine afin de verifier la coherence fonctionnelle des recommandations
dans un cas controle. Le scenario cree un cours de test, un graphe de prerequis,
des ressources, des evaluations, des travaux pratiques, puis simule un test de
positionnement et un echec formatif sur le concept \textit{{Conditions}}.

L'oracle pedagogique attendu est defini a partir des regles du moteur : si le
concept \textit{{Conditions}} est echoue, il doit etre recommande en remediation ;
le concept \textit{{Variables}}, deja maitrise, ne doit pas etre priorise comme
lacune principale ; les concepts \textit{{Boucles}}, \textit{{Fonctions}} et
\textit{{Tableaux}} ne doivent pas etre prioritaires avant la remediation de
\textit{{Conditions}}.

Les recommandations retournees par le moteur sont :
\begin{{verbatim}}
{json.dumps(result["generatedRecommendations"], ensure_ascii=False)}
\end{{verbatim}}

Les recommandations attendues sont :
\begin{{verbatim}}
{json.dumps(result["expectedRecommendations"], ensure_ascii=False)}
\end{{verbatim}}

\begin{{table}}[H]
\centering
\caption{{Metriques de recommandation calculees sur le scenario API reel}}
\begin{{tabular}}{{lccc}}
\hline
Scenario & Precision@3 & Recall@3 & nDCG@3 \\
\hline
Conditions echoue & {result["Precision@3"]:.3f} & {result["Recall@3"]:.3f} & {result["nDCG@3"]:.3f} \\
\hline
\end{{tabular}}
\end{{table}}

Cette evaluation reste limitee : elle valide la coherence du classement dans un
scenario controle execute via les microservices reels, mais ne prouve pas une
amelioration effective de l'apprentissage. Une validation pedagogique robuste
necessiterait plusieurs apprenants, plusieurs cours et un protocole experimental
a plus grande echelle.
"""
    path.write_text(latex.strip() + "\n", encoding="utf-8")


def print_summary(result):
    print("Real API recommendation scenario finished")
    print(f"Base URL: {result['baseUrl']}")
    print(f"Scenario complete: {result['scenarioComplete']}")
    print(f"Generated recommendations: {result['generatedRecommendations']}")
    print(f"Expected recommendations: {result['expectedRecommendations']}")
    print(f"Precision@3: {result['Precision@3']}")
    print(f"Recall@3: {result['Recall@3']}")
    print(f"nDCG@3: {result['nDCG@3']}")
    print(f"Report: {OUT_DIR / 'real_api_recommendation_report.md'}")


if __name__ == "__main__":
    ScenarioRunner().run()
