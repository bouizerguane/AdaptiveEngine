package com.ale.graph.controller;

import com.ale.graph.dto.ConceptRecommendationDto;
import com.ale.graph.service.CourseEnrollmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/graph/recommendations")
@RequiredArgsConstructor
@Tag(name = "Graph Recommendations", description = "Simple graph-based next concept recommendation.")
public class RecommendationController {

    private final CourseEnrollmentService enrollmentService;

    @GetMapping("/next")
    @Operation(summary = "Get next graph-based concept recommendation", responses = {
            @ApiResponse(responseCode = "200", description = "Recommendation returned"),
            @ApiResponse(responseCode = "204", description = "No recommendation available")
    })
    public ResponseEntity<ConceptRecommendationDto> getNextConcept(
            @Parameter(description = "Learner email") @RequestParam String learnerEmail,
            @Parameter(description = "Course identifier") @RequestParam String courseId,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Role", required = false) String userRole
    ) {
        String effectiveLearnerEmail = isAdminOrTeacher(userRole) ? learnerEmail : firstNonBlank(userEmail, learnerEmail);
        return enrollmentService.recommendNextConcept(effectiveLearnerEmail, courseId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank() && !"anonymousUser".equals(value)) return value;
        }
        return null;
    }

    private boolean isAdminOrTeacher(String role) {
        return "ROLE_ADMIN".equals(role) || "ADMIN".equals(role)
                || "ROLE_TEACHER".equals(role) || "TEACHER".equals(role);
    }
}
