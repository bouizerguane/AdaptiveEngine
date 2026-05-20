package com.ale.tracking.service;

import com.ale.tracking.domain.RecommendationTrace;
import com.ale.tracking.domain.LabSubmission;
import com.ale.tracking.domain.TraceApprentissage;
import com.ale.tracking.dto.RecommendationTraceRequest;
import com.ale.tracking.repository.RecommendationTraceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class RecommendationTraceService {

    private final RecommendationTraceRepository recommendationTraceRepository;

    @Transactional
    public SaveResult saveIfChanged(RecommendationTraceRequest request) {
        RecommendationTrace trace = RecommendationTrace.builder()
                .learnerEmail(request.getLearnerEmail())
                .courseId(request.getCourseId())
                .conceptId(request.getConceptId())
                .prerequisiteScore(request.getPrerequisiteScore())
                .diagnosticWeaknessScore(request.getDiagnosticWeaknessScore())
                .historicalPerformanceScore(request.getHistoricalPerformanceScore())
                .pedagogicalOrderScore(request.getPedagogicalOrderScore())
                .engagementScore(request.getEngagementScore())
                .masteryScore(request.getMasteryScore())
                .learningTime(request.getLearningTime())
                .tracesCount(request.getTracesCount())
                .completedLabsCount(request.getCompletedLabsCount())
                .averageAssessmentScore(request.getAverageAssessmentScore())
                .knowledgeGapsCount(request.getKnowledgeGapsCount())
                .profileType(request.getProfileType())
                .pedagogicalStrategy(request.getPedagogicalStrategy())
                .recommendationContext(request.getRecommendationContext())
                .lastActivityType(request.getLastActivityType())
                .lastActivityScore(request.getLastActivityScore())
                .repeatedFailuresCount(request.getRepeatedFailuresCount())
                .persistentDifficulty(request.getPersistentDifficulty())
                .highMasteryProgression(request.getHighMasteryProgression())
                .readyConceptsCount(request.getReadyConceptsCount())
                .lockedConceptsCount(request.getLockedConceptsCount())
                .completedConceptsCount(request.getCompletedConceptsCount())
                .recommendedPathSize(request.getRecommendedPathSize())
                .adaptiveScore(request.getAdaptiveScore())
                .recommendedConcept(request.getRecommendedConcept())
                .nextAction(request.getNextAction())
                .remediationTriggered(request.getRemediationTriggered())
                .recommendationReason(request.getRecommendationReason())
                .conceptCompleted(request.getConceptCompleted())
                .conceptCompletedAfterRecommendation(request.getConceptCompletedAfterRecommendation())
                .quizScoreAfterRecommendation(request.getQuizScoreAfterRecommendation())
                .labSubmittedAfterRecommendation(request.getLabSubmittedAfterRecommendation())
                .remediationSuccess(request.getRemediationSuccess())
                .remediationSucceeded(request.getRemediationSucceeded())
                .learnerDropped(request.getLearnerDropped())
                .recommendationAccepted(request.getRecommendationAccepted())
                .outcomeCapturedAt(parseDateTime(request.getOutcomeCapturedAt()))
                .build();

        return recommendationTraceRepository
                .findTopByLearnerEmailAndCourseIdOrderByCreatedAtDesc(request.getLearnerEmail(), request.getCourseId())
                .filter(previous -> sameRecommendation(previous, trace))
                .map(previous -> new SaveResult(previous, false))
                .orElseGet(() -> new SaveResult(recommendationTraceRepository.save(trace), true));
    }

    @Transactional
    public void captureTraceOutcome(TraceApprentissage trace) {
        if (trace == null || isBlank(trace.getUserId()) || isBlank(trace.getCourseId())) {
            return;
        }
        String conceptId = conceptIdFromTrace(trace);
        if (isBlank(conceptId)) {
            return;
        }
        recommendationTraceRepository
                .findTopByLearnerEmailAndCourseIdAndConceptIdOrderByCreatedAtDesc(
                        trace.getUserId(),
                        trace.getCourseId(),
                        conceptId)
                .ifPresent(recommendation -> {
                    recommendation.setLastActivityType(activityTypeFromTrace(trace));
                    recommendation.setLastActivityScore(trace.getScoreObtenu());
                    recommendation.setQuizScoreAfterRecommendation(trace.getScoreObtenu());
                    if (trace.getScoreObtenu() >= 60.0) {
                        recommendation.setConceptCompletedAfterRecommendation(true);
                        recommendation.setConceptCompleted(true);
                        if (Boolean.TRUE.equals(recommendation.getRemediationTriggered())
                                || Boolean.TRUE.equals(recommendation.getPersistentDifficulty())
                                || Boolean.TRUE.equals(recommendation.getRemediationSuccess())) {
                            recommendation.setRemediationSucceeded(true);
                            recommendation.setRemediationSuccess(true);
                        }
                    }
                    recommendation.setOutcomeCapturedAt(LocalDateTime.now());
                    recommendationTraceRepository.save(recommendation);
                });
    }

    @Transactional
    public void captureLabOutcome(LabSubmission submission) {
        if (submission == null || isBlank(submission.getUserId()) || isBlank(submission.getCourseId())) {
            return;
        }
        String conceptId = firstNonBlank(submission.getConceptId(), submission.getTargetId());
        if (isBlank(conceptId)) {
            return;
        }
        recommendationTraceRepository
                .findTopByLearnerEmailAndCourseIdAndConceptIdOrderByCreatedAtDesc(
                        submission.getUserId(),
                        submission.getCourseId(),
                        conceptId)
                .ifPresent(recommendation -> {
                    recommendation.setLastActivityType("LAB");
                    recommendation.setLastActivityScore(null);
                    if (submission.getStatus() == LabSubmission.LabStatus.COMPLETED) {
                        recommendation.setLabSubmittedAfterRecommendation(true);
                        recommendation.setRecommendationAccepted(true);
                    }
                    recommendation.setOutcomeCapturedAt(LocalDateTime.now());
                    recommendationTraceRepository.save(recommendation);
                });
    }

    public List<RecommendationTrace> exportDataset() {
        return recommendationTraceRepository.findAllByOrderByCreatedAtDesc();
    }

    private boolean sameRecommendation(RecommendationTrace previous, RecommendationTrace current) {
        return Objects.equals(previous.getRecommendedConcept(), current.getRecommendedConcept())
                && Objects.equals(previous.getNextAction(), current.getNextAction())
                && Objects.equals(previous.getAdaptiveScore(), current.getAdaptiveScore())
                && Objects.equals(previous.getProfileType(), current.getProfileType());
    }

    public record SaveResult(RecommendationTrace trace, boolean persisted) {
    }

    private String conceptIdFromTrace(TraceApprentissage trace) {
        if (!isBlank(trace.getTargetId()) && "CONCEPT".equalsIgnoreCase(trace.getTargetType())) {
            return trace.getTargetId();
        }
        if (!isBlank(trace.getTargetId()) && "QUIZ_DIRECT".equalsIgnoreCase(trace.getMasterySource())) {
            return trace.getTargetId();
        }
        return null;
    }

    private String activityTypeFromTrace(TraceApprentissage trace) {
        String type = firstNonBlank(trace.getTypeEvaluation(), trace.getMasterySource());
        if (type.contains("DIAGNOSTIC")) {
            return "DIAGNOSTIC";
        }
        if (type.contains("VALIDATION")) {
            return "VALIDATION";
        }
        if (type.contains("REMEDIATION")) {
            return "REMEDIATION";
        }
        return "QUIZ";
    }

    private LocalDateTime parseDateTime(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value;
            }
        }
        return "";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
