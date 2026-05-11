package com.ale.graph.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AdaptiveDiagnosticRequest {
    private String learnerEmail;
    private String courseId;
    private String evaluationId;
    private String typeEvaluation;
    private List<ConceptDiagnosticResultDto> conceptResults = new ArrayList<>();
}
