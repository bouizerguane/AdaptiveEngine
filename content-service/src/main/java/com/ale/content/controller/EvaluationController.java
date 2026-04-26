package com.ale.content.controller;

import com.ale.content.domain.Evaluation;
import com.ale.content.repository.EvaluationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/content/evaluations")
@RequiredArgsConstructor
public class EvaluationController {

    private final EvaluationRepository evaluationRepository;

    /** Types d'évaluation réservés aux cibles de niveau CONCEPT uniquement. */
    private static final Set<String> CONCEPT_ONLY_TYPES = Set.of("FORMATIVE", "VALIDATION");

    @GetMapping("/{targetId}")
    public ResponseEntity<Evaluation> getEvaluation(@PathVariable String targetId) {
        return evaluationRepository.findByTargetId(targetId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> saveEvaluation(@RequestBody Evaluation evaluation) {

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
}
