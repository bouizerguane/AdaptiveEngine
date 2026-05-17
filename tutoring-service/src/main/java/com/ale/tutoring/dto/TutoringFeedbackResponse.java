package com.ale.tutoring.dto;

import java.util.List;

public record TutoringFeedbackResponse(
        String eventType,
        String message,
        List<String> actions,
        String feedbackType,
        List<String> recommendedActions,
        List<String> learningSequence,
        String motivationalMessage,
        String explanation
) {
}
