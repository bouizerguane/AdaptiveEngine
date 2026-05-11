package com.ale.graph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConceptRecommendationDto {
    private String courseId;
    private String conceptId;
    private String label;
    private String description;
    private String moduleTitle;
    private String chapitreTitle;
    private String reason;
    private String remediation;
}
