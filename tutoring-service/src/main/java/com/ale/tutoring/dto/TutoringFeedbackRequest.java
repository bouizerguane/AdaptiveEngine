package com.ale.tutoring.dto;

public record TutoringFeedbackRequest(
        String eventType,
        String learnerEmail,
        String courseId,
        String courseTitle,
        String conceptId,
        String conceptName,
        Double score,
        String evaluationType
) {
}
