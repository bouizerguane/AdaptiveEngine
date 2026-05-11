package com.ale.adaptive.events;

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

    public AdaptiveLabSubmittedEventListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
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

            if (isBlank(learnerEmail) || isBlank(labId)) {
                log.warn("[AdaptiveEvents] lab.submitted ignored reason=missing required fields payload={}", payload);
                return;
            }

            log.info("[AdaptiveEvents] lab.submitted received learnerEmail={}, courseId={}, conceptId={}, labId={}, status={}",
                    learnerEmail, courseId, conceptId, labId, status);
        } catch (Exception ex) {
            log.warn("[AdaptiveEvents] lab.submitted ignored reason=invalid payload message={}", ex.getMessage());
        }
    }

    private boolean isBlank(Object value) {
        return value == null || value.toString().trim().isEmpty();
    }
}
