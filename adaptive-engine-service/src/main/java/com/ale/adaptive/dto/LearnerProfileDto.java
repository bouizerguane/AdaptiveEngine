package com.ale.adaptive.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class LearnerProfileDto {
    private String learnerEmail;
    private Double masteryScore;
    private List<String> knowledgeGaps;
    private int masteredConceptsCount;
    private int weakConceptsCount;
    private int tracesCount;
    private int completedLabsCount;
    private Double averageAssessmentScore;
    private long totalLearningTime;
    private String profileType;
    private String profileExplanation;
}
