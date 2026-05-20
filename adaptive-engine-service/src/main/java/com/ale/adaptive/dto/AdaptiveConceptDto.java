package com.ale.adaptive.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class AdaptiveConceptDto {
    private String conceptId;
    private String conceptName;
    private String courseId;
    private String type;
    private String moduleTitle;
    private String chapitreTitle;
    private String status;
    private List<String> missingPrerequisiteIds;
    private Double adaptiveScore;
    private Map<String, Double> scoreBreakdown;
    private List<String> explanationReasons;
    private Double mlSuccessProbability;
    private Double mlEnhancedScore;
    private String mlExplanation;
}
