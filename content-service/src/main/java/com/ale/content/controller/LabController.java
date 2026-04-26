package com.ale.content.controller;

import com.ale.content.domain.Lab;
import com.ale.content.repository.LabRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD pour les Travaux Pratiques (Labs).
 * L'upsert est basé sur {@code targetId} — un seul Lab par Concept pédagogique.
 */
@RestController
@RequestMapping("/api/content/labs")
@RequiredArgsConstructor
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
    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<Lab>> getByCourse(@PathVariable String courseId) {
        return ResponseEntity.ok(labRepository.findByCourseId(courseId));
    }

    /**
     * Crée ou met à jour un Lab (upsert par targetId).
     * Si un Lab existe déjà pour ce targetId, son _id MongoDB est réutilisé.
     */
    @PostMapping
    public ResponseEntity<Lab> saveLab(@RequestBody Lab lab) {
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
    public ResponseEntity<Void> deleteLab(@PathVariable String id) {
        labRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
