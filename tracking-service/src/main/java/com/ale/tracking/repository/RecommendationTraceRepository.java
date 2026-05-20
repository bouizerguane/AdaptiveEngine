package com.ale.tracking.repository;

import com.ale.tracking.domain.RecommendationTrace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecommendationTraceRepository extends JpaRepository<RecommendationTrace, Long> {
    List<RecommendationTrace> findByLearnerEmailAndCourseIdOrderByCreatedAtDesc(String learnerEmail, String courseId);

    Optional<RecommendationTrace> findTopByLearnerEmailAndCourseIdOrderByCreatedAtDesc(String learnerEmail, String courseId);

    Optional<RecommendationTrace> findTopByLearnerEmailAndCourseIdAndConceptIdOrderByCreatedAtDesc(
            String learnerEmail,
            String courseId,
            String conceptId);

    List<RecommendationTrace> findAllByOrderByCreatedAtDesc();
}
