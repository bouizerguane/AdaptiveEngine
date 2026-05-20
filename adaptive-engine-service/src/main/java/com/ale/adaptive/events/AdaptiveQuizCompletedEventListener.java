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
public class AdaptiveQuizCompletedEventListener {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveQuizCompletedEventListener.class);

    private final ObjectMapper objectMapper;
    private final AdaptiveRefreshStateService refreshStateService;

    public AdaptiveQuizCompletedEventListener(ObjectMapper objectMapper, AdaptiveRefreshStateService refreshStateService) {
        this.objectMapper = objectMapper;
        this.refreshStateService = refreshStateService;
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
            Object timestamp = event.get("timestamp");

            if (isBlank(learnerEmail) || isBlank(courseId) || isBlank(evaluationId)) {
                log.warn("[AdaptiveEvents] quiz.completed ignored reason=missing required fields payload={}", payload);
                return;
            }

            log.info("[AdaptiveEvents] quiz.completed received learnerEmail={}, courseId={}, targetId={}, evaluationId={}, typeEvaluation={}, score={}",
                    learnerEmail, courseId, targetId, evaluationId, typeEvaluation, score);
            String learnerEmailValue = stringValue(learnerEmail);
            String courseIdValue = stringValue(courseId);
            try {
                refreshStateService.persistRefreshNeeded(
                        learnerEmailValue,
                        courseIdValue,
                        "quiz.completed",
                        "QUIZ_COMPLETED",
                        stringValue(timestamp),
                        payload
                );
            } catch (Exception persistError) {
                log.warn("[AdaptiveEvents] quiz.completed persistent refresh failed; using memory fallback learner={} course={} reason={}",
                        learnerEmail, courseId, persistError.getMessage());
                refreshStateService.markRefreshNeeded(
                        learnerEmailValue,
                        courseIdValue,
                        "quiz.completed",
                        "QUIZ_COMPLETED",
                        stringValue(timestamp)
                );
            }
            log.info("[AdaptiveEvents] adaptive path refresh marked learner={} course={} reason=QUIZ_COMPLETED",
                    learnerEmail, courseId);
        } catch (Exception ex) {
            log.warn("[AdaptiveEvents] quiz.completed ignored reason=invalid payload message={}", ex.getMessage());
        }
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private boolean isBlank(Object value) {
        return value == null || value.toString().trim().isEmpty();
    }
}
