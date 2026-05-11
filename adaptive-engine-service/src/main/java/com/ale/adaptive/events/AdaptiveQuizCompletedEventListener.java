package com.ale.adaptive.events;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AdaptiveQuizCompletedEventListener {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveQuizCompletedEventListener.class);

    private final ObjectMapper objectMapper;

    public AdaptiveQuizCompletedEventListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @RabbitListener(queues = "${app.events.quiz-completed-queue:adaptive.quiz-completed}")
    public void onQuizCompleted(String payload) {
        try {
            Map<String, Object> event = objectMapper.readValue(payload, new TypeReference<>() {
            });
            Object learnerEmail = event.get("learnerEmail");
            Object evaluationId = event.get("evaluationId");
            Object courseId = event.get("courseId");
            Object targetId = event.get("targetId");
            Object typeEvaluation = event.get("typeEvaluation");
            Object score = event.get("score");

            if (isBlank(learnerEmail) || isBlank(evaluationId)) {
                log.warn("[AdaptiveEvents] quiz.completed ignored reason=missing required fields payload={}", payload);
                return;
            }

            log.info("[AdaptiveEvents] quiz.completed received learnerEmail={}, courseId={}, targetId={}, evaluationId={}, typeEvaluation={}, score={}",
                    learnerEmail, courseId, targetId, evaluationId, typeEvaluation, score);
        } catch (Exception ex) {
            log.warn("[AdaptiveEvents] quiz.completed ignored reason=invalid payload message={}", ex.getMessage());
        }
    }

    private boolean isBlank(Object value) {
        return value == null || value.toString().trim().isEmpty();
    }
}
