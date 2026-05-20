package com.ale.adaptive.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class LearningPathStepDto {
    private Integer order;
    private String conceptId;
    private String conceptName;
    private String status;
    private Double adaptiveScore;
    private List<String> explanationReasons;
    private Integer repeatedFailuresCount;
    private Boolean persistentDifficulty;
    private Boolean remediationSuccess;
    private Boolean highMasteryProgression;
}
