package com.ale.adaptive.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PedagogicalStrategyDto {
    private String strategyType;
    private String strategyExplanation;
    private List<String> recommendedSequence;
    private List<String> constraints;
    private String tutoringMessageHint;
}
