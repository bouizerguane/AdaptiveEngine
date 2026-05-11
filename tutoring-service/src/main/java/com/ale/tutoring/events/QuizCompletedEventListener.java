package com.ale.tutoring.events;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class QuizCompletedEventListener {

    private static final Logger log = LoggerFactory.getLogger(QuizCompletedEventListener.class);

    private final ObjectMapper objectMapper;

    public QuizCompletedEventListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @RabbitListener(queues = "${app.events.quiz-completed-queue:tutoring.quiz-completed}")
    public void onQuizCompleted(String payload) {
        try {
            Map<String, Object> event = objectMapper.readValue(payload, new TypeReference<>() {
            });
            Object learnerEmail = event.get("learnerEmail");
            Object evaluationId = event.get("evaluationId");
            Object courseId = event.get("courseId");
            Object targetId = event.get("targetId");
            Object score = event.get("score");
            Object typeEvaluation = event.get("typeEvaluation");

            if (isBlank(learnerEmail) || isBlank(evaluationId)) {
                log.warn("[TutoringEvents] event ignored routingKey=quiz.completed reason=missing required fields payload={}",
                        payload);
                return;
            }

            log.info("[TutoringEvents] event received routingKey=quiz.completed, evaluationId={}, learnerEmail={}, courseId={}, targetId={}, typeEvaluation={}, score={}",
                    evaluationId, learnerEmail, courseId, targetId, typeEvaluation, score);
        } catch (Exception ex) {
            log.warn("[TutoringEvents] event ignored routingKey=quiz.completed reason=invalid payload message={}",
                    ex.getMessage());
        }
    }

    private boolean isBlank(Object value) {
        return value == null || value.toString().trim().isEmpty();
    }
}
