package com.ale.graph.dto;

import lombok.Data;

@Data
public class ConceptDiagnosticResultDto {
    private String conceptId;
    private double score;
    private boolean mastered;
}
