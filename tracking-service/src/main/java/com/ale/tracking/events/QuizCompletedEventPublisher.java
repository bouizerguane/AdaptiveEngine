package com.ale.tracking.events;

import com.ale.tracking.domain.TraceApprentissage;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class QuizCompletedEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(QuizCompletedEventPublisher.class);
    private static final String ROUTING_KEY = "quiz.completed";

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.events.exchange:adaptive.events}")
    private String exchangeName;

    public void publishIfQuizTrace(TraceApprentissage trace) {
        if (trace == null || isBlank(trace.getEvaluationId())) {
            return;
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("learnerEmail", trace.getLearnerEmail());
            payload.put("courseId", trace.getCourseId());
            payload.put("targetId", trace.getTargetId());
            payload.put("targetType", trace.getTargetType());
            payload.put("evaluationId", trace.getEvaluationId());
            payload.put("typeEvaluation", trace.getTypeEvaluation());
            payload.put("score", trace.getScoreObtenu());
            payload.put("masterySource", trace.getMasterySource());
            payload.put("conceptResults", trace.getConceptResults());
            payload.put("timestamp", LocalDateTime.now().toString());

            rabbitTemplate.convertAndSend(exchangeName, ROUTING_KEY, objectMapper.writeValueAsString(payload));
            log.info("[TrackingEvents] event published exchange={}, routingKey={}, evaluationId={}, learnerEmail={}",
                    exchangeName, ROUTING_KEY, trace.getEvaluationId(), trace.getLearnerEmail());
        } catch (AmqpException ex) {
            log.warn("[TrackingEvents] event publish failed; RabbitMQ unavailable, quiz trace kept. reason={}",
                    ex.getMessage());
        } catch (Exception ex) {
            log.warn("[TrackingEvents] event publish failed; quiz trace kept. reason={}", ex.getMessage());
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
