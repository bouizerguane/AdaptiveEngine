package com.ale.tutoring.events;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class LabSubmittedEventListener {

    private static final Logger log = LoggerFactory.getLogger(LabSubmittedEventListener.class);

    private final ObjectMapper objectMapper;

    public LabSubmittedEventListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @RabbitListener(queues = "${app.events.lab-submitted-queue:tutoring.lab-submitted}")
    public void onLabSubmitted(String payload) {
        try {
            Map<String, Object> event = objectMapper.readValue(payload, new TypeReference<>() {
            });
            Object learnerEmail = event.get("learnerEmail");
            Object courseId = event.get("courseId");
            Object conceptId = event.get("conceptId");
            Object labId = event.get("labId");

            if (isBlank(learnerEmail) || isBlank(labId)) {
                log.warn("[TutoringEvents] event ignored routingKey=lab.submitted reason=missing required fields payload={}",
                        payload);
                return;
            }

            log.info("[TutoringEvents] event received routingKey=lab.submitted, labId={}, learnerEmail={}, courseId={}, conceptId={}",
                    labId, learnerEmail, courseId, conceptId);
        } catch (Exception ex) {
            log.warn("[TutoringEvents] event ignored routingKey=lab.submitted reason=invalid payload message={}",
                    ex.getMessage());
        }
    }

    private boolean isBlank(Object value) {
        return value == null || value.toString().trim().isEmpty();
    }
}
