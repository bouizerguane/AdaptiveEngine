package com.ale.adaptive.controller;

import com.ale.adaptive.dto.AdaptivePathResponse;
import com.ale.adaptive.service.AdaptivePathService;
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
public class AdaptivePathController {

    private final AdaptivePathService adaptivePathService;

    @GetMapping("/path")
    public ResponseEntity<?> getPersonalizedPath(
            @RequestParam(required = false) String learnerEmail,
            @RequestParam String courseId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {

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
