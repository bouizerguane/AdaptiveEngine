package com.ale.adaptive.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class AdaptivePathResponse {
    private String learnerEmail;
    private String courseId;
    private String courseTitle;
    private boolean diagnosticPassed;
    private List<AdaptiveConceptDto> masteredConcepts;
    private List<AdaptiveConceptDto> learnableConcepts;
    private List<AdaptiveConceptDto> blockedConcepts;
    private List<AdaptiveConceptDto> conceptsToReview;
    private String nextAction;
    private AdaptiveConceptDto nextConcept;
    private String learningPhase;
    private Map<String, Object> nextRecommendation;
    private String recommendationReason;
    private Map<String, Object> latestDiagnostic;
    private int traceCount;
    private int submittedLabCount;
    private String decisionExplanation;
    private String scoringVersion;
    private LearnerProfileDto learnerProfile;
    private PedagogicalStrategyDto pedagogicalStrategy;
}
