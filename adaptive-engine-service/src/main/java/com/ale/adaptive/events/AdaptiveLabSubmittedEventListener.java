package com.ale.adaptive.events;

import com.ale.adaptive.service.AdaptiveRefreshStateService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AdaptiveLabSubmittedEventListener {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveLabSubmittedEventListener.class);

    private final ObjectMapper objectMapper;
    private final AdaptiveRefreshStateService refreshStateService;

    public AdaptiveLabSubmittedEventListener(ObjectMapper objectMapper, AdaptiveRefreshStateService refreshStateService) {
        this.objectMapper = objectMapper;
        this.refreshStateService = refreshStateService;
    }

    @RabbitListener(queues = "${app.events.lab-submitted-queue:adaptive.lab-submitted}")
    public void onLabSubmitted(String payload) {
        try {
            Map<String, Object> event = objectMapper.readValue(payload, new TypeReference<>() {
            });
            Object learnerEmail = event.get("learnerEmail");
            Object labId = event.get("labId");
            Object courseId = event.get("courseId");
            Object conceptId = event.get("conceptId");
            Object status = event.get("status");
            Object timestamp = event.get("timestamp");

            if (isBlank(learnerEmail) || isBlank(courseId) || isBlank(labId)) {
                log.warn("[AdaptiveEvents] lab.submitted ignored reason=missing required fields payload={}", payload);
                return;
            }

            log.info("[AdaptiveEvents] lab.submitted received learnerEmail={}, courseId={}, conceptId={}, labId={}, status={}",
                    learnerEmail, courseId, conceptId, labId, status);
            String learnerEmailValue = stringValue(learnerEmail);
            String courseIdValue = stringValue(courseId);
            try {
                refreshStateService.persistRefreshNeeded(
                        learnerEmailValue,
                        courseIdValue,
                        "lab.submitted",
                        "LAB_SUBMITTED",
                        stringValue(timestamp),
                        payload
                );
            } catch (Exception persistError) {
                log.warn("[AdaptiveEvents] lab.submitted persistent refresh failed; using memory fallback learner={} course={} reason={}",
                        learnerEmail, courseId, persistError.getMessage());
                refreshStateService.markRefreshNeeded(
                        learnerEmailValue,
                        courseIdValue,
                        "lab.submitted",
                        "LAB_SUBMITTED",
                        stringValue(timestamp)
                );
            }
            log.info("[AdaptiveEvents] adaptive path refresh marked learner={} course={} reason=LAB_SUBMITTED",
                    learnerEmail, courseId);
        } catch (Exception ex) {
            log.warn("[AdaptiveEvents] lab.submitted ignored reason=invalid payload message={}", ex.getMessage());
        }
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private boolean isBlank(Object value) {
        return value == null || value.toString().trim().isEmpty();
    }
}
