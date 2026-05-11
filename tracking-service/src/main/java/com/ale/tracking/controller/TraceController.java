package com.ale.tracking.controller;

import com.ale.tracking.domain.TraceApprentissage;
import com.ale.tracking.events.QuizCompletedEventPublisher;
import com.ale.tracking.repository.TraceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/traces")
@RequiredArgsConstructor
@Slf4j
public class TraceController {

    private final TraceRepository traceRepository;
    private final QuizCompletedEventPublisher quizCompletedEventPublisher;

    /**
     * POST /api/traces
     * Called by the Student Quiz Player after submission.
     */
    @PostMapping
    public ResponseEntity<TraceApprentissage> saveTrace(
            @RequestBody TraceApprentissage trace,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        applyUserHeader(trace, userEmail);
        normalizeTrace(trace);
        log.info("[TraceController] saveTrace userId={}, courseId={}, evaluationId={}, typeEvaluation={}, masterySource={}",
                trace.getUserId(), trace.getCourseId(), trace.getEvaluationId(),
                trace.getTypeEvaluation(), trace.getMasterySource());
        if (trace.getHorodatage() == null) {
            trace.setHorodatage(LocalDateTime.now());
        }
        TraceApprentissage saved = traceRepository.save(trace);
        quizCompletedEventPublisher.publishIfQuizTrace(saved);
        return ResponseEntity.ok(saved);
    }

    /**
     * GET /api/traces/user/{userId}
     * Called by the AdaptiveEngine to fetch all traces for a student.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<TraceApprentissage>> getTracesByUser(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        String effectiveUserId = isTeacherOrAdmin(userRole) ? userId : firstNonBlank(userEmail, userId);
        List<TraceApprentissage> traces = traceRepository.findByUserId(effectiveUserId);
        return ResponseEntity.ok(traces);
    }

    /**
     * GET /api/traces/user/{userId}/evaluation/{evaluationId}
     * Fetch traces for a specific evaluation by a user (e.g., for retry limits).
     */
    @GetMapping("/user/{userId}/evaluation/{evaluationId}")
    public ResponseEntity<List<TraceApprentissage>> getTracesByUserAndEvaluation(
            @PathVariable String userId,
            @PathVariable String evaluationId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        String effectiveUserId = isTeacherOrAdmin(userRole) ? userId : firstNonBlank(userEmail, userId);
        List<TraceApprentissage> traces = traceRepository.findByUserIdAndEvaluationId(effectiveUserId, evaluationId);
        return ResponseEntity.ok(traces);
    }

    @GetMapping("/diagnostics/latest")
    public ResponseEntity<?> getLatestDiagnosticTrace(
            @RequestParam(required = false) String learnerEmail,
            @RequestParam String courseId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        String effectiveLearnerEmail = isTeacherOrAdmin(userRole) ? learnerEmail : firstNonBlank(userEmail, learnerEmail);
        List<TraceApprentissage> traces = traceRepository.findLatestDiagnostics(
                effectiveLearnerEmail,
                courseId,
                List.of("DIAGNOSTIC_ENTREE", "DIAGNOSTIC_POSITIONNEMENT")
        );
        if (traces.isEmpty()) {
            log.info("[TraceController] latestDiagnostic none learner={}, courseId={}", effectiveLearnerEmail, courseId);
            return ResponseEntity.status(404).body(Map.of("message", "Aucun diagnostic trouve."));
        }

        TraceApprentissage trace = traces.get(0);
        log.info("[TraceController] latestDiagnostic learner={}, courseId={}, traceId={}, typeEvaluation={}, masterySource={}",
                effectiveLearnerEmail, courseId, trace.getIdTrace(), trace.getTypeEvaluation(), trace.getMasterySource());
        return ResponseEntity.ok(trace);
    }

    private void normalizeTrace(TraceApprentissage trace) {
        if (isBlank(trace.getLearnerEmail())) {
            trace.setLearnerEmail(firstNonBlank(trace.getStudentEmail(), trace.getUserId()));
        }
        if (isBlank(trace.getStudentEmail())) {
            trace.setStudentEmail(firstNonBlank(trace.getLearnerEmail(), trace.getUserId()));
        }
        if (isBlank(trace.getUserId())) {
            trace.setUserId(firstNonBlank(trace.getLearnerEmail(), trace.getStudentEmail(), "anonymous"));
        }
        if (isBlank(trace.getCourseId()) && "COURSE".equalsIgnoreCase(trace.getTargetType())) {
            trace.setCourseId(trace.getTargetId());
        }
        if (isBlank(trace.getCourseId())) {
            trace.setCourseId(firstNonBlank(trace.getTargetId(), "unknown"));
        }
        if (isBlank(trace.getTypeEvaluation()) && isDiagnostic(trace.getMasterySource())) {
            trace.setTypeEvaluation(trace.getMasterySource());
        }
        if (isBlank(trace.getMasterySource()) && isDiagnostic(trace.getTypeEvaluation())) {
            trace.setMasterySource(trace.getTypeEvaluation());
        }
    }

    private void applyUserHeader(TraceApprentissage trace, String userEmail) {
        if (!isBlank(userEmail)) {
            trace.setUserId(userEmail);
            trace.setLearnerEmail(userEmail);
            trace.setStudentEmail(userEmail);
        }
    }

    private boolean isDiagnostic(String value) {
        return "DIAGNOSTIC_ENTREE".equals(value) || "DIAGNOSTIC_POSITIONNEMENT".equals(value);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) return value;
        }
        return "";
    }

    private boolean isTeacherOrAdmin(String role) {
        return "ROLE_TEACHER".equals(role) || "TEACHER".equals(role)
                || "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }
}
