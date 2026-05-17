package com.ale.tutoring.dto;

import java.util.List;

public record TutoringFeedbackRequest(
        String eventType,
        String learnerEmail,
        String courseId,
        String courseTitle,
        String conceptId,
        String conceptName,
        Double score,
        String evaluationType,
        String strategyType,
        String nextAction,
        String profileType,
        Double masteryScore,
        List<String> knowledgeGaps,
        List<String> recommendedSequence,
        String tutoringMessageHint
) {
}
