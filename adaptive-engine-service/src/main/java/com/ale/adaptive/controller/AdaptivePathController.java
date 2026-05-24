package com.ale.adaptive.controller;

import com.ale.adaptive.dto.AdaptivePathResponse;
import com.ale.adaptive.service.AdaptivePathService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/adaptive")
@RequiredArgsConstructor
@Tag(name = "Adaptive Path", description = "Personalized learning path and adaptive recommendation endpoints.")
public class AdaptivePathController {

    private final AdaptivePathService adaptivePathService;

    @GetMapping("/path")
    @Operation(
            summary = "Generate personalized adaptive path",
            description = "Returns the current adaptive recommendation, learner profile, pedagogical strategy, PLP and optional ML signal.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Adaptive path generated"),
                    @ApiResponse(responseCode = "400", description = "Missing learnerEmail or courseId", content = @Content)
            })
    public ResponseEntity<?> getPersonalizedPath(
            @Parameter(description = "Learner email. Optional for students because the gateway injects X-User-Email.")
            @RequestParam(required = false) String learnerEmail,
            @Parameter(description = "Course identifier")
            @RequestParam String courseId,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Role", required = false) String userRole) {

        String effectiveLearnerEmail = isTeacherOrAdmin(userRole) ? learnerEmail : firstNonBlank(userEmail, learnerEmail);
        if (effectiveLearnerEmail == null || courseId == null || courseId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "learnerEmail et courseId sont obligatoires."));
        }

        AdaptivePathResponse response = adaptivePathService.buildPath(effectiveLearnerEmail, courseId);
        return ResponseEntity.ok(response);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank() && !"anonymousUser".equals(value)) return value;
        }
        return null;
    }

    private boolean isTeacherOrAdmin(String role) {
        return "ROLE_TEACHER".equals(role) || "TEACHER".equals(role)
                || "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }
}
