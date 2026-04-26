package com.ale.tracking.controller;

import com.ale.tracking.domain.TraceApprentissage;
import com.ale.tracking.repository.TraceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/traces")
@RequiredArgsConstructor
public class TraceController {

    private final TraceRepository traceRepository;

    /**
     * POST /api/traces
     * Called by the Student Quiz Player after submission.
     */
    @PostMapping
    public ResponseEntity<TraceApprentissage> saveTrace(@RequestBody TraceApprentissage trace) {
        if (trace.getHorodatage() == null) {
            trace.setHorodatage(LocalDateTime.now());
        }
        TraceApprentissage saved = traceRepository.save(trace);
        return ResponseEntity.ok(saved);
    }

    /**
     * GET /api/traces/user/{userId}
     * Called by the AdaptiveEngine to fetch all traces for a student.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<TraceApprentissage>> getTracesByUser(@PathVariable String userId) {
        List<TraceApprentissage> traces = traceRepository.findByUserId(userId);
        return ResponseEntity.ok(traces);
    }

    /**
     * GET /api/traces/user/{userId}/evaluation/{evaluationId}
     * Fetch traces for a specific evaluation by a user (e.g., for retry limits).
     */
    @GetMapping("/user/{userId}/evaluation/{evaluationId}")
    public ResponseEntity<List<TraceApprentissage>> getTracesByUserAndEvaluation(
            @PathVariable String userId,
            @PathVariable String evaluationId) {
        List<TraceApprentissage> traces = traceRepository.findByUserIdAndEvaluationId(userId, evaluationId);
        return ResponseEntity.ok(traces);
    }
}
