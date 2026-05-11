package com.ale.content.controller;

import com.ale.content.domain.Lab;
import com.ale.content.repository.LabRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * CRUD pour les Travaux Pratiques (Labs).
 * L'upsert est basé sur {@code targetId} — un seul Lab par Concept pédagogique.
 */
@RestController
@RequestMapping("/api/content/labs")
@RequiredArgsConstructor
@Slf4j
public class LabController {

    private final LabRepository labRepository;

    /** Récupère le Lab d'un Concept (par targetId). */
    @GetMapping("/{targetId}")
    public ResponseEntity<Lab> getByTargetId(@PathVariable String targetId) {
        return labRepository.findByTargetId(targetId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Liste tous les Labs d'un cours — pour le dashboard enseignant. */
    @GetMapping("/id/{id}")
    public ResponseEntity<Lab> getById(@PathVariable String id) {
        return labRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<Lab>> getByCourse(@PathVariable String courseId) {
        return ResponseEntity.ok(labRepository.findByCourseId(courseId));
    }

    /**
     * Crée ou met à jour un Lab (upsert par targetId).
     * Si un Lab existe déjà pour ce targetId, son _id MongoDB est réutilisé.
     */
    @PostMapping
    public ResponseEntity<?> saveLab(
            @RequestBody Lab lab,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isTeacherOrAdmin(userRole)) {
            return ResponseEntity.status(403).body(Map.of("message", "Role TEACHER requis."));
        }
        if (lab.getTargetId() == null || lab.getTargetId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "targetId est obligatoire."));
        }
        if (lab.getCourseId() == null || lab.getCourseId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "courseId est obligatoire."));
        }
        if (lab.getTitle() == null || lab.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "title est obligatoire."));
        }

        log.info("[LabController] saveLab targetId={}, courseId={}, steps={}",
                lab.getTargetId(), lab.getCourseId(), lab.getSteps() == null ? 0 : lab.getSteps().size());

        Lab saved;
        if (lab.getId() != null) {
            saved = labRepository.save(lab);
        } else {
            saved = labRepository.findByTargetId(lab.getTargetId())
                    .map(existing -> {
                        lab.setId(existing.getId());
                        return labRepository.save(lab);
                    })
                    .orElseGet(() -> labRepository.save(lab));
        }
        return ResponseEntity.ok(saved);
    }

    /** Supprime un Lab par son ID MongoDB. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLab(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isTeacherOrAdmin(userRole)) {
            return ResponseEntity.status(403).build();
        }
        labRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private boolean hasGatewayRole(String role) {
        return role != null && !role.isBlank();
    }

    private boolean isTeacherOrAdmin(String role) {
        return "ROLE_TEACHER".equals(role) || "TEACHER".equals(role)
                || "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }
}
