package com.ale.tracking.repository;

import com.ale.tracking.domain.TraceApprentissage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TraceRepository extends JpaRepository<TraceApprentissage, Long> {
    List<TraceApprentissage> findByUserId(String userId);
    List<TraceApprentissage> findByUserIdAndEvaluationId(String userId, String evaluationId);
    List<TraceApprentissage> findByCourseIdIn(List<String> courseIds);
}
