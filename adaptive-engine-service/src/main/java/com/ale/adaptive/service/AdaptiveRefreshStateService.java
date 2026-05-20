package com.ale.adaptive.service;

import com.ale.adaptive.dto.PathFreshnessDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdaptiveRefreshStateService {

    private final Map<String, RefreshState> refreshStates = new ConcurrentHashMap<>();
    private final RestTemplate restTemplate;

    @Value("${services.tracking.url}")
    private String trackingServiceUrl;

    public void persistRefreshNeeded(String learnerEmail, String courseId, String lastEventType, String refreshReason, String eventAt, String eventPayload) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("learnerEmail", learnerEmail);
        payload.put("courseId", courseId);
        payload.put("lastEventType", lastEventType);
        payload.put("refreshReason", refreshReason);
        payload.put("eventPayload", eventPayload);
        payload.put("eventAt", isBlank(eventAt) ? LocalDateTime.now().toString() : eventAt);
        restTemplate.postForObject(trackingServiceUrl + "/api/tracking/adaptive-refresh/events", payload, Map.class);
    }

    public PathFreshnessDto getPendingPersistentPathFreshness(String learnerEmail, String courseId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(trackingServiceUrl + "/api/tracking/adaptive-refresh/pending")
                .queryParam("learnerEmail", learnerEmail)
                .queryParam("courseId", courseId)
                .toUriString();
        Map<String, Object> response = restTemplate.getForObject(url, Map.class);
        if (response == null || !Boolean.TRUE.equals(response.get("pending"))) {
            return notRefreshed();
        }
        String refreshReason = stringValue(response.get("refreshReason"));
        return PathFreshnessDto.builder()
                .refreshedAfterEvent(true)
                .lastEventType(stringValue(response.get("lastEventType")))
                .lastEventAt(stringValue(response.get("eventAt")))
                .refreshReason(refreshReason)
                .message(messageFor(refreshReason))
                .build();
    }

    public void consumePersistentRefresh(String learnerEmail, String courseId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("learnerEmail", learnerEmail);
        payload.put("courseId", courseId);
        restTemplate.postForObject(trackingServiceUrl + "/api/tracking/adaptive-refresh/consume", payload, Map.class);
    }

    public void markRefreshNeeded(String learnerEmail, String courseId, String lastEventType, String refreshReason, String eventAt) {
        if (isBlank(learnerEmail) || isBlank(courseId)) {
            return;
        }
        refreshStates.put(key(learnerEmail, courseId), new RefreshState(
                lastEventType,
                isBlank(eventAt) ? LocalDateTime.now().toString() : eventAt,
                refreshReason,
                true
        ));
    }

    public PathFreshnessDto consumePathFreshness(String learnerEmail, String courseId) {
        if (isBlank(learnerEmail) || isBlank(courseId)) {
            return notRefreshed();
        }

        RefreshState state = refreshStates.get(key(learnerEmail, courseId));
        if (state == null || !state.refreshPending()) {
            return notRefreshed();
        }

        refreshStates.put(key(learnerEmail, courseId), new RefreshState(
                state.lastEventType(),
                state.lastEventAt(),
                state.refreshReason(),
                false
        ));

        return PathFreshnessDto.builder()
                .refreshedAfterEvent(true)
                .lastEventType(state.lastEventType())
                .lastEventAt(state.lastEventAt())
                .refreshReason(state.refreshReason())
                .message(messageFor(state.refreshReason()))
                .build();
    }

    public PathFreshnessDto persistentOrFallbackFreshness(String learnerEmail, String courseId) {
        try {
            return getPendingPersistentPathFreshness(learnerEmail, courseId);
        } catch (RestClientException ex) {
            log.warn("[AdaptiveEvents] persistent refresh lookup failed; using memory fallback. learner={} course={} reason={}",
                    learnerEmail, courseId, ex.getMessage());
            return consumePathFreshness(learnerEmail, courseId);
        }
    }

    public void consumePersistentRefreshSafely(String learnerEmail, String courseId) {
        try {
            consumePersistentRefresh(learnerEmail, courseId);
        } catch (RestClientException ex) {
            log.warn("[AdaptiveEvents] persistent refresh consume failed learner={} course={} reason={}",
                    learnerEmail, courseId, ex.getMessage());
        }
    }

    private PathFreshnessDto notRefreshed() {
        return PathFreshnessDto.builder()
                .refreshedAfterEvent(false)
                .build();
    }

    private String messageFor(String refreshReason) {
        if ("QUIZ_COMPLETED".equals(refreshReason)) {
            return "Le parcours a été actualisé après votre dernière évaluation.";
        }
        if ("LAB_SUBMITTED".equals(refreshReason)) {
            return "Le parcours a été actualisé après votre dernier TP.";
        }
        return "Le parcours a été actualisé après votre dernière activité.";
    }

    private String key(String learnerEmail, String courseId) {
        return learnerEmail.trim().toLowerCase() + "::" + courseId.trim();
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private record RefreshState(String lastEventType, String lastEventAt, String refreshReason, boolean refreshPending) {
    }
}

