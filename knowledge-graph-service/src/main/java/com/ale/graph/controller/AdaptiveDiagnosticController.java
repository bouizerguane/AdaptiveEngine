package com.ale.graph.controller;

import com.ale.graph.dto.AdaptiveDiagnosticRequest;
import com.ale.graph.dto.ConceptDiagnosticResultDto;
import com.ale.graph.service.CourseEnrollmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/graph/adaptive")
@RequiredArgsConstructor
@Slf4j
public class AdaptiveDiagnosticController {

    private final Neo4jClient neo4jClient;
    private final CourseEnrollmentService enrollmentService;

    @PostMapping("/diagnostic")
    public ResponseEntity<Map<String, Object>> applyDiagnostic(
            @RequestBody AdaptiveDiagnosticRequest request,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        String learnerEmail = firstNonBlank(userEmail, request.getLearnerEmail());
        if (learnerEmail == null
                || request.getCourseId() == null || request.getCourseId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "learnerEmail et courseId sont obligatoires."));
        }

        String basis = request.getTypeEvaluation() == null || request.getTypeEvaluation().isBlank()
                ? "DIAGNOSTIC"
                : request.getTypeEvaluation();

        List<String> masteredConcepts = request.getConceptResults().stream()
                .filter(ConceptDiagnosticResultDto::isMastered)
                .map(ConceptDiagnosticResultDto::getConceptId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        List<String> failedConcepts = request.getConceptResults().stream()
                .filter(result -> !result.isMastered())
                .map(ConceptDiagnosticResultDto::getConceptId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        log.info("[AdaptiveDiagnostic] learner={}, courseId={}, type={}, masteredConcepts={}, failedConcepts={}",
                learnerEmail, request.getCourseId(), basis, masteredConcepts, failedConcepts);

        if (!masteredConcepts.isEmpty()) {
            String cypher = """
                UNWIND $conceptIds AS conceptId
                MATCH (co:Concept {id: conceptId})
                MERGE (u:User {id: $learnerEmail})
                MERGE (u)-[r:ACQUIS]->(co)
                ON CREATE SET r.date = datetime(), r.basis = $basis
                ON MATCH SET r.date = datetime(), r.basis = $basis
                """;
            neo4jClient.query(cypher)
                    .bindAll(Map.of(
                            "conceptIds", masteredConcepts,
                            "learnerEmail", learnerEmail,
                            "basis", basis
                    ))
                    .run();
            log.info("[AdaptiveDiagnostic] ACQUIS upserted for learner={}, concepts={}", learnerEmail, masteredConcepts);
        }

        Object nextRecommendation = enrollmentService
                .recommendNextConcept(learnerEmail, request.getCourseId())
                .orElse(null);

        return ResponseEntity.ok(Map.of(
                "masteredConcepts", masteredConcepts,
                "failedConcepts", failedConcepts,
                "nextRecommendation", nextRecommendation == null ? Map.of() : nextRecommendation
        ));
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank() && !"anonymousUser".equals(value)) return value;
        }
        return null;
    }
}
