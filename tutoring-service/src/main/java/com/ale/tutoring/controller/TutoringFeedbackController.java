package com.ale.tutoring.controller;

import com.ale.tutoring.dto.TutoringFeedbackRequest;
import com.ale.tutoring.dto.TutoringFeedbackResponse;
import com.ale.tutoring.service.TutoringFeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tutoring")
@Tag(name = "Tutoring Feedback", description = "Rule-based pedagogical feedback generation.")
public class TutoringFeedbackController {

    private final TutoringFeedbackService tutoringFeedbackService;

    public TutoringFeedbackController(TutoringFeedbackService tutoringFeedbackService) {
        this.tutoringFeedbackService = tutoringFeedbackService;
    }

    @PostMapping("/feedback")
    @Operation(summary = "Generate tutoring feedback", responses = {
            @ApiResponse(responseCode = "200", description = "Feedback generated")
    })
    public ResponseEntity<TutoringFeedbackResponse> feedback(
            @RequestBody TutoringFeedbackRequest request,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        TutoringFeedbackRequest effectiveRequest = new TutoringFeedbackRequest(
                request.eventType(),
                firstNonBlank(userEmail, request.learnerEmail()),
                request.courseId(),
                request.courseTitle(),
                request.conceptId(),
                request.conceptName(),
                request.score(),
                request.evaluationType(),
                request.strategyType(),
                request.nextAction(),
                request.profileType(),
                request.masteryScore(),
                request.knowledgeGaps(),
                request.recommendedSequence(),
                request.tutoringMessageHint()
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
