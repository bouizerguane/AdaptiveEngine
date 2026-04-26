package com.ale.tracking.controller;

import com.ale.tracking.domain.LabSubmission;
import com.ale.tracking.repository.LabSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
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
public class LabSubmissionController {

    private final LabSubmissionRepository submissionRepository;

    /**
     * Crée ou met à jour une soumission.
     * Si une entrée STARTED existe déjà pour userId+labId, elle est mise à jour.
     */
    @PostMapping("/submit")
    public ResponseEntity<LabSubmission> submit(@RequestBody LabSubmission submission) {
        Optional<LabSubmission> existing = submissionRepository.findByUserIdAndLabId(
                submission.getUserId(), submission.getLabId());

        if (existing.isPresent()) {
            LabSubmission s = existing.get();
            // Mise à jour du statut et des données
            s.setStatus(submission.getStatus());
            s.setGithubRepoUrl(submission.getGithubRepoUrl());
            s.setTimeSpentPerStep(submission.getTimeSpentPerStep());
            if (submission.getStatus() == LabSubmission.LabStatus.COMPLETED) {
                s.setCompletedAt(LocalDateTime.now());
            }
            return ResponseEntity.ok(submissionRepository.save(s));
        }

        // Nouvelle soumission STARTED
        if (submission.getStatus() == LabSubmission.LabStatus.COMPLETED) {
            submission.setCompletedAt(LocalDateTime.now());
        }
        return ResponseEntity.ok(submissionRepository.save(submission));
    }

    /** Toutes les soumissions d'un apprenant. */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<LabSubmission>> getByUser(@PathVariable String userId) {
        return ResponseEntity.ok(submissionRepository.findByUserId(userId));
    }

    /**
     * Vérifie si un apprenant a déjà soumis un TP.
     * Retourne 404 si pas de soumission, 200 + données si trouvé.
     */
    @GetMapping("/{labId}/user/{userId}")
    public ResponseEntity<LabSubmission> getByLabAndUser(
            @PathVariable String labId,
            @PathVariable String userId) {
        return submissionRepository.findByUserIdAndLabId(userId, labId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Statistiques d'un Lab — soumissions réelles uniquement (hors tests enseignants).
     * Utilisé par le moteur LSTM pour détecter les TP trop difficiles.
     */
    @GetMapping("/{labId}/submissions")
    public ResponseEntity<List<LabSubmission>> getLabSubmissions(@PathVariable String labId) {
        return ResponseEntity.ok(submissionRepository.findByLabIdAndIsTeacherTestFalse(labId));
    }
}
