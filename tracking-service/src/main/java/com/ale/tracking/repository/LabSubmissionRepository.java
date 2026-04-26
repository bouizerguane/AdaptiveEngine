package com.ale.tracking.repository;

import com.ale.tracking.domain.LabSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LabSubmissionRepository extends JpaRepository<LabSubmission, Long> {

    /** Toutes les soumissions d'un apprenant (pour le dashboard). */
    List<LabSubmission> findByUserId(String userId);

    /** Vérifie si un apprenant a déjà soumis un TP (pour afficher "déjà complété"). */
    Optional<LabSubmission> findByUserIdAndLabId(String userId, String labId);

    /** Soumissions réelles uniquement (hors tests enseignants). */
    List<LabSubmission> findByLabIdAndIsTeacherTestFalse(String labId);

    /** Soumissions pour un ensemble de cours (Teacher Dashboard). */
    List<LabSubmission> findByCourseIdInAndIsTeacherTestFalse(List<String> courseIds);
}
