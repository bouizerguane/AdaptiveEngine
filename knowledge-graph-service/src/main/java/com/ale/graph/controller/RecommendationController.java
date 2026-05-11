package com.ale.graph.controller;

import com.ale.graph.dto.ConceptRecommendationDto;
import com.ale.graph.service.CourseEnrollmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/graph/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final CourseEnrollmentService enrollmentService;

    @GetMapping("/next")
    public ResponseEntity<ConceptRecommendationDto> getNextConcept(
            @RequestParam String learnerEmail,
            @RequestParam String courseId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole
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
