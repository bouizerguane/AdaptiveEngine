package com.ale.content.controller;

import com.ale.content.domain.Evaluation;
import com.ale.content.repository.EvaluationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/content/evaluations")
@RequiredArgsConstructor
@Slf4j
public class EvaluationController {

    private final EvaluationRepository evaluationRepository;

    /** Types d'évaluation réservés aux cibles de niveau CONCEPT uniquement. */
    private static final Set<String> CONCEPT_ONLY_TYPES = Set.of("FORMATIVE");

    @GetMapping("/{targetId}")
    public ResponseEntity<Evaluation> getEvaluation(@PathVariable String targetId) {
        return evaluationRepository.findByTargetId(targetId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/course/{courseId}/diagnostics")
    public ResponseEntity<?> getCourseDiagnostics(@PathVariable String courseId) {
        Set<String> diagnosticTypes = Set.of("DIAGNOSTIC_ENTREE", "DIAGNOSTIC_POSITIONNEMENT");
        var byCourseId = evaluationRepository.findByCourseIdAndTypeEvaluationIn(courseId, diagnosticTypes);
        var byTargetId = evaluationRepository.findByTargetIdAndTypeEvaluationIn(courseId, diagnosticTypes);

        var diagnostics = Stream.concat(byCourseId.stream(), byTargetId.stream())
                .filter(evaluation -> evaluation.getQuestions() != null && !evaluation.getQuestions().isEmpty())
                .collect(java.util.stream.Collectors.toMap(
                        Evaluation::getId,
                        evaluation -> evaluation,
                        (left, right) -> left
                ))
                .values()
                .stream()
                .toList();

        return ResponseEntity.ok(diagnostics);
    }

    @GetMapping("/course/{courseId}")
    public ResponseEntity<?> getCourseEvaluations(@PathVariable String courseId) {
        return ResponseEntity.ok(evaluationRepository.findByCourseId(courseId));
    }

    @PostMapping
    public ResponseEntity<?> saveEvaluation(
            @RequestBody Evaluation evaluation,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isTeacherOrAdmin(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Role TEACHER requis."));
        }

        // --- Validation métier ---
        // FORMATIVE et VALIDATION sont exclusivement liées à des Concepts pédagogiques.
        String type       = evaluation.getTypeEvaluation();
        String targetType = evaluation.getTargetType();

        if (CONCEPT_ONLY_TYPES.contains(type) && !"CONCEPT".equals(targetType)) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of(
                "error", String.format(
                    "Le type '%s' est réservé aux évaluations de niveau CONCEPT. " +
                    "Cible actuelle : '%s'. Utilisez DIAGNOSTIC_ENTREE (Cours) ou DIAGNOSTIC_POSITIONNEMENT (Module).",
                    type, targetType
                )
            ));
        }

        if (evaluation.getQuestions() == null || evaluation.getQuestions().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Au moins une question est obligatoire."));
        }

        boolean invalidCorrectAnswer = evaluation.getQuestions().stream().anyMatch(question ->
                question.getText() == null || question.getText().isBlank()
                        || question.getCorrectAnswer() == null || question.getCorrectAnswer().isBlank()
                        || question.getOptions() == null || !question.getOptions().contains(question.getCorrectAnswer())
        );
        if (invalidCorrectAnswer) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Chaque question doit avoir un enonce et une reponse correcte presente dans la liste des choix."
            ));
        }

        log.info("[EvaluationController] saveEvaluation targetId={}, targetType={}, questions={}",
                evaluation.getTargetId(), evaluation.getTargetType(), evaluation.getQuestions().size());

        // --- Upsert ---
        Evaluation saved;
        if (evaluation.getId() != null) {
            saved = evaluationRepository.save(evaluation);
        } else {
            saved = evaluationRepository.findByTargetId(evaluation.getTargetId())
                    .map(existing -> {
                        evaluation.setId(existing.getId());
                        return evaluationRepository.save(evaluation);
                    })
                    .orElseGet(() -> evaluationRepository.save(evaluation));
        }
        return ResponseEntity.ok(saved);
    }

    private boolean hasGatewayRole(String role) {
        return role != null && !role.isBlank();
    }

    private boolean isTeacherOrAdmin(String role) {
        return "ROLE_TEACHER".equals(role) || "TEACHER".equals(role)
                || "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }
}
