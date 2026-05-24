package com.ale.content.controller;

import com.ale.content.domain.Evaluation;
import com.ale.content.repository.EvaluationRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Evaluations", description = "Diagnostic, formative and course validation evaluations.")
public class EvaluationController {

    private final EvaluationRepository evaluationRepository;

    /** Types d'évaluation réservés aux cibles de niveau CONCEPT uniquement. */
    private static final Set<String> CONCEPT_ONLY_TYPES = Set.of("FORMATIVE");

    @GetMapping("/{targetId}")
    @Operation(summary = "Get evaluation by target and optional type", responses = {
            @ApiResponse(responseCode = "200", description = "Evaluation returned"),
            @ApiResponse(responseCode = "404", description = "Evaluation not found")
    })
    public ResponseEntity<Evaluation> getEvaluation(
            @Parameter(description = "Concept, module or course target identifier") @PathVariable String targetId,
            @Parameter(description = "Evaluation type, for example POSITIONNEMENT, FORMATIVE or VALIDATION_COURS")
            @RequestParam(value = "typeEvaluation", required = false) String typeEvaluation) {
        if (typeEvaluation != null && !typeEvaluation.isBlank()) {
            return evaluationRepository.findByTargetIdAndTypeEvaluation(targetId, typeEvaluation)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        return evaluationRepository.findFirstByTargetIdOrderByIdDesc(targetId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/course/{courseId}/diagnostics")
    @Operation(summary = "List diagnostic evaluations for a course")
    public ResponseEntity<?> getCourseDiagnostics(@PathVariable String courseId) {
        Set<String> diagnosticTypes = Set.of("DIAGNOSTIC_ENTREE", "DIAGNOSTIC_POSITIONNEMENT", "POSITIONNEMENT");
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
    @Operation(summary = "List all evaluations for a course")
    public ResponseEntity<?> getCourseEvaluations(@PathVariable String courseId) {
        return ResponseEntity.ok(evaluationRepository.findByCourseId(courseId));
    }

    @PostMapping
    @Operation(summary = "Create or update an evaluation")
    public ResponseEntity<?> saveEvaluation(
            @RequestBody Evaluation evaluation,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isTeacherOrAdmin(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Rôle TEACHER requis."));
        }

        String type = evaluation.getTypeEvaluation();
        String targetType = evaluation.getTargetType();
        if (evaluation.getTargetId() == null || evaluation.getTargetId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "La cible de l'évaluation est obligatoire."));
        }
        if (type == null || type.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Le type d'évaluation est obligatoire."));
        }

        if (CONCEPT_ONLY_TYPES.contains(type) && !"CONCEPT".equals(targetType)) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of(
                    "error", String.format(
                            "Le type '%s' est réservé aux évaluations de niveau CONCEPT. Cible actuelle : '%s'.",
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
                    "error", "Chaque question doit avoir un énoncé et une réponse correcte présente dans la liste des choix."
            ));
        }

        log.info("[EvaluationController] saveEvaluation targetId={}, targetType={}, type={}, questions={}",
                evaluation.getTargetId(), evaluation.getTargetType(), evaluation.getTypeEvaluation(), evaluation.getQuestions().size());

        Evaluation saved;
        if (evaluation.getId() != null) {
            saved = evaluationRepository.save(evaluation);
        } else {
            saved = evaluationRepository.findByTargetIdAndTypeEvaluation(evaluation.getTargetId(), type)
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
