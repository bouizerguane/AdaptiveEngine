package com.ale.adaptive.service;

import com.ale.adaptive.dto.AdaptiveConceptDto;
import com.ale.adaptive.dto.AdaptivePathResponse;
import com.ale.adaptive.dto.LearningPathStepDto;
import com.ale.adaptive.dto.LearnerProfileDto;
import com.ale.adaptive.dto.PedagogicalStrategyDto;
import com.ale.adaptive.dto.PathFreshnessDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdaptivePathService {

    private static final String SCORING_VERSION = "RULE_BASED_EXPLAINABLE";
    /**
     * Prototype heuristic for the post-activity rule engine: three observed failures on the same concept
     * indicate a persistent difficulty that should be highlighted in the personalized learning path.
     */
    private static final int REPEATED_FAILURE_THRESHOLD = 3;
    /**
     * Prototype heuristics inspired by mastery-learning literature: high mastery can only have a
     * controlled effect on READY steps of the personalized learning path. It never changes the
     * main decision, the adaptive score, or prerequisite constraints.
     */
    private static final double HIGH_MASTERY_SCORE_THRESHOLD = 80.0;
    private static final double HIGH_ASSESSMENT_THRESHOLD = 80.0;
    private static final int HIGH_MASTERED_CONCEPTS_THRESHOLD = 2;
    private static final int MAX_KNOWLEDGE_GAPS_FOR_HIGH_MASTERY = 0;
    private static final double HIGH_MASTERY_READY_SCORE_PROXIMITY = 0.05;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final AdaptiveRefreshStateService refreshStateService;

    @Value("${services.graph.url}")
    private String graphServiceUrl;

    @Value("${services.tracking.url}")
    private String trackingServiceUrl;

    public AdaptivePathResponse buildPath(String learnerEmail, String courseId) {
        PathFreshnessDto pathFreshness = refreshStateService.persistentOrFallbackFreshness(learnerEmail, courseId);
        Map<String, Object> courseTree = getMap(graphServiceUrl + "/api/graph/courses/" + courseId + "/tree");
        Set<String> conceptsWithDeclaredPrerequisites = buildConceptsWithDeclaredPrerequisites(courseTree);
        List<Map<String, Object>> learningStatuses = getList(UriComponentsBuilder
                .fromHttpUrl(graphServiceUrl + "/api/graph/courses/" + courseId + "/learning-status")
                .queryParam("learnerEmail", learnerEmail)
                .toUriString());

        Map<String, Object> latestDiagnostic = getMapOrEmpty(UriComponentsBuilder
                .fromHttpUrl(trackingServiceUrl + "/api/traces/diagnostics/latest")
                .queryParam("learnerEmail", learnerEmail)
                .queryParam("courseId", courseId)
                .toUriString());

        List<Map<String, Object>> traces = getList(trackingServiceUrl + "/api/traces/user/" + learnerEmail);
        List<Map<String, Object>> labs = getList(trackingServiceUrl + "/api/labs/user/" + learnerEmail);

        Map<String, AdaptiveConceptDto> conceptsById = flattenConcepts(courseTree, courseId);
        Map<String, Integer> conceptPositions = buildConceptPositions(conceptsById);
        List<AdaptiveConceptDto> mastered = new ArrayList<>();
        List<AdaptiveConceptDto> learnable = new ArrayList<>();
        List<AdaptiveConceptDto> blocked = new ArrayList<>();

        for (Map<String, Object> status : learningStatuses) {
            String conceptId = stringValue(status.get("conceptId"));
            if (conceptId == null) continue;

            AdaptiveConceptDto base = conceptsById.getOrDefault(conceptId, unknownConcept(conceptId));
            AdaptiveConceptDto dto = AdaptiveConceptDto.builder()
                    .conceptId(conceptId)
                    .conceptName(base.getConceptName())
                    .courseId(firstNonBlank(stringValue(status.get("courseId")), base.getCourseId(), courseId))
                    .type(resolveConceptType(conceptId, conceptsById))
                    .moduleTitle(firstNonBlank(stringValue(status.get("moduleTitle")), base.getModuleTitle()))
                    .chapitreTitle(firstNonBlank(stringValue(status.get("chapitreTitle")), base.getChapitreTitle()))
                    .status(firstNonBlank(stringValue(status.get("status")), "LEARNABLE"))
                    .missingPrerequisiteIds(toStringList(status.get("missingPrerequisiteIds")))
                    .build();

            if ("MASTERED".equals(dto.getStatus())) mastered.add(dto);
            else if ("BLOCKED".equals(dto.getStatus())) blocked.add(dto);
            else learnable.add(dto);
        }

        if (learningStatuses.isEmpty()) {
            learnable.addAll(conceptsById.values());
        }

        List<AdaptiveConceptDto> review = buildConceptsToReview(latestDiagnostic, conceptsById, mastered, courseId);
        List<Map<String, Object>> diagnosticResults = readConceptResults(latestDiagnostic);
        Set<String> failedDiagnosticConceptIds = diagnosticResults.stream()
                .filter(result -> !Boolean.TRUE.equals(result.get("mastered")))
                .map(result -> stringValue(result.get("conceptId")))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        learnable = scoreAndSortLearnableConcepts(
                learnable,
                failedDiagnosticConceptIds,
                conceptPositions,
                conceptsWithDeclaredPrerequisites,
                Math.max(conceptsById.size(), learnable.size()),
                traces,
                labs
        );
        review = review.stream()
                .map(this::withRemediationExplanation)
                .toList();
        AdaptiveDecision decision = decide(!latestDiagnostic.isEmpty(), review, learnable);
        LearnerProfileDto learnerProfile = buildLearnerProfile(
                learnerEmail,
                courseTree,
                latestDiagnostic,
                traces,
                labs,
                mastered,
                review,
                decision
        );
        PedagogicalStrategyDto pedagogicalStrategy = buildPedagogicalStrategy(learnerProfile, decision);
        List<LearningPathStepDto> recommendedLearningPath = buildRecommendedLearningPath(
                review,
                learnable,
                blocked,
                mastered,
                conceptsById,
                conceptPositions,
                learnerProfile,
                failedDiagnosticConceptIds,
                traces,
                labs
        );

        log.info("[AdaptiveEngine] decision = {}", decision.nextAction());
        log.info("[AdaptiveEngine] nextConcept = {}", decision.nextConcept() == null
                ? "none"
                : decision.nextConcept().getConceptId() + " / " + decision.nextConcept().getConceptName()
                + " / " + decision.nextConcept().getType());

        AdaptivePathResponse response = AdaptivePathResponse.builder()
                .learnerEmail(learnerEmail)
                .courseId(courseId)
                .courseTitle(firstNonBlank(stringValue(courseTree.get("title")), stringValue(courseTree.get("titre")), "Cours sans titre"))
                .diagnosticPassed(!latestDiagnostic.isEmpty())
                .masteredConcepts(mastered)
                .learnableConcepts(learnable)
                .blockedConcepts(blocked)
                .conceptsToReview(review)
                .recommendedLearningPath(recommendedLearningPath)
                .nextAction(decision.nextAction())
                .nextConcept(decision.nextConcept())
                .learningPhase(decision.learningPhase())
                .nextRecommendation(buildRecommendationMap(decision))
                .recommendationReason(buildReason(decision))
                .latestDiagnostic(latestDiagnostic)
                .traceCount(traces.size())
                .submittedLabCount((int) labs.stream().filter(this::isCompletedLab).count())
                .decisionExplanation(buildDecisionExplanation(decision))
                .scoringVersion(SCORING_VERSION)
                .learnerProfile(learnerProfile)
                .pedagogicalStrategy(pedagogicalStrategy)
                .pathFreshness(pathFreshness)
                .build();

        persistRecommendationTrace(response, traces, labs);

        if (pathFreshness != null && pathFreshness.isRefreshedAfterEvent()) {
            refreshStateService.consumePersistentRefreshSafely(learnerEmail, courseId);
        }

        return response;
    }

    private void persistRecommendationTrace(
            AdaptivePathResponse response,
            List<Map<String, Object>> traces,
            List<Map<String, Object>> labs) {
        if (response == null || isBlank(response.getLearnerEmail()) || isBlank(response.getCourseId())) {
            return;
        }

        AdaptiveConceptDto nextConcept = response.getNextConcept();
        LearnerProfileDto learnerProfile = response.getLearnerProfile();
        PedagogicalStrategyDto pedagogicalStrategy = response.getPedagogicalStrategy();
        Map<String, Double> scoreBreakdown = nextConcept == null || nextConcept.getScoreBreakdown() == null
                ? Map.of()
                : nextConcept.getScoreBreakdown();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("learnerEmail", response.getLearnerEmail());
        payload.put("courseId", response.getCourseId());
        payload.put("conceptId", nextConcept == null ? null : nextConcept.getConceptId());
        payload.put("prerequisiteScore", scoreBreakdown.get("prerequisiteScore"));
        payload.put("diagnosticWeaknessScore", scoreBreakdown.get("diagnosticWeaknessScore"));
        payload.put("historicalPerformanceScore", scoreBreakdown.get("historicalPerformanceScore"));
        payload.put("pedagogicalOrderScore", scoreBreakdown.get("pedagogicalOrderScore"));
        payload.put("engagementScore", scoreBreakdown.get("engagementScore"));
        payload.put("masteryScore", learnerProfile == null ? null : learnerProfile.getMasteryScore());
        payload.put("learningTime", learnerProfile == null ? null : learnerProfile.getTotalLearningTime());
        payload.put("tracesCount", learnerProfile == null ? null : learnerProfile.getTracesCount());
        payload.put("completedLabsCount", learnerProfile == null ? null : learnerProfile.getCompletedLabsCount());
        payload.put("averageAssessmentScore", learnerProfile == null ? null : learnerProfile.getAverageAssessmentScore());
        payload.put("knowledgeGapsCount", learnerProfile == null || learnerProfile.getKnowledgeGaps() == null
                ? 0
                : learnerProfile.getKnowledgeGaps().size());
        payload.put("profileType", learnerProfile == null ? null : learnerProfile.getProfileType());
        payload.put("pedagogicalStrategy", pedagogicalStrategy == null ? null : pedagogicalStrategy.getStrategyType());
        payload.put("recommendationContext", recommendationContext(response.getNextAction()));
        payload.put("lastActivityType", lastActivityType(traces, labs));
        payload.put("lastActivityScore", lastActivityScore(traces, labs));
        payload.put("repeatedFailuresCount", maxRepeatedFailuresCount(response));
        payload.put("persistentDifficulty", hasPersistentDifficulty(response) ? true : null);
        payload.put("highMasteryProgression", hasHighMasteryProgression(response) ? true : null);
        payload.put("readyConceptsCount", countPathStatus(response, "READY"));
        payload.put("lockedConceptsCount", countPathStatus(response, "LOCKED"));
        payload.put("completedConceptsCount", countPathStatus(response, "COMPLETED"));
        payload.put("recommendedPathSize", response.getRecommendedLearningPath() == null
                ? 0
                : response.getRecommendedLearningPath().size());
        payload.put("adaptiveScore", nextConcept == null ? null : nextConcept.getAdaptiveScore());
        payload.put("recommendedConcept", nextConcept == null ? null : nextConcept.getConceptName());
        payload.put("nextAction", response.getNextAction());
        payload.put("remediationTriggered", "REMEDIATION".equals(response.getNextAction()));
        payload.put("recommendationReason", firstNonBlank(response.getDecisionExplanation(), response.getRecommendationReason()));
        payload.put("conceptCompleted", null);
        payload.put("conceptCompletedAfterRecommendation", null);
        payload.put("quizScoreAfterRecommendation", null);
        payload.put("labSubmittedAfterRecommendation", null);
        payload.put("remediationSuccess", hasRemediationSuccess(response) ? true : null);
        payload.put("remediationSucceeded", hasRemediationSuccess(response) ? true : null);
        payload.put("learnerDropped", null);
        payload.put("recommendationAccepted", null);

        try {
            restTemplate.postForObject(trackingServiceUrl + "/api/tracking/recommendation-traces", payload, Map.class);
        } catch (RestClientException ex) {
            log.warn("[RecommendationTrace] persistence skipped learner={} course={} reason={}",
                    response.getLearnerEmail(), response.getCourseId(), ex.getMessage());
        }
    }

    private boolean hasRemediationSuccess(AdaptivePathResponse response) {
        return response != null
                && response.getRecommendedLearningPath() != null
                && response.getRecommendedLearningPath().stream()
                        .anyMatch(step -> Boolean.TRUE.equals(step.getRemediationSuccess()));
    }

    private String recommendationContext(String nextAction) {
        return switch (firstNonBlank(nextAction, "")) {
            case "PASS_DIAGNOSTIC" -> "DIAGNOSTIC";
            case "REMEDIATION" -> "REMEDIATION";
            case "COMPLETED" -> "VALIDATION";
            default -> "LEARN";
        };
    }

    private String lastActivityType(List<Map<String, Object>> traces, List<Map<String, Object>> labs) {
        Map<String, Object> latestTrace = latestTrace(traces);
        Map<String, Object> latestLab = latestLab(labs);
        LocalDateTime traceDate = latestTrace == null ? null : toLocalDateTime(latestTrace.get("horodatage"));
        LocalDateTime labDate = latestLab == null ? null : toLocalDateTime(latestLab.get("completedAt"));
        if (labDate != null && (traceDate == null || labDate.isAfter(traceDate))) {
            return "LAB";
        }
        if (latestTrace == null) {
            return null;
        }
        String type = firstNonBlank(stringValue(latestTrace.get("typeEvaluation")), stringValue(latestTrace.get("masterySource")), "");
        if (type.contains("DIAGNOSTIC")) return "DIAGNOSTIC";
        if (type.contains("VALIDATION")) return "VALIDATION";
        if (type.contains("REMEDIATION")) return "REMEDIATION";
        return "QUIZ";
    }

    private Double lastActivityScore(List<Map<String, Object>> traces, List<Map<String, Object>> labs) {
        Map<String, Object> latestTrace = latestTrace(traces);
        Map<String, Object> latestLab = latestLab(labs);
        LocalDateTime traceDate = latestTrace == null ? null : toLocalDateTime(latestTrace.get("horodatage"));
        LocalDateTime labDate = latestLab == null ? null : toLocalDateTime(latestLab.get("completedAt"));
        if (latestTrace == null || (labDate != null && (traceDate == null || labDate.isAfter(traceDate)))) {
            return null;
        }
        return doubleValue(latestTrace.get("scoreObtenu"));
    }

    private Map<String, Object> latestTrace(List<Map<String, Object>> traces) {
        if (traces == null || traces.isEmpty()) {
            return null;
        }
        return traces.stream()
                .max(Comparator.comparing(trace -> toLocalDateTime(trace.get("horodatage")), Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
    }

    private Map<String, Object> latestLab(List<Map<String, Object>> labs) {
        if (labs == null || labs.isEmpty()) {
            return null;
        }
        return labs.stream()
                .filter(this::isCompletedLab)
                .max(Comparator.comparing(lab -> toLocalDateTime(lab.get("completedAt")), Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
    }

    private Integer maxRepeatedFailuresCount(AdaptivePathResponse response) {
        if (response == null || response.getRecommendedLearningPath() == null) {
            return null;
        }
        return response.getRecommendedLearningPath().stream()
                .map(LearningPathStepDto::getRepeatedFailuresCount)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(null);
    }

    private boolean hasPersistentDifficulty(AdaptivePathResponse response) {
        return response != null
                && response.getRecommendedLearningPath() != null
                && response.getRecommendedLearningPath().stream()
                        .anyMatch(step -> Boolean.TRUE.equals(step.getPersistentDifficulty()));
    }

    private boolean hasHighMasteryProgression(AdaptivePathResponse response) {
        return response != null
                && response.getRecommendedLearningPath() != null
                && response.getRecommendedLearningPath().stream()
                        .anyMatch(step -> Boolean.TRUE.equals(step.getHighMasteryProgression()));
    }

    private int countPathStatus(AdaptivePathResponse response, String status) {
        if (response == null || response.getRecommendedLearningPath() == null) {
            return 0;
        }
        return (int) response.getRecommendedLearningPath().stream()
                .filter(step -> status.equals(step.getStatus()))
                .count();
    }

    private PedagogicalStrategyDto buildPedagogicalStrategy(LearnerProfileDto learnerProfile, AdaptiveDecision decision) {
        String profileType = learnerProfile == null ? null : learnerProfile.getProfileType();
        int weakConceptsCount = learnerProfile == null ? 0 : learnerProfile.getWeakConceptsCount();
        int tracesCount = learnerProfile == null ? 0 : learnerProfile.getTracesCount();
        int completedLabsCount = learnerProfile == null ? 0 : learnerProfile.getCompletedLabsCount();
        boolean hasKnowledgeGaps = learnerProfile != null
                && learnerProfile.getKnowledgeGaps() != null
                && !learnerProfile.getKnowledgeGaps().isEmpty();

        if ("REMEDIATION".equals(decision.nextAction())
                || "NEEDS_REMEDIATION".equals(profileType)
                || weakConceptsCount > 0
                || hasKnowledgeGaps) {
            return strategy(
                    "RECOVERY",
                    "Le système privilégie une stratégie de récupération car des lacunes ont été détectées.",
                    List.of("RESOURCE", "REVIEW", "LAB", "FORMATIVE"),
                    strategyConstraints(learnerProfile, decision),
                    "Proposer une explication simplifiée et rappeler les prérequis."
            );
        }

        if ("HIGH_PERFORMING".equals(profileType)
                && ("LEARN".equals(decision.nextAction()) || "COMPLETED".equals(decision.nextAction()))) {
            return strategy(
                    "ADVANCED",
                    "Le système propose une stratégie avancée car le profil indique une bonne maîtrise.",
                    List.of("RESOURCE", "CHALLENGE", "FORMATIVE"),
                    strategyConstraints(learnerProfile, decision),
                    "Proposer un défi ou une activité d'approfondissement."
            );
        }

        if ("DATA_INSUFFICIENT".equals(profileType) || (tracesCount == 0 && completedLabsCount == 0)) {
            return strategy(
                    "SUPPORTIVE",
                    "Le système propose une progression guidée car les données d'apprentissage sont encore limitées.",
                    List.of("RESOURCE", "LAB", "FORMATIVE"),
                    strategyConstraints(learnerProfile, decision),
                    "Encourager l'apprenant et proposer une activité guidée."
            );
        }

        return strategy(
                "STANDARD",
                "Le système applique une progression standard basée sur le parcours recommandé.",
                List.of("RESOURCE", "LAB", "FORMATIVE"),
                strategyConstraints(learnerProfile, decision),
                "Accompagner l'apprenant dans la séquence normale ressource-TP-évaluation."
        );
    }

    private PedagogicalStrategyDto strategy(
            String strategyType,
            String strategyExplanation,
            List<String> recommendedSequence,
            List<String> constraints,
            String tutoringMessageHint) {
        return PedagogicalStrategyDto.builder()
                .strategyType(strategyType)
                .strategyExplanation(strategyExplanation)
                .recommendedSequence(recommendedSequence)
                .constraints(constraints)
                .tutoringMessageHint(tutoringMessageHint)
                .build();
    }

    private List<String> strategyConstraints(LearnerProfileDto learnerProfile, AdaptiveDecision decision) {
        List<String> constraints = new ArrayList<>();
        constraints.add("Respecter la decision principale du moteur: " + decision.nextAction() + ".");
        if (decision.nextConcept() != null && decision.nextConcept().getConceptName() != null) {
            constraints.add("Appliquer la stratégie au concept recommandé: " + decision.nextConcept().getConceptName() + ".");
        }
        if (learnerProfile != null && learnerProfile.getKnowledgeGaps() != null && !learnerProfile.getKnowledgeGaps().isEmpty()) {
            constraints.add("Traiter les lacunes détectées avant d'avancer.");
        }
        if (learnerProfile != null && "DATA_INSUFFICIENT".equals(learnerProfile.getProfileType())) {
            constraints.add("Collecter davantage de traces avant d'affiner la personnalisation.");
        }
        if (constraints.isEmpty()) {
            constraints.add("Conserver la progression recommandée par le parcours adaptatif.");
        }
        return constraints;
    }

    private LearnerProfileDto buildLearnerProfile(
            String learnerEmail,
            Map<String, Object> courseTree,
            Map<String, Object> latestDiagnostic,
            List<Map<String, Object>> traces,
            List<Map<String, Object>> labs,
            List<AdaptiveConceptDto> masteredConcepts,
            List<AdaptiveConceptDto> knowledgeGaps,
            AdaptiveDecision decision) {
        List<Double> assessmentScores = traces.stream()
                .map(trace -> doubleValue(trace.get("scoreObtenu")))
                .filter(Objects::nonNull)
                .toList();
        double totalWeightedScores = 0.0;
        double totalWeights = 0.0;
        Map<String, Double> conceptWeights = conceptWeights(courseTree);
        Map<String, List<Double>> conceptScores = conceptScores(latestDiagnostic, traces);

        for (Map.Entry<String, List<Double>> entry : conceptScores.entrySet()) {
            List<Double> scores = entry.getValue();
            if (scores.isEmpty()) continue;
            double score = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
            double weight = conceptWeights.getOrDefault(entry.getKey(), 1.0);
            totalWeightedScores += weight * score;
            totalWeights += weight;
        }

        Double masteryScore = totalWeights == 0.0 ? null : round(totalWeightedScores / totalWeights);
        int completedLabsCount = (int) labs.stream().filter(this::isCompletedLab).count();
        long totalLearningTime = traces.stream()
                .map(trace -> doubleValue(trace.get("tempsConsultation")))
                .filter(Objects::nonNull)
                .mapToLong(Double::longValue)
                .sum();
        Double averageAssessmentScore = assessmentScores.isEmpty()
                ? null
                : round(assessmentScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0));
        List<String> gapLabels = knowledgeGaps.stream()
                .map(AdaptiveConceptDto::getConceptName)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        String profileType = resolveProfileType(traces, completedLabsCount, gapLabels, decision);

        return LearnerProfileDto.builder()
                .learnerEmail(learnerEmail)
                .masteryScore(masteryScore)
                .knowledgeGaps(gapLabels)
                .masteredConceptsCount(masteredConcepts.size())
                .weakConceptsCount(gapLabels.size())
                .tracesCount(traces.size())
                .completedLabsCount(completedLabsCount)
                .averageAssessmentScore(averageAssessmentScore)
                .totalLearningTime(totalLearningTime)
                .profileType(profileType)
                .profileExplanation(profileExplanation(profileType))
                .build();
    }

    private String resolveProfileType(
            List<Map<String, Object>> traces,
            int completedLabsCount,
            List<String> knowledgeGaps,
            AdaptiveDecision decision) {
        if (traces.isEmpty() && completedLabsCount == 0) {
            return "DATA_INSUFFICIENT";
        }
        if (!knowledgeGaps.isEmpty()) {
            return "NEEDS_REMEDIATION";
        }
        if ("COMPLETED".equals(decision.nextAction())) {
            return "HIGH_PERFORMING";
        }
        return "PROGRESSING";
    }

    private String profileExplanation(String profileType) {
        return switch (profileType) {
            case "NEEDS_REMEDIATION" -> "Le profil indique des lacunes détectées dans le dernier diagnostic.";
            case "PROGRESSING" -> "Le profil indique une progression active.";
            case "HIGH_PERFORMING" -> "Le profil indique une bonne maîtrise des concepts évalués.";
            default -> "Le profil sera affiné après davantage d'activités.";
        };
    }

    private Map<String, Double> conceptWeights(Map<String, Object> courseTree) {
        Map<String, Double> weights = new LinkedHashMap<>();
        for (Map<String, Object> module : mapList(courseTree.get("modules"))) {
            for (Map<String, Object> chapitre : mapList(module.get("chapitres"))) {
                for (Map<String, Object> concept : mapList(chapitre.get("concepts"))) {
                    String conceptId = stringValue(concept.get("id"));
                    if (conceptId == null) continue;
                    weights.put(conceptId, firstNonNullDouble(concept.get("poidsCognitif"), 1.0));
                }
            }
        }
        return weights;
    }

    private Map<String, List<Double>> conceptScores(Map<String, Object> latestDiagnostic, List<Map<String, Object>> traces) {
        Map<String, List<Double>> scoresByConcept = new LinkedHashMap<>();

        for (Map<String, Object> result : readConceptResults(latestDiagnostic)) {
            String conceptId = stringValue(result.get("conceptId"));
            Double score = doubleValue(result.get("score"));
            if (conceptId != null && score != null) {
                scoresByConcept.computeIfAbsent(conceptId, ignored -> new ArrayList<>()).add(score);
            }
        }

        for (Map<String, Object> trace : traces) {
            String targetId = stringValue(trace.get("targetId"));
            String targetType = stringValue(trace.get("targetType"));
            Double score = doubleValue(trace.get("scoreObtenu"));
            if (targetId != null && score != null && "CONCEPT".equalsIgnoreCase(targetType)) {
                scoresByConcept.computeIfAbsent(targetId, ignored -> new ArrayList<>()).add(score);
            }
            for (Map<String, Object> result : readConceptResults(trace)) {
                String conceptId = stringValue(result.get("conceptId"));
                Double conceptScore = doubleValue(result.get("score"));
                if (conceptId != null && conceptScore != null) {
                    scoresByConcept.computeIfAbsent(conceptId, ignored -> new ArrayList<>()).add(conceptScore);
                }
            }
        }

        return scoresByConcept;
    }

    private List<AdaptiveConceptDto> buildConceptsToReview(
            Map<String, Object> latestDiagnostic,
            Map<String, AdaptiveConceptDto> conceptsById,
            List<AdaptiveConceptDto> masteredConcepts,
            String currentCourseId) {
        if (latestDiagnostic.isEmpty()) return List.of();

        Set<String> masteredIds = masteredConcepts.stream()
                .map(AdaptiveConceptDto::getConceptId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        return readConceptResults(latestDiagnostic).stream()
                .filter(result -> !Boolean.TRUE.equals(result.get("mastered")))
                .map(result -> stringValue(result.get("conceptId")))
                .filter(Objects::nonNull)
                .filter(conceptId -> !masteredIds.contains(conceptId))
                .distinct()
                .map(conceptId -> {
                    AdaptiveConceptDto base = conceptsById.getOrDefault(conceptId, unknownConcept(conceptId));
                    Map<String, Object> source = findConceptResult(latestDiagnostic, conceptId);
                    String type = resolveConceptType(conceptId, conceptsById);
                    return AdaptiveConceptDto.builder()
                            .conceptId(conceptId)
                            .conceptName(firstNonBlank(
                                    stringValue(source.get("conceptName")),
                                    stringValue(source.get("name")),
                                    base.getConceptName(),
                                    "Concept inconnu"))
                            .courseId(firstNonBlank(
                                    stringValue(source.get("courseId")),
                                    stringValue(source.get("ownerCourseId")),
                                    stringValue(source.get("conceptCourseId")),
                                    "INTERNAL".equals(type) ? currentCourseId : null))
                            .type(type)
                            .moduleTitle(base.getModuleTitle())
                            .chapitreTitle(base.getChapitreTitle())
                            .status("TO_REVIEW")
                            .missingPrerequisiteIds(List.of())
                            .build();
                })
                .toList();
    }

    private AdaptiveDecision decide(boolean diagnosticPassed, List<AdaptiveConceptDto> review, List<AdaptiveConceptDto> learnable) {
        if (!diagnosticPassed) {
            return new AdaptiveDecision("PASS_DIAGNOSTIC", null, "DIAGNOSTIC");
        }
        if (!review.isEmpty()) {
            return new AdaptiveDecision("REMEDIATION", review.get(0), "REMEDIATION");
        }
        if (!learnable.isEmpty()) {
            return new AdaptiveDecision("LEARN", learnable.get(0), "LEARNING");
        }
        return new AdaptiveDecision("COMPLETED", null, "COMPLETED");
    }

    private String buildReason(AdaptiveDecision decision) {
        String conceptName = conceptLabel(decision.nextConcept());
        if ("PASS_DIAGNOSTIC".equals(decision.nextAction())) {
            return "Le diagnostic initial est nécessaire pour identifier les acquis et les lacunes avant de proposer un parcours personnalisé.";
        }
        if ("REMEDIATION".equals(decision.nextAction())) {
            return "Le concept " + conceptName + " est prioritaire car il n'a pas ete maîtrise lors du dernier diagnostic.";
        }
        if ("LEARN".equals(decision.nextAction())) {
            return "Le concept " + conceptName + " est recommandé pour poursuivre le parcours pédagogique selon l'ordre d'apprentissage prévu.";
        }
        return "Le cours est considéré terminé car aucun concept accessible ne reste à apprendre dans le parcours actuel.";
    }

    private String buildDecisionExplanation(AdaptiveDecision decision) {
        String conceptName = conceptLabel(decision.nextConcept());
        if ("PASS_DIAGNOSTIC".equals(decision.nextAction())) {
            return "Le système doit d'abord disposer d'un diagnostic pour situer le niveau initial de l'apprenant et adapter la suite du parcours.";
        }
        if ("REMEDIATION".equals(decision.nextAction())) {
            return "Une activité de remédiation est proposée sur " + conceptName + " en raison de lacunes identifiées dans le dernier diagnostic.";
        }
        if ("LEARN".equals(decision.nextAction())) {
            return "Le concept " + conceptName + " est le candidat accessible le plus pertinent selon les critères actuels du parcours adaptatif.";
        }
        return "Le parcours est terminé : les concepts requis sont maîtrisés ou aucun nouveau concept accessible n'est disponible.";
    }

    private Map<String, Object> buildRecommendationMap(AdaptiveDecision decision) {
        Map<String, Object> recommendation = new LinkedHashMap<>();
        recommendation.put("action", decision.nextAction());
        recommendation.put("learningPhase", decision.learningPhase());
        if (decision.nextConcept() != null) {
            recommendation.put("conceptId", decision.nextConcept().getConceptId());
            recommendation.put("conceptName", decision.nextConcept().getConceptName());
            recommendation.put("courseId", decision.nextConcept().getCourseId());
            recommendation.put("type", decision.nextConcept().getType());
        }
        recommendation.put("reason", buildReason(decision));
        return recommendation;
    }

    private List<LearningPathStepDto> buildRecommendedLearningPath(
            List<AdaptiveConceptDto> conceptsToReview,
            List<AdaptiveConceptDto> learnableConcepts,
            List<AdaptiveConceptDto> blockedConcepts,
            List<AdaptiveConceptDto> masteredConcepts,
            Map<String, AdaptiveConceptDto> conceptsById,
            Map<String, Integer> conceptPositions,
            LearnerProfileDto learnerProfile,
            Set<String> failedDiagnosticConceptIds,
            List<Map<String, Object>> traces,
            List<Map<String, Object>> labs) {
        List<LearningPathStepDto> steps = new ArrayList<>();
        Set<String> addedConceptIds = new java.util.LinkedHashSet<>();
        int[] order = {1};
        Map<String, Integer> repeatedFailuresByConcept = detectRepeatedFailures(traces, labs);
        Set<String> masteredConceptIds = masteredConcepts == null
                ? Set.of()
                : masteredConcepts.stream()
                        .map(AdaptiveConceptDto::getConceptId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
        List<AdaptiveConceptDto> reviewWithPersistentFailures = mergePersistentFailureConcepts(
                conceptsToReview,
                conceptsById,
                masteredConceptIds,
                repeatedFailuresByConcept);
        Set<String> remediationSuccessConceptIds = detectRemediationSuccessConcepts(
                failedDiagnosticConceptIds,
                repeatedFailuresByConcept,
                masteredConceptIds,
                traces);
        boolean highMasteryDetected = detectHighMastery(
                learnerProfile,
                failedDiagnosticConceptIds,
                repeatedFailuresByConcept);

        addPathSteps(steps, addedConceptIds, order, reviewWithPersistentFailures, "TO_REVIEW", conceptPositions, repeatedFailuresByConcept, remediationSuccessConceptIds);
        addPathSteps(steps, addedConceptIds, order, learnableConcepts, "READY", conceptPositions, Map.of(), Set.of(), highMasteryDetected);
        addPathSteps(steps, addedConceptIds, order, sortByPedagogicalOrder(blockedConcepts, conceptPositions), "LOCKED", conceptPositions);
        addPathSteps(steps, addedConceptIds, order, sortByPedagogicalOrder(masteredConcepts, conceptPositions), "COMPLETED", conceptPositions, repeatedFailuresByConcept, remediationSuccessConceptIds);

        return steps;
    }

    private void addPathSteps(
            List<LearningPathStepDto> steps,
            Set<String> addedConceptIds,
            int[] order,
            List<AdaptiveConceptDto> concepts,
            String status,
            Map<String, Integer> conceptPositions) {
        addPathSteps(steps, addedConceptIds, order, concepts, status, conceptPositions, Map.of());
    }

    private void addPathSteps(
            List<LearningPathStepDto> steps,
            Set<String> addedConceptIds,
            int[] order,
            List<AdaptiveConceptDto> concepts,
            String status,
            Map<String, Integer> conceptPositions,
            Map<String, Integer> repeatedFailuresByConcept) {
        addPathSteps(steps, addedConceptIds, order, concepts, status, conceptPositions, repeatedFailuresByConcept, Set.of());
    }

    private void addPathSteps(
            List<LearningPathStepDto> steps,
            Set<String> addedConceptIds,
            int[] order,
            List<AdaptiveConceptDto> concepts,
            String status,
            Map<String, Integer> conceptPositions,
            Map<String, Integer> repeatedFailuresByConcept,
            Set<String> remediationSuccessConceptIds) {
        addPathSteps(steps, addedConceptIds, order, concepts, status, conceptPositions, repeatedFailuresByConcept, remediationSuccessConceptIds, false);
    }

    private void addPathSteps(
            List<LearningPathStepDto> steps,
            Set<String> addedConceptIds,
            int[] order,
            List<AdaptiveConceptDto> concepts,
            String status,
            Map<String, Integer> conceptPositions,
            Map<String, Integer> repeatedFailuresByConcept,
            Set<String> remediationSuccessConceptIds,
            boolean highMasteryDetected) {
        if (concepts == null || concepts.isEmpty()) {
            return;
        }

        List<AdaptiveConceptDto> orderedConcepts;
        if ("READY".equals(status)) {
            orderedConcepts = sortReadyConcepts(concepts, conceptPositions, highMasteryDetected);
        } else if ("TO_REVIEW".equals(status)) {
            orderedConcepts = sortReviewConcepts(concepts, conceptPositions, repeatedFailuresByConcept);
        } else {
            orderedConcepts = concepts;
        }

        for (AdaptiveConceptDto concept : orderedConcepts) {
            String conceptId = concept == null ? null : concept.getConceptId();
            if (conceptId == null || !addedConceptIds.add(conceptId)) {
                continue;
            }
            int repeatedFailuresCount = repeatedFailuresByConcept.getOrDefault(conceptId, 0);
            boolean persistentDifficulty = "TO_REVIEW".equals(status)
                    && repeatedFailuresCount >= REPEATED_FAILURE_THRESHOLD;
            boolean remediationSuccess = "COMPLETED".equals(status)
                    && remediationSuccessConceptIds.contains(conceptId);
            boolean highMasteryProgression = "READY".equals(status) && highMasteryDetected;
            steps.add(LearningPathStepDto.builder()
                    .order(order[0]++)
                    .conceptId(conceptId)
                    .conceptName(concept.getConceptName())
                    .status(status)
                    .adaptiveScore(concept.getAdaptiveScore())
                    .explanationReasons(pathStepExplanationReasons(concept, status, repeatedFailuresCount, remediationSuccess, highMasteryProgression))
                    .repeatedFailuresCount(repeatedFailuresCount > 0 ? repeatedFailuresCount : null)
                    .persistentDifficulty(persistentDifficulty ? true : null)
                    .remediationSuccess(remediationSuccess ? true : null)
                    .highMasteryProgression(highMasteryProgression ? true : null)
                    .build());
        }
    }

    private List<AdaptiveConceptDto> sortReadyConcepts(
            List<AdaptiveConceptDto> concepts,
            Map<String, Integer> conceptPositions) {
        return sortReadyConcepts(concepts, conceptPositions, false);
    }

    private List<AdaptiveConceptDto> sortReadyConcepts(
            List<AdaptiveConceptDto> concepts,
            Map<String, Integer> conceptPositions,
            boolean highMasteryDetected) {
        List<AdaptiveConceptDto> normallyOrdered = concepts.stream()
                .sorted(Comparator
                        .comparing(AdaptiveConceptDto::getAdaptiveScore, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(concept -> conceptPositions.getOrDefault(concept.getConceptId(), Integer.MAX_VALUE)))
                .toList();

        if (!highMasteryDetected || normallyOrdered.size() < 2) {
            return normallyOrdered;
        }

        double bestScore = normallyOrdered.stream()
                .map(AdaptiveConceptDto::getAdaptiveScore)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(Double.NaN);
        if (Double.isNaN(bestScore)) {
            return normallyOrdered;
        }

        List<AdaptiveConceptDto> closeReadyConcepts = normallyOrdered.stream()
                .filter(concept -> isCloseToBestReadyScore(concept, bestScore))
                .sorted(Comparator
                        .comparing((AdaptiveConceptDto concept) -> conceptPositions.getOrDefault(concept.getConceptId(), Integer.MAX_VALUE))
                        .reversed()
                        .thenComparing(AdaptiveConceptDto::getAdaptiveScore, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<AdaptiveConceptDto> remainingConcepts = normallyOrdered.stream()
                .filter(concept -> !isCloseToBestReadyScore(concept, bestScore))
                .toList();
        List<AdaptiveConceptDto> controlledProgression = new ArrayList<>(closeReadyConcepts);
        controlledProgression.addAll(remainingConcepts);
        return controlledProgression;
    }

    private boolean isCloseToBestReadyScore(AdaptiveConceptDto concept, double bestScore) {
        Double score = concept == null ? null : concept.getAdaptiveScore();
        return score != null && bestScore - score <= HIGH_MASTERY_READY_SCORE_PROXIMITY;
    }

    private boolean detectHighMastery(
            LearnerProfileDto learnerProfile,
            Set<String> failedDiagnosticConceptIds,
            Map<String, Integer> repeatedFailuresByConcept) {
        if (learnerProfile == null) {
            return false;
        }
        int knowledgeGapsCount = learnerProfile.getKnowledgeGaps() == null
                ? 0
                : learnerProfile.getKnowledgeGaps().size();
        boolean hasDiagnosticWeakness = failedDiagnosticConceptIds != null && !failedDiagnosticConceptIds.isEmpty();
        boolean hasPersistentDifficulty = repeatedFailuresByConcept != null
                && repeatedFailuresByConcept.values().stream().anyMatch(count -> count >= REPEATED_FAILURE_THRESHOLD);
        if (knowledgeGapsCount > MAX_KNOWLEDGE_GAPS_FOR_HIGH_MASTERY
                || hasDiagnosticWeakness
                || hasPersistentDifficulty) {
            return false;
        }

        boolean highMasteryScore = learnerProfile.getMasteryScore() != null
                && learnerProfile.getMasteryScore() >= HIGH_MASTERY_SCORE_THRESHOLD;
        boolean highAssessmentAverage = learnerProfile.getAverageAssessmentScore() != null
                && learnerProfile.getAverageAssessmentScore() >= HIGH_ASSESSMENT_THRESHOLD;
        boolean severalMasteredConcepts = learnerProfile.getMasteredConceptsCount() >= HIGH_MASTERED_CONCEPTS_THRESHOLD;
        return highMasteryScore || highAssessmentAverage || severalMasteredConcepts;
    }

    private List<AdaptiveConceptDto> mergePersistentFailureConcepts(
            List<AdaptiveConceptDto> conceptsToReview,
            Map<String, AdaptiveConceptDto> conceptsById,
            Set<String> masteredConceptIds,
            Map<String, Integer> repeatedFailuresByConcept) {
        Map<String, AdaptiveConceptDto> merged = new LinkedHashMap<>();
        if (conceptsToReview != null) {
            for (AdaptiveConceptDto concept : conceptsToReview) {
                if (concept != null && concept.getConceptId() != null) {
                    merged.put(concept.getConceptId(), concept);
                }
            }
        }

        for (Map.Entry<String, Integer> entry : repeatedFailuresByConcept.entrySet()) {
            String conceptId = entry.getKey();
            if (entry.getValue() < REPEATED_FAILURE_THRESHOLD
                    || masteredConceptIds.contains(conceptId)
                    || merged.containsKey(conceptId)) {
                continue;
            }
            AdaptiveConceptDto base = conceptsById.getOrDefault(conceptId, unknownConcept(conceptId));
            merged.put(conceptId, AdaptiveConceptDto.builder()
                    .conceptId(conceptId)
                    .conceptName(base.getConceptName())
                    .courseId(base.getCourseId())
                    .type(base.getType())
                    .moduleTitle(base.getModuleTitle())
                    .chapitreTitle(base.getChapitreTitle())
                    .status("TO_REVIEW")
                    .missingPrerequisiteIds(List.of())
                    .build());
        }
        return new ArrayList<>(merged.values());
    }

    private List<AdaptiveConceptDto> sortReviewConcepts(
            List<AdaptiveConceptDto> concepts,
            Map<String, Integer> conceptPositions,
            Map<String, Integer> repeatedFailuresByConcept) {
        return concepts.stream()
                .sorted(Comparator
                        .comparing((AdaptiveConceptDto concept) ->
                                repeatedFailuresByConcept.getOrDefault(concept.getConceptId(), 0) >= REPEATED_FAILURE_THRESHOLD
                                        ? 0
                                        : 1)
                        .thenComparing(concept -> conceptPositions.getOrDefault(concept.getConceptId(), Integer.MAX_VALUE)))
                .toList();
    }

    private Set<String> detectRemediationSuccessConcepts(
            Set<String> failedDiagnosticConceptIds,
            Map<String, Integer> repeatedFailuresByConcept,
            Set<String> masteredConceptIds,
            List<Map<String, Object>> traces) {
        Set<String> remediationCandidates = new java.util.LinkedHashSet<>();
        if (failedDiagnosticConceptIds != null) {
            remediationCandidates.addAll(failedDiagnosticConceptIds);
        }
        repeatedFailuresByConcept.entrySet().stream()
                .filter(entry -> entry.getValue() >= REPEATED_FAILURE_THRESHOLD)
                .map(Map.Entry::getKey)
                .forEach(remediationCandidates::add);

        return remediationCandidates.stream()
                .filter(masteredConceptIds::contains)
                .filter(conceptId -> hasSuccessfulActivity(conceptId, traces) || masteredConceptIds.contains(conceptId))
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    private boolean hasSuccessfulActivity(String conceptId, List<Map<String, Object>> traces) {
        if (conceptId == null || traces == null) {
            return false;
        }
        return traces.stream().anyMatch(trace -> isSuccessfulTraceForConcept(conceptId, trace));
    }

    private boolean isSuccessfulTraceForConcept(String conceptId, Map<String, Object> trace) {
        String directConceptId = firstNonBlank(stringValue(trace.get("conceptId")), stringValue(trace.get("targetId")));
        Double score = doubleValue(trace.get("scoreObtenu"));
        if (conceptId.equals(directConceptId) && score != null && score >= 60.0 && isConceptTrace(stringValue(trace.get("targetType")), trace)) {
            return true;
        }
        for (Map<String, Object> result : readNestedConceptResults(trace)) {
            String resultConceptId = stringValue(result.get("conceptId"));
            Double conceptScore = doubleValue(result.get("score"));
            boolean mastered = Boolean.TRUE.equals(result.get("mastered"));
            if (conceptId.equals(resultConceptId) && (mastered || (conceptScore != null && conceptScore >= 60.0))) {
                return true;
            }
        }
        return false;
    }

    private Map<String, Integer> detectRepeatedFailures(List<Map<String, Object>> traces, List<Map<String, Object>> labs) {
        Map<String, Integer> failuresByConcept = new LinkedHashMap<>();
        if (traces != null) {
            for (Map<String, Object> trace : traces) {
                countFailedTrace(failuresByConcept, trace);
            }
        }
        if (labs != null) {
            for (Map<String, Object> lab : labs) {
                countFailedLab(failuresByConcept, lab);
            }
        }
        return failuresByConcept;
    }

    private void countFailedTrace(Map<String, Integer> failuresByConcept, Map<String, Object> trace) {
        Double score = doubleValue(trace.get("scoreObtenu"));
        String targetType = stringValue(trace.get("targetType"));
        String directConceptId = firstNonBlank(stringValue(trace.get("conceptId")), stringValue(trace.get("targetId")));
        if (score != null && score < 60.0 && directConceptId != null && isConceptTrace(targetType, trace)) {
            incrementFailure(failuresByConcept, directConceptId);
        }
        for (Map<String, Object> result : readNestedConceptResults(trace)) {
            String conceptId = stringValue(result.get("conceptId"));
            if (conceptId == null) {
                continue;
            }
            Double conceptScore = doubleValue(result.get("score"));
            boolean failed = Boolean.FALSE.equals(result.get("mastered")) || (conceptScore != null && conceptScore < 60.0);
            if (failed) {
                incrementFailure(failuresByConcept, conceptId);
            }
        }
    }

    private boolean isConceptTrace(String targetType, Map<String, Object> trace) {
        return "CONCEPT".equalsIgnoreCase(targetType)
                || !isBlank(stringValue(trace.get("conceptId")));
    }

    private void countFailedLab(Map<String, Integer> failuresByConcept, Map<String, Object> lab) {
        String status = stringValue(lab.get("status"));
        if (!isFailedLabStatus(status)) {
            return;
        }
        String conceptId = firstNonBlank(stringValue(lab.get("conceptId")), stringValue(lab.get("targetId")));
        if (conceptId != null) {
            incrementFailure(failuresByConcept, conceptId);
        }
    }

    private boolean isFailedLabStatus(String status) {
        if (status == null) {
            return false;
        }
        String normalized = status.trim().toUpperCase();
        return "FAILED".equals(normalized)
                || "FAIL".equals(normalized)
                || "REJECTED".equals(normalized)
                || "NOT_VALIDATED".equals(normalized)
                || "INCOMPLETE".equals(normalized);
    }

    private void incrementFailure(Map<String, Integer> failuresByConcept, String conceptId) {
        failuresByConcept.merge(conceptId, 1, Integer::sum);
    }

    private List<Map<String, Object>> readNestedConceptResults(Map<String, Object> trace) {
        Object raw = trace.get("conceptResults");
        if (raw instanceof String json && !json.isBlank()) {
            try {
                Object parsed = objectMapper.readValue(json, Object.class);
                return extractConceptResults(parsed);
            } catch (Exception ignored) {
                return List.of();
            }
        }
        return extractConceptResults(raw);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractConceptResults(Object value) {
        if (value instanceof Map<?, ?> map && map.containsKey("concepts")) {
            return mapList(((Map<String, Object>) map).get("concepts"));
        }
        return mapListOrSingle(value);
    }

    private List<AdaptiveConceptDto> sortByPedagogicalOrder(
            List<AdaptiveConceptDto> concepts,
            Map<String, Integer> conceptPositions) {
        if (concepts == null || concepts.isEmpty()) {
            return List.of();
        }
        return concepts.stream()
                .sorted(Comparator.comparing(concept -> conceptPositions.getOrDefault(concept.getConceptId(), Integer.MAX_VALUE)))
                .toList();
    }

    private List<String> pathStepExplanationReasons(AdaptiveConceptDto concept, String status, int repeatedFailuresCount) {
        return pathStepExplanationReasons(concept, status, repeatedFailuresCount, false);
    }

    private List<String> pathStepExplanationReasons(
            AdaptiveConceptDto concept,
            String status,
            int repeatedFailuresCount,
            boolean remediationSuccess) {
        return pathStepExplanationReasons(concept, status, repeatedFailuresCount, remediationSuccess, false);
    }

    private List<String> pathStepExplanationReasons(
            AdaptiveConceptDto concept,
            String status,
            int repeatedFailuresCount,
            boolean remediationSuccess,
            boolean highMasteryProgression) {
        if ("TO_REVIEW".equals(status) && repeatedFailuresCount >= REPEATED_FAILURE_THRESHOLD) {
            List<String> reasons = new ArrayList<>();
            reasons.add("Le concept " + conceptLabel(concept) + " est prioritaire car " + repeatedFailuresCount
                    + " difficult\u00e9s successives ont \u00e9t\u00e9 observ\u00e9es dans vos activit\u00e9s r\u00e9centes.");
            reasons.add("Une rem\u00e9diation renforc\u00e9e est propos\u00e9e afin de consolider ce concept avant de poursuivre le parcours.");
            return reasons;
        }
        if ("COMPLETED".equals(status) && remediationSuccess) {
            List<String> reasons = new ArrayList<>();
            if (repeatedFailuresCount >= REPEATED_FAILURE_THRESHOLD) {
                reasons.add("Apr\u00e8s plusieurs difficult\u00e9s successives, ce concept semble d\u00e9sormais consolid\u00e9.");
            }
            reasons.add("La rem\u00e9diation semble r\u00e9ussie car ce concept est d\u00e9sormais ma\u00eetris\u00e9 apr\u00e8s une activit\u00e9 r\u00e9cente.");
            return reasons;
        }
        if ("READY".equals(status) && highMasteryProgression) {
            List<String> reasons = new ArrayList<>(pathStepExplanationReasons(concept, status));
            reasons.add("Votre progression r\u00e9cente indique une bonne ma\u00eetrise des concepts pr\u00e9c\u00e9dents.");
            reasons.add("Les prochaines activit\u00e9s recommand\u00e9es sont l\u00e9g\u00e8rement prioris\u00e9es afin de maintenir votre progression p\u00e9dagogique.");
            return reasons.stream().distinct().toList();
        }
        return pathStepExplanationReasons(concept, status);
    }

    private List<String> pathStepExplanationReasons(AdaptiveConceptDto concept, String status) {
        String label = conceptLabel(concept);
        if ("TO_REVIEW".equals(status)) {
            return List.of("Le concept " + label + " est placé en remédiation car une lacune a été détectée lors du dernier diagnostic.");
        }
        if ("READY".equals(status)) {
            List<String> reasons = concept.getExplanationReasons();
            if (reasons != null && !reasons.isEmpty()) {
                return reasons;
            }
            return List.of("Le concept " + label + " est accessible car les prérequis requis sont satisfaits.");
        }
        if ("LOCKED".equals(status)) {
            return List.of("Le concept " + label + " est verrouillé car certains prérequis ne sont pas encore maîtrisés.");
        }
        return List.of("Le concept " + label + " est déjà maîtrisé et n’est pas prioritaire dans le parcours actuel.");
    }

    private List<AdaptiveConceptDto> scoreAndSortLearnableConcepts(
            List<AdaptiveConceptDto> learnable,
            Set<String> failedDiagnosticConceptIds,
            Map<String, Integer> conceptPositions,
            Set<String> conceptsWithDeclaredPrerequisites,
            int totalConcepts,
            List<Map<String, Object>> traces,
            List<Map<String, Object>> labs) {
        if (learnable.isEmpty()) return learnable;

        double historicalPerformanceScore = historicalPerformanceScore(traces);
        double engagementScore = engagementScore(traces, labs);

        return learnable.stream()
                .map(concept -> scoreConcept(
                        concept,
                        failedDiagnosticConceptIds,
                        conceptsWithDeclaredPrerequisites,
                        conceptPositions.getOrDefault(concept.getConceptId(), totalConcepts),
                        totalConcepts,
                        historicalPerformanceScore,
                        engagementScore
                ))
                .sorted(Comparator
                        .comparing(AdaptiveConceptDto::getAdaptiveScore, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(concept -> conceptPositions.getOrDefault(concept.getConceptId(), Integer.MAX_VALUE)))
                .toList();
    }

    private AdaptiveConceptDto scoreConcept(
            AdaptiveConceptDto concept,
            Set<String> failedDiagnosticConceptIds,
            Set<String> conceptsWithDeclaredPrerequisites,
            int position,
            int totalConcepts,
            double historicalPerformanceScore,
            double engagementScore) {
        double prerequisiteScore = prerequisiteScore(concept, conceptsWithDeclaredPrerequisites);
        double diagnosticWeaknessScore = diagnosticWeaknessScore(concept, failedDiagnosticConceptIds);
        double pedagogicalOrderScore = pedagogicalOrderScore(position, totalConcepts);
        double adaptiveScore = round(
                0.35 * prerequisiteScore
                        + 0.25 * diagnosticWeaknessScore
                        + 0.15 * historicalPerformanceScore
                        + 0.15 * pedagogicalOrderScore
                        + 0.10 * engagementScore
        );

        Map<String, Double> scoreBreakdown = new LinkedHashMap<>();
        scoreBreakdown.put("prerequisiteScore", prerequisiteScore);
        scoreBreakdown.put("diagnosticWeaknessScore", diagnosticWeaknessScore);
        scoreBreakdown.put("historicalPerformanceScore", historicalPerformanceScore);
        scoreBreakdown.put("pedagogicalOrderScore", pedagogicalOrderScore);
        scoreBreakdown.put("engagementScore", engagementScore);

        return AdaptiveConceptDto.builder()
                .conceptId(concept.getConceptId())
                .conceptName(concept.getConceptName())
                .courseId(concept.getCourseId())
                .type(concept.getType())
                .moduleTitle(concept.getModuleTitle())
                .chapitreTitle(concept.getChapitreTitle())
                .status(concept.getStatus())
                .missingPrerequisiteIds(concept.getMissingPrerequisiteIds())
                .adaptiveScore(adaptiveScore)
                .scoreBreakdown(scoreBreakdown)
                .explanationReasons(buildLearnExplanationReasons(
                        concept.getConceptName(),
                        prerequisiteScore,
                        diagnosticWeaknessScore,
                        historicalPerformanceScore,
                        pedagogicalOrderScore,
                        engagementScore
                ))
                .build();
    }

    private AdaptiveConceptDto withRemediationExplanation(AdaptiveConceptDto concept) {
        return AdaptiveConceptDto.builder()
                .conceptId(concept.getConceptId())
                .conceptName(concept.getConceptName())
                .courseId(concept.getCourseId())
                .type(concept.getType())
                .moduleTitle(concept.getModuleTitle())
                .chapitreTitle(concept.getChapitreTitle())
                .status(concept.getStatus())
                .missingPrerequisiteIds(concept.getMissingPrerequisiteIds())
                .adaptiveScore(concept.getAdaptiveScore())
                .scoreBreakdown(concept.getScoreBreakdown())
                .explanationReasons(List.of(
                        "Le concept " + conceptLabel(concept) + " est recommandé car il n'a pas été maîtrisé lors du dernier diagnostic.",
                        "Cette remédiation vise à consolider une lacune avant de poursuivre la progression."
                ))
                .build();
    }

    private double prerequisiteScore(AdaptiveConceptDto concept, Set<String> conceptsWithDeclaredPrerequisites) {
        List<String> missingPrerequisites = concept.getMissingPrerequisiteIds() == null
                ? List.of()
                : concept.getMissingPrerequisiteIds();
        if (!missingPrerequisites.isEmpty()) return 0.0;
        return conceptsWithDeclaredPrerequisites.contains(concept.getConceptId()) ? 1.0 : 0.5;
    }

    private double diagnosticWeaknessScore(AdaptiveConceptDto concept, Set<String> failedDiagnosticConceptIds) {
        if (failedDiagnosticConceptIds.contains(concept.getConceptId())) return 1.0;
        List<String> missingPrerequisites = concept.getMissingPrerequisiteIds() == null
                ? List.of()
                : concept.getMissingPrerequisiteIds();
        boolean hasFailedPrerequisite = missingPrerequisites.stream().anyMatch(failedDiagnosticConceptIds::contains);
        return hasFailedPrerequisite ? 0.7 : 0.3;
    }

    private double historicalPerformanceScore(List<Map<String, Object>> traces) {
        List<Double> scores = traces.stream()
                .map(trace -> doubleValue(trace.get("scoreObtenu")))
                .filter(Objects::nonNull)
                .toList();
        if (scores.isEmpty()) return 0.5;
        double average = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        if (average >= 80.0) return 1.0;
        if (average >= 60.0) return 0.7;
        return 0.4;
    }

    private double pedagogicalOrderScore(int position, int totalConcepts) {
        if (totalConcepts <= 0) return 0.1;
        double score = 1.0 - ((double) position / totalConcepts);
        return round(Math.max(0.1, score));
    }

    private double engagementScore(List<Map<String, Object>> traces, List<Map<String, Object>> labs) {
        long completedLabs = labs.stream().filter(this::isCompletedLab).count();
        long startedLabs = labs.stream().filter(lab -> "STARTED".equals(stringValue(lab.get("status")))).count();
        long failedTraces = traces.stream()
                .map(trace -> doubleValue(trace.get("scoreObtenu")))
                .filter(Objects::nonNull)
                .filter(score -> score < 60.0)
                .count();

        if ((startedLabs >= 3 && completedLabs == 0) || (failedTraces >= 3 && failedTraces > completedLabs + 1)) {
            return 0.3;
        }
        if (labs.stream().anyMatch(this::isRecentCompletedLab)) return 1.0;
        if (traces.stream().anyMatch(this::isRecentTrace)) return 0.7;
        if (completedLabs > 0) return 1.0;
        if (!traces.isEmpty()) return 0.7;
        return 0.5;
    }

    private List<String> buildLearnExplanationReasons(
            String conceptName,
            double prerequisiteScore,
            double diagnosticWeaknessScore,
            double historicalPerformanceScore,
            double pedagogicalOrderScore,
            double engagementScore) {
        List<String> reasons = new ArrayList<>();
        String label = conceptLabel(conceptName);
        if (prerequisiteScore >= 1.0) {
            reasons.add("Le concept " + label + " est accessible car les prérequis requis sont satisfaits.");
        } else if (prerequisiteScore >= 0.5) {
            reasons.add("Le concept " + label + " peut être abordé car aucun prérequis bloquant n'est déclaré.");
        }
        if (diagnosticWeaknessScore >= 1.0) {
            reasons.add("Le dernier diagnostic signale que " + label + " nécessite un renforcement.");
        } else if (diagnosticWeaknessScore >= 0.7) {
            reasons.add("La recommandation tient compte d'un prérequis proche fragilisé lors du diagnostic.");
        }
        if (pedagogicalOrderScore >= 0.5) {
            reasons.add("Ce choix respecte l'ordre pédagogique prévu dans le cours.");
        }
        if (historicalPerformanceScore >= 0.7) {
            reasons.add("L'historique récent montre une progression suffisante pour aborder cette étape.");
        } else if (historicalPerformanceScore <= 0.4) {
            reasons.add("Cette recommandation tient compte des difficultés observées dans les activités précédentes.");
        }
        if (engagementScore >= 1.0) {
            reasons.add("L'activité récente sur les TP indique une dynamique favorable pour poursuivre l'apprentissage.");
        } else if (engagementScore <= 0.3) {
            reasons.add("Le système privilégie un apprentissage progressif adapté au rythme observé.");
        }
        if (reasons.isEmpty()) {
            reasons.add("Le concept " + label + " constitue la prochaine étape accessible la plus pertinente.");
        }
        return reasons;
    }

    private Map<String, Integer> buildConceptPositions(Map<String, AdaptiveConceptDto> conceptsById) {
        Map<String, Integer> positions = new LinkedHashMap<>();
        int index = 0;
        for (String conceptId : conceptsById.keySet()) {
            positions.put(conceptId, index++);
        }
        return positions;
    }

    private Set<String> buildConceptsWithDeclaredPrerequisites(Map<String, Object> courseTree) {
        return mapList(courseTree.get("modules")).stream()
                .flatMap(module -> mapList(module.get("chapitres")).stream())
                .flatMap(chapitre -> mapList(chapitre.get("concepts")).stream())
                .flatMap(concept -> mapList(concept.get("exigences")).stream())
                .map(exigence -> stringValue(exigence.get("id")))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private Map<String, AdaptiveConceptDto> flattenConcepts(Map<String, Object> courseTree, String courseId) {
        Map<String, AdaptiveConceptDto> result = new LinkedHashMap<>();
        for (Map<String, Object> module : mapList(courseTree.get("modules"))) {
            String moduleTitle = firstNonBlank(stringValue(module.get("title")), stringValue(module.get("titre")), "");
            for (Map<String, Object> chapitre : mapList(module.get("chapitres"))) {
                String chapitreTitle = firstNonBlank(stringValue(chapitre.get("title")), stringValue(chapitre.get("titre")), "");
                for (Map<String, Object> concept : mapList(chapitre.get("concepts"))) {
                    String conceptId = stringValue(concept.get("id"));
                    if (conceptId == null) continue;
                    result.put(conceptId, AdaptiveConceptDto.builder()
                            .conceptId(conceptId)
                            .conceptName(firstNonBlank(
                                    stringValue(concept.get("labelPedagogique")),
                                    stringValue(concept.get("title")),
                                    stringValue(concept.get("name")),
                                    "Concept inconnu"))
                            .courseId(firstNonBlank(stringValue(concept.get("courseId")), stringValue(courseTree.get("id")), courseId))
                            .type("INTERNAL")
                            .moduleTitle(moduleTitle)
                            .chapitreTitle(chapitreTitle)
                            .status("LEARNABLE")
                            .missingPrerequisiteIds(List.of())
                            .build());
                }
            }
        }
        return result;
    }

    private AdaptiveConceptDto unknownConcept(String conceptId) {
        return AdaptiveConceptDto.builder()
                .conceptId(conceptId)
                .conceptName("Concept inconnu")
                .type("EXTERNAL")
                .moduleTitle("")
                .chapitreTitle("")
                .status("UNKNOWN")
                .missingPrerequisiteIds(List.of())
                .build();
    }

    private Map<String, Object> getMap(String url) {
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
        return response.getBody() == null ? Map.of() : response.getBody();
    }

    private Map<String, Object> getMapOrEmpty(String url) {
        try {
            return getMap(url);
        } catch (RestClientException ex) {
            return Map.of();
        }
    }

    private List<Map<String, Object>> getList(String url) {
        try {
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
            return response.getBody() == null ? List.of() : response.getBody();
        } catch (RestClientException ex) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                    .filter(Map.class::isInstance)
                    .map(item -> (Map<String, Object>) item)
                    .toList();
        }
        return List.of();
    }

    private List<Map<String, Object>> readConceptResults(Map<String, Object> diagnostic) {
        Object raw = diagnostic.get("conceptResults");
        if (raw instanceof String json && !json.isBlank()) {
            try {
                Object parsed = objectMapper.readValue(json, Object.class);
                if (parsed instanceof List<?> || parsed instanceof Map<?, ?>) {
                    return mapListOrSingle(parsed);
                }
            } catch (Exception ignored) {
                return List.of();
            }
        }
        return mapListOrSingle(raw);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapListOrSingle(Object value) {
        if (value instanceof Map<?, ?> map) {
            return List.of((Map<String, Object>) map);
        }
        return mapList(value);
    }

    private Map<String, Object> findConceptResult(Map<String, Object> diagnostic, String conceptId) {
        return readConceptResults(diagnostic).stream()
                .filter(result -> conceptId.equals(stringValue(result.get("conceptId"))))
                .findFirst()
                .orElse(Map.of());
    }

    private String resolveConceptType(String conceptId, Map<String, AdaptiveConceptDto> conceptsById) {
        return conceptsById.containsKey(conceptId) ? "INTERNAL" : "EXTERNAL";
    }

    private List<String> toStringList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                    .map(this::stringValue)
                    .filter(Objects::nonNull)
                    .toList();
        }
        return Collections.emptyList();
    }

    private boolean isCompletedLab(Map<String, Object> lab) {
        return "COMPLETED".equals(stringValue(lab.get("status")));
    }

    private boolean isRecentCompletedLab(Map<String, Object> lab) {
        return isCompletedLab(lab) && isRecentDate(lab.get("completedAt"));
    }

    private boolean isRecentTrace(Map<String, Object> trace) {
        return isRecentDate(trace.get("horodatage"));
    }

    private boolean isRecentDate(Object value) {
        LocalDateTime date = toLocalDateTime(value);
        return date != null && date.isAfter(LocalDateTime.now().minusDays(14));
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDateTime localDateTime) return localDateTime;
        if (value instanceof OffsetDateTime offsetDateTime) return offsetDateTime.toLocalDateTime();
        String raw = String.valueOf(value);
        if (raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw);
        } catch (DateTimeParseException ignored) {
            try {
                return OffsetDateTime.parse(raw).toLocalDateTime();
            } catch (DateTimeParseException ignoredAgain) {
                return null;
            }
        }
    }

    private Double doubleValue(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        if (value == null) return null;
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private double firstNonNullDouble(Object value, double fallback) {
        Double parsed = doubleValue(value);
        return parsed == null ? fallback : parsed;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String conceptLabel(AdaptiveConceptDto concept) {
        return conceptLabel(concept == null ? null : concept.getConceptName());
    }

    private String conceptLabel(String conceptName) {
        return conceptName == null || conceptName.isBlank()
                ? "ce concept"
                : "'" + conceptName + "'";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private record AdaptiveDecision(String nextAction, AdaptiveConceptDto nextConcept, String learningPhase) {
    }
}
