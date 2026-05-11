package com.ale.tracking.repository;

import com.ale.tracking.domain.TraceApprentissage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TraceRepository extends JpaRepository<TraceApprentissage, Long> {
    List<TraceApprentissage> findByUserId(String userId);
    List<TraceApprentissage> findByUserIdAndEvaluationId(String userId, String evaluationId);
    List<TraceApprentissage> findByCourseIdIn(List<String> courseIds);
    @Query("""
            SELECT t FROM TraceApprentissage t
            WHERE t.courseId = :courseId
              AND (t.userId = :learnerEmail OR t.studentEmail = :learnerEmail OR t.learnerEmail = :learnerEmail)
              AND (
                    t.masterySource IN :diagnosticTypes
                    OR t.typeEvaluation IN :diagnosticTypes
              )
            ORDER BY t.horodatage DESC
            """)
    List<TraceApprentissage> findLatestDiagnostics(
            @Param("learnerEmail") String learnerEmail,
            @Param("courseId") String courseId,
            @Param("diagnosticTypes") List<String> diagnosticTypes
    );
}
