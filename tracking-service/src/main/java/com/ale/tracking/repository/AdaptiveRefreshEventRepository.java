package com.ale.tracking.repository;

import com.ale.tracking.domain.AdaptiveRefreshEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdaptiveRefreshEventRepository extends JpaRepository<AdaptiveRefreshEvent, Long> {
    Optional<AdaptiveRefreshEvent> findTopByLearnerEmailAndCourseIdAndConsumedFalseOrderByEventAtDesc(
            String learnerEmail,
            String courseId
    );

    List<AdaptiveRefreshEvent> findByLearnerEmailAndCourseIdOrderByEventAtDesc(String learnerEmail, String courseId);
}
