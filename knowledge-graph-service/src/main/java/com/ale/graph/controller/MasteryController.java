package com.ale.graph.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Contrôleur interne responsable de la gestion de la maîtrise (mastery) dans le Knowledge Graph.
 *
 * Plusieurs sources de validation sont distinguées pour le moteur adaptatif rule-based explicable :
 *   - DIAGNOSTIC_MODULE : tous les concepts d'un module validés par diagnostic (saut de niveau)
 *   - LAB               : Capacité d'Application — concept validé par TP + soumission GitHub
 *   - QUIZ_DIRECT       : Connaissance — concept validé par quiz FORMATIVE/VALIDATION réussi
 *
 * Dans Neo4j, la relation ACQUIS possède un champ `basis` pour cette distinction :
 *   (User)-[:ACQUIS {basis: 'LAB', date: ...}]->(Concept)
 */
@RestController
@RequestMapping("/api/graph/mastery")
@RequiredArgsConstructor
public class MasteryController {

    private final Neo4jClient neo4jClient;

    /**
     * POST /api/graph/mastery/validate-module
     *
     * Marque TOUS les concepts d'un module comme ACQUIS (basis = DIAGNOSTIC_MODULE).
     * Appelé par StudentQuiz.jsx après un DIAGNOSTIC_POSITIONNEMENT réussi.
     * Idempotent via MERGE.
     *
     * @param body JSON : { "moduleId": "...", "userId": "..." }
     */
    @PostMapping("/validate-module")
    public ResponseEntity<Map<String, Object>> validateModuleMastery(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isStudent(userRole)) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Rôle STUDENT requis pour valider une maîtrise."
            ));
        }
        String moduleId = body.get("moduleId");
        String userId   = firstNonBlank(userEmail, body.get("userId"));

        if (moduleId == null || moduleId.isBlank() || userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Les champs 'moduleId' et 'userId' sont obligatoires."
            ));
        }

        String cypher = """
            MATCH (m:Module {id: $moduleId})-[:CONTAINS_CHAPITRE]->(ch)-[:CONTAINS_CONCEPT]->(co)
            MERGE (u:User {id: $userId})
            MERGE (u)-[r:ACQUIS]->(co)
            ON CREATE SET r.date = datetime(), r.basis = 'DIAGNOSTIC_MODULE'
            ON MATCH  SET r.date = datetime(), r.basis = 'DIAGNOSTIC_MODULE'
            RETURN count(co) AS conceptsValides
            """;

        long conceptsValides = neo4jClient.query(cypher)
                .bindAll(Map.of("moduleId", moduleId, "userId", userId))
                .fetchAs(Long.class)
                .mappedBy((typeSystem, record) -> record.get("conceptsValides").asLong())
                .first()
                .orElse(0L);

        return ResponseEntity.ok(Map.of(
            "message", "Maîtrise du module validée avec succès.",
            "moduleId", moduleId,
            "userId", userId,
            "conceptsValides", conceptsValides
        ));
    }

    /**
     * POST /api/graph/mastery/validate-concept
     *
     * Marque UN SEUL concept comme ACQUIS pour un utilisateur avec un basis paramétrable.
     * Appelé par StudentLab.jsx (basis='LAB') ou StudentQuiz pour QUIZ_DIRECT.
     *
     * Le basis 'LAB' signifie "Capacité d'Application" — l'étudiant a FAIT le TP.
     * Le basis 'QUIZ_DIRECT' signifie "Connaissance" — l'étudiant sait la théorie.
     * Cette distinction alimente le profil apprenant et prépare des données exploitables pour de futurs modèles ML.
     *
     * @param body JSON : { "conceptId": "...", "userId": "...", "basis": "LAB" }
     */
    @PostMapping("/validate-concept")
    public ResponseEntity<Map<String, Object>> validateConceptMastery(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isStudent(userRole)) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Rôle STUDENT requis pour valider une maîtrise."
            ));
        }
        String conceptId = body.get("conceptId");
        String userId    = firstNonBlank(userEmail, body.get("userId"));
        String basis     = body.getOrDefault("basis", "QUIZ_DIRECT");

        if (conceptId == null || conceptId.isBlank() || userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Les champs 'conceptId' et 'userId' sont obligatoires."
            ));
        }

        // Validation du basis (whitelist) pour éviter les injections Cypher
        if (!basis.matches("^[A-Z_]{2,30}$")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valeur 'basis' invalide."));
        }

        String cypher = """
            MATCH (co:Concept {id: $conceptId})
            MERGE (u:User {id: $userId})
            MERGE (u)-[r:ACQUIS]->(co)
            ON CREATE SET r.date = datetime(), r.basis = $basis
            ON MATCH  SET r.date = datetime(), r.basis = $basis
            RETURN co.id AS conceptId
            """;

        String validated = neo4jClient.query(cypher)
                .bindAll(Map.of("conceptId", conceptId, "userId", userId, "basis", basis))
                .fetchAs(String.class)
                .mappedBy((typeSystem, record) -> record.get("conceptId").asString())
                .first()
                .orElse(null);

        if (validated == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of(
            "message", String.format("Concept '%s' marqué ACQUIS (basis: %s).", conceptId, basis),
            "conceptId", conceptId,
            "userId", userId,
            "basis", basis
        ));
    }

    @GetMapping("/concepts/{conceptId}")
    public ResponseEntity<Map<String, Object>> getConceptMastery(
            @PathVariable String conceptId,
            @RequestParam String learnerEmail,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole
    ) {
        String effectiveLearnerEmail = isAdminOrTeacher(userRole) ? learnerEmail : firstNonBlank(userEmail, learnerEmail);
        String cypher = """
            MATCH (co:Concept {id: $conceptId})
            RETURN EXISTS {
                MATCH (:User {id: $learnerEmail})-[:ACQUIS]->(co)
            } AS mastered
            """;

        Boolean mastered = neo4jClient.query(cypher)
                .bindAll(Map.of("conceptId", conceptId, "learnerEmail", effectiveLearnerEmail))
                .fetchAs(Boolean.class)
                .mappedBy((typeSystem, record) -> record.get("mastered").asBoolean())
                .first()
                .orElse(false);

        return ResponseEntity.ok(Map.of(
                "conceptId", conceptId,
                "learnerEmail", effectiveLearnerEmail,
                "mastered", mastered
        ));
    }

    /**
     * GET /api/graph/mastery/teacher/{email}
     *
     * Retourne le nombre de concepts validés (ACQUIS) par module
     * pour l'ensemble des cours créés par un enseignant.
     */
    @GetMapping("/teacher/{email}")
    public ResponseEntity<java.util.List<Map<String, Object>>> getMasteryByTeacher(@PathVariable String email) {
        String cypher = """
            MATCH (t:Teacher {email: $email})-[:CREATED]->(c:Course)-[:CONTAINS_MODULE]->(m:Module)-[:CONTAINS_CHAPITRE]->(ch)-[:CONTAINS_CONCEPT]->(co)<-[a:ACQUIS]-(s:Student)
            RETURN m.title as moduleName, count(a) as validatedConcepts
            ORDER BY m.orderIndex
            """;

        java.util.Collection<Map<String, Object>> result = neo4jClient.query(cypher)
                .bindAll(Map.of("email", email))
                .fetch()
                .all();

        return ResponseEntity.ok(new java.util.ArrayList<>(result));
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank() && !"anonymousUser".equals(value)) return value;
        }
        return null;
    }

    private boolean isAdminOrTeacher(String role) {
        return "ROLE_ADMIN".equals(role) || "ADMIN".equals(role)
                || "ROLE_TEACHER".equals(role) || "TEACHER".equals(role);
    }

    private boolean hasGatewayRole(String role) {
        return role != null && !role.isBlank();
    }

    private boolean isStudent(String role) {
        return "ROLE_STUDENT".equals(role) || "STUDENT".equals(role)
                || "ROLE_LEARNER".equals(role) || "LEARNER".equals(role);
    }
}
