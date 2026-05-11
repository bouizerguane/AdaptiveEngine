package com.ale.adaptive.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

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
}
