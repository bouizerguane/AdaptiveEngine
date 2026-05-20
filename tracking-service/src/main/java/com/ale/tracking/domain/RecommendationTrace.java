package com.ale.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "recommendation_trace",
        indexes = {
                @Index(name = "idx_recommendation_trace_learner", columnList = "learnerEmail"),
                @Index(name = "idx_recommendation_trace_course", columnList = "courseId"),
                @Index(name = "idx_recommendation_trace_concept", columnList = "conceptId"),
                @Index(name = "idx_recommendation_trace_created", columnList = "createdAt")
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecommendationTrace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String learnerEmail;

    @Column(nullable = false)
    private String courseId;

    private String conceptId;

    private Double prerequisiteScore;

    private Double diagnosticWeaknessScore;

    private Double historicalPerformanceScore;

    private Double pedagogicalOrderScore;

    private Double engagementScore;

    private Double masteryScore;

    private Long learningTime;

    private Integer tracesCount;

    private Integer completedLabsCount;

    private Double averageAssessmentScore;

    private Integer knowledgeGapsCount;

    private String profileType;

    private String pedagogicalStrategy;

    private String recommendationContext;

    private String lastActivityType;

    private Double lastActivityScore;

    private Integer repeatedFailuresCount;

    private Boolean persistentDifficulty;

    private Boolean highMasteryProgression;

    private Integer readyConceptsCount;

    private Integer lockedConceptsCount;

    private Integer completedConceptsCount;

    private Integer recommendedPathSize;

    private Double adaptiveScore;

    private String recommendedConcept;

    @Column(nullable = false)
    private String nextAction;

    private Boolean remediationTriggered;

    @Column(length = 2000)
    private String recommendationReason;

    private Boolean conceptCompleted;

    private Boolean conceptCompletedAfterRecommendation;

    private Double quizScoreAfterRecommendation;

    private Boolean labSubmittedAfterRecommendation;

    private Boolean remediationSuccess;

    private Boolean remediationSucceeded;

    private Boolean learnerDropped;

    private Boolean recommendationAccepted;

    private LocalDateTime outcomeCapturedAt;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
