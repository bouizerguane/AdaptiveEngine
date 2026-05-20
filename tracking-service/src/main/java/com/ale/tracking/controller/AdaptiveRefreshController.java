package com.ale.tracking.controller;

import com.ale.tracking.domain.AdaptiveRefreshEvent;
import com.ale.tracking.dto.AdaptiveRefreshConsumeRequest;
import com.ale.tracking.dto.AdaptiveRefreshEventRequest;
import com.ale.tracking.dto.AdaptiveRefreshPendingResponse;
import com.ale.tracking.repository.AdaptiveRefreshEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;

@RestController
@RequestMapping("/api/tracking/adaptive-refresh")
@RequiredArgsConstructor
@Slf4j
public class AdaptiveRefreshController {

    private final AdaptiveRefreshEventRepository refreshEventRepository;

    @PostMapping("/events")
    public ResponseEntity<?> createEvent(@RequestBody AdaptiveRefreshEventRequest request) {
        if (isBlank(request.getLearnerEmail()) || isBlank(request.getCourseId())
                || isBlank(request.getLastEventType()) || isBlank(request.getRefreshReason())) {
            return ResponseEntity.badRequest().body(Map.of("message", "learnerEmail, courseId, lastEventType et refreshReason sont obligatoires."));
        }

        AdaptiveRefreshEvent saved = refreshEventRepository.save(AdaptiveRefreshEvent.builder()
                .learnerEmail(request.getLearnerEmail())
                .courseId(request.getCourseId())
                .lastEventType(request.getLastEventType())
                .refreshReason(request.getRefreshReason())
                .eventPayload(request.getEventPayload())
                .eventAt(parseDateTime(request.getEventAt()))
                .consumed(false)
                .build());

        log.info("[AdaptiveRefresh] persisted learner={} course={} reason={} eventType={}",
                saved.getLearnerEmail(), saved.getCourseId(), saved.getRefreshReason(), saved.getLastEventType());
        return ResponseEntity.ok(toPendingResponse(saved, true));
    }

    @GetMapping("/pending")
    public ResponseEntity<AdaptiveRefreshPendingResponse> getPending(
            @RequestParam String learnerEmail,
            @RequestParam String courseId) {
        return refreshEventRepository
                .findTopByLearnerEmailAndCourseIdAndConsumedFalseOrderByEventAtDesc(learnerEmail, courseId)
                .map(event -> ResponseEntity.ok(toPendingResponse(event, true)))
                .orElseGet(() -> ResponseEntity.ok(AdaptiveRefreshPendingResponse.builder()
                        .pending(false)
                        .learnerEmail(learnerEmail)
                        .courseId(courseId)
                        .build()));
    }

    @PostMapping("/consume")
    public ResponseEntity<AdaptiveRefreshPendingResponse> consume(@RequestBody AdaptiveRefreshConsumeRequest request) {
        if (isBlank(request.getLearnerEmail()) || isBlank(request.getCourseId())) {
            return ResponseEntity.badRequest().body(AdaptiveRefreshPendingResponse.builder().pending(false).build());
        }

        return refreshEventRepository
                .findTopByLearnerEmailAndCourseIdAndConsumedFalseOrderByEventAtDesc(request.getLearnerEmail(), request.getCourseId())
                .map(event -> {
                    event.setConsumed(true);
                    event.setConsumedAt(LocalDateTime.now());
                    AdaptiveRefreshEvent saved = refreshEventRepository.save(event);
                    log.info("[AdaptiveRefresh] consumed learner={} course={} reason={}",
                            saved.getLearnerEmail(), saved.getCourseId(), saved.getRefreshReason());
                    return ResponseEntity.ok(toPendingResponse(saved, false));
                })
                .orElseGet(() -> ResponseEntity.ok(AdaptiveRefreshPendingResponse.builder()
                        .pending(false)
                        .learnerEmail(request.getLearnerEmail())
                        .courseId(request.getCourseId())
                        .build()));
    }

    private AdaptiveRefreshPendingResponse toPendingResponse(AdaptiveRefreshEvent event, boolean pending) {
        return AdaptiveRefreshPendingResponse.builder()
                .pending(pending)
                .id(event.getId())
                .learnerEmail(event.getLearnerEmail())
                .courseId(event.getCourseId())
                .lastEventType(event.getLastEventType())
                .refreshReason(event.getRefreshReason())
                .eventAt(event.getEventAt() == null ? null : event.getEventAt().toString())
                .consumedAt(event.getConsumedAt() == null ? null : event.getConsumedAt().toString())
                .build();
    }

    private LocalDateTime parseDateTime(String value) {
        if (isBlank(value)) return LocalDateTime.now();
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return OffsetDateTime.parse(value).toLocalDateTime();
            } catch (DateTimeParseException ignoredAgain) {
                return LocalDateTime.now();
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
