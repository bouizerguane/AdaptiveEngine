package com.ale.tracking.controller;

import com.ale.tracking.domain.RecommendationTrace;
import com.ale.tracking.dto.RecommendationTraceRequest;
import com.ale.tracking.service.RecommendationTraceService;
import com.ale.tracking.service.RecommendationTraceService.SaveResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/tracking/recommendation-traces")
@RequiredArgsConstructor
@Slf4j
public class RecommendationTraceController {

    private final RecommendationTraceService recommendationTraceService;

    @PostMapping
    public ResponseEntity<?> create(@RequestBody RecommendationTraceRequest request) {
        if (isBlank(request.getLearnerEmail()) || isBlank(request.getCourseId()) || isBlank(request.getNextAction())) {
            return ResponseEntity.badRequest().body(Map.of("message", "learnerEmail, courseId et nextAction sont obligatoires."));
        }

        SaveResult result = recommendationTraceService.saveIfChanged(request);
        RecommendationTrace saved = result.trace();
        if (result.persisted()) {
            log.info("[RecommendationTrace] persisted learner={} course={} action={} concept={}",
                    saved.getLearnerEmail(), saved.getCourseId(), saved.getNextAction(), saved.getConceptId());
        } else {
            log.info("[RecommendationTrace] skipped duplicate learner={} course={} action={} concept={}",
                    saved.getLearnerEmail(), saved.getCourseId(), saved.getNextAction(), saved.getConceptId());
        }
        return ResponseEntity.ok(Map.of(
                "id", saved.getId(),
                "persisted", result.persisted(),
                "learnerEmail", saved.getLearnerEmail(),
                "courseId", saved.getCourseId(),
                "nextAction", saved.getNextAction()
        ));
    }

    @GetMapping("/export")
    public ResponseEntity<?> export() {
        return ResponseEntity.ok(recommendationTraceService.exportDataset());
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
