package com.ale.tutoring.controller;

import com.ale.tutoring.dto.TutoringFeedbackRequest;
import com.ale.tutoring.dto.TutoringFeedbackResponse;
import com.ale.tutoring.service.TutoringFeedbackService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tutoring")
public class TutoringFeedbackController {

    private final TutoringFeedbackService tutoringFeedbackService;

    public TutoringFeedbackController(TutoringFeedbackService tutoringFeedbackService) {
        this.tutoringFeedbackService = tutoringFeedbackService;
    }

    @PostMapping("/feedback")
    public ResponseEntity<TutoringFeedbackResponse> feedback(
            @RequestBody TutoringFeedbackRequest request,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        TutoringFeedbackRequest effectiveRequest = new TutoringFeedbackRequest(
                request.eventType(),
                firstNonBlank(userEmail, request.learnerEmail()),
                request.courseId(),
                request.courseTitle(),
                request.conceptId(),
                request.conceptName(),
                request.score(),
                request.evaluationType()
        );
        return ResponseEntity.ok(tutoringFeedbackService.generate(effectiveRequest));
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }
}
