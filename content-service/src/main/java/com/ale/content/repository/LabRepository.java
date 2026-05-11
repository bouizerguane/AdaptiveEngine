package com.ale.content.repository;

import com.ale.content.domain.Lab;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LabRepository extends MongoRepository<Lab, String> {

    /** Récupère le Lab associé à un Concept pédagogique. */
    Optional<Lab> findByTargetId(String targetId);

    /** Liste tous les Labs d'un cours — pour le dashboard enseignant. */
    List<Lab> findByCourseId(String courseId);

    long deleteByCourseIdIn(Collection<String> courseIds);
}
