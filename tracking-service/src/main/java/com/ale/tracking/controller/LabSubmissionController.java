package com.ale.tracking.controller;

import com.ale.tracking.domain.LabSubmission;
import com.ale.tracking.events.LabSubmittedEventPublisher;
import com.ale.tracking.repository.LabSubmissionRepository;
import com.ale.tracking.service.RecommendationTraceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * API de suivi des Travaux Pratiques (Labs).
 *
 * Flux standard :
 *   1. POST /api/labs/submit  {status: STARTED}  → à l'ouverture du TP
 *   2. POST /api/labs/submit  {status: COMPLETED, githubRepoUrl: "..."} → à la soumission finale
 *
 * Les soumissions avec {@code isTeacherTest = true} sont exclues des statistiques réelles.
 */
@RestController
@RequestMapping("/api/labs")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Lab Submissions", description = "Learner lab start/completion tracking and lab statistics.")
public class LabSubmissionController {

    private final LabSubmissionRepository submissionRepository;
    private final LabSubmittedEventPublisher eventPublisher;
    private final RecommendationTraceService recommendationTraceService;

    /**
     * Crée ou met à jour une soumission.
     * Si une entrée STARTED existe déjà pour userId+labId, elle est mise à jour.
     */
    @PostMapping("/submit")
    @Operation(summary = "Create or update a lab submission", responses = {
            @ApiResponse(responseCode = "200", description = "Submission saved"),
            @ApiResponse(responseCode = "400", description = "Invalid submission payload")
    })
    public ResponseEntity<?> submit(
            @RequestBody LabSubmission submission,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        applyUserHeader(submission, userEmail);
        normalizeSubmission(submission);
        log.info("[LabSubmissionController] submit userId={}, labId={}, courseId={}, conceptId={}, targetId={}, status={}",
                submission.getUserId(), submission.getLabId(), submission.getCourseId(),
                submission.getConceptId(), submission.getTargetId(), submission.getStatus());

        if (submission.getUserId() == null || submission.getUserId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "userId est obligatoire pour soumettre un TP."));
        }
        if (submission.getLabId() == null || submission.getLabId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "labId est obligatoire pour soumettre un TP."));
        }
        if (submission.getStatus() == LabSubmission.LabStatus.COMPLETED
                && (submission.getGithubRepoUrl() == null || submission.getGithubRepoUrl().isBlank())) {
            return ResponseEntity.badRequest().body(Map.of("message", "githubRepoUrl est obligatoire pour terminer un TP."));
        }

        Optional<LabSubmission> existing = submissionRepository.findByUserIdAndLabId(
                submission.getUserId(), submission.getLabId());

        if (existing.isPresent()) {
            LabSubmission s = existing.get();
            // Mise à jour du statut et des données
            s.setStatus(submission.getStatus());
            s.setLearnerEmail(submission.getLearnerEmail());
            s.setStudentEmail(submission.getStudentEmail());
            s.setCourseId(submission.getCourseId());
            s.setConceptId(submission.getConceptId());
            s.setTargetId(submission.getTargetId());
            s.setGithubRepoUrl(submission.getGithubRepoUrl());
            s.setTimeSpentPerStep(submission.getTimeSpentPerStep());
            if (submission.getStatus() == LabSubmission.LabStatus.COMPLETED) {
                s.setCompletedAt(LocalDateTime.now());
            }
            LabSubmission saved = submissionRepository.save(s);
            recommendationTraceService.captureLabOutcome(saved);
            eventPublisher.publish(saved);
            return ResponseEntity.ok(saved);
        }

        // Nouvelle soumission STARTED
        if (submission.getStatus() == LabSubmission.LabStatus.COMPLETED) {
            submission.setCompletedAt(LocalDateTime.now());
        }
        LabSubmission saved = submissionRepository.save(submission);
        recommendationTraceService.captureLabOutcome(saved);
        eventPublisher.publish(saved);
        return ResponseEntity.ok(saved);
    }

    private void normalizeSubmission(LabSubmission submission) {
        if (isBlank(submission.getLearnerEmail())) {
            submission.setLearnerEmail(firstNonBlank(submission.getStudentEmail(), submission.getUserId()));
        }
        if (isBlank(submission.getStudentEmail())) {
            submission.setStudentEmail(firstNonBlank(submission.getLearnerEmail(), submission.getUserId()));
        }
        if (isBlank(submission.getUserId())) {
            submission.setUserId(firstNonBlank(submission.getLearnerEmail(), submission.getStudentEmail(), "anonymous"));
        }
        if (isBlank(submission.getConceptId()) && !isBlank(submission.getTargetId())) {
            submission.setConceptId(submission.getTargetId());
        }
        if (isBlank(submission.getTargetId()) && !isBlank(submission.getConceptId())) {
            submission.setTargetId(submission.getConceptId());
        }
        if (isBlank(submission.getCourseId())) {
            submission.setCourseId("external-review");
        }
    }

    private void applyUserHeader(LabSubmission submission, String userEmail) {
        if (!isBlank(userEmail)) {
            submission.setUserId(userEmail);
            submission.setLearnerEmail(userEmail);
            submission.setStudentEmail(userEmail);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) return value;
        }
        return "";
    }

    private boolean isTeacherOrAdmin(String role) {
        return "ROLE_TEACHER".equals(role) || "TEACHER".equals(role)
                || "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }

    /** Toutes les soumissions d'un apprenant. */
    @GetMapping("/user/{userId}")
    @Operation(summary = "List lab submissions for a learner")
    public ResponseEntity<List<LabSubmission>> getByUser(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        String effectiveUserId = isTeacherOrAdmin(userRole) ? userId : firstNonBlank(userEmail, userId);
        return ResponseEntity.ok(submissionRepository.findByUserId(effectiveUserId));
    }

    /**
     * Vérifie si un apprenant a déjà soumis un TP.
     * Retourne 404 si pas de soumission, 200 + données si trouvé.
     */
    @GetMapping("/{labId}/user/{userId}")
    @Operation(summary = "Get one learner submission for a lab")
    public ResponseEntity<LabSubmission> getByLabAndUser(
            @PathVariable String labId,
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        String effectiveUserId = isTeacherOrAdmin(userRole) ? userId : firstNonBlank(userEmail, userId);
        return submissionRepository.findByUserIdAndLabId(effectiveUserId, labId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Statistiques d'un Lab — soumissions réelles uniquement (hors tests enseignants).
     * Utilisé par le moteur adaptatif rule-based et exploitable pour de futures analyses ML.
     */
    @GetMapping("/{labId}/submissions")
    @Operation(summary = "List real submissions for a lab")
    public ResponseEntity<?> getLabSubmissions(
            @PathVariable String labId,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isTeacherOrAdmin(userRole)) {
            return ResponseEntity.status(403).body(Map.of("message", "Role TEACHER ou ADMIN requis."));
        }
        return ResponseEntity.ok(submissionRepository.findByLabIdAndIsTeacherTestFalse(labId));
    }

    private boolean hasGatewayRole(String role) {
        return role != null && !role.isBlank();
    }
}
