package com.ale.tracking.events;

import com.ale.tracking.domain.LabSubmission;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class LabSubmittedEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(LabSubmittedEventPublisher.class);
    private static final String ROUTING_KEY = "lab.submitted";

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.events.exchange:adaptive.events}")
    private String exchangeName;

    public void publish(LabSubmission submission) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("learnerEmail", submission.getLearnerEmail());
            payload.put("courseId", submission.getCourseId());
            payload.put("conceptId", submission.getConceptId());
            payload.put("labId", submission.getLabId());
            payload.put("status", submission.getStatus() == null ? null : submission.getStatus().name());
            payload.put("timestamp", LocalDateTime.now().toString());

            rabbitTemplate.convertAndSend(exchangeName, ROUTING_KEY, objectMapper.writeValueAsString(payload));
            log.info("[TrackingEvents] event published exchange={}, routingKey={}, labId={}, learnerEmail={}",
                    exchangeName, ROUTING_KEY, submission.getLabId(), submission.getLearnerEmail());
        } catch (AmqpException ex) {
            log.warn("[TrackingEvents] event publish failed; RabbitMQ unavailable, lab submission kept. reason={}",
                    ex.getMessage());
        } catch (Exception ex) {
            log.warn("[TrackingEvents] event publish failed; lab submission kept. reason={}", ex.getMessage());
        }
    }
}
