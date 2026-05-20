package com.ale.tracking.dto;

import lombok.Data;

@Data
public class RecommendationTraceRequest {
    private String learnerEmail;
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
    private String nextAction;
    private Boolean remediationTriggered;
    private String recommendationReason;
    private Boolean conceptCompleted;
    private Boolean conceptCompletedAfterRecommendation;
    private Double quizScoreAfterRecommendation;
    private Boolean labSubmittedAfterRecommendation;
    private Boolean remediationSuccess;
    private Boolean remediationSucceeded;
    private Boolean learnerDropped;
    private Boolean recommendationAccepted;
    private String outcomeCapturedAt;
}
