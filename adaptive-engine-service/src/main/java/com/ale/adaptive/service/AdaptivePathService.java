package com.ale.adaptive.service;

import com.ale.adaptive.dto.AdaptiveConceptDto;
import com.ale.adaptive.dto.AdaptivePathResponse;
import com.ale.adaptive.dto.LearnerProfileDto;
import com.ale.adaptive.dto.PedagogicalStrategyDto;
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

    private static final String SCORING_VERSION = "V3_RULE_BASED_EXPLAINABLE";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${services.graph.url}")
    private String graphServiceUrl;

    @Value("${services.tracking.url}")
    private String trackingServiceUrl;

    public AdaptivePathResponse buildPath(String learnerEmail, String courseId) {
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

        log.info("[AdaptiveEngine] decision = {}", decision.nextAction());
        log.info("[AdaptiveEngine] nextConcept = {}", decision.nextConcept() == null
                ? "none"
                : decision.nextConcept().getConceptId() + " / " + decision.nextConcept().getConceptName()
                + " / " + decision.nextConcept().getType());

        return AdaptivePathResponse.builder()
                .learnerEmail(learnerEmail)
                .courseId(courseId)
                .courseTitle(firstNonBlank(stringValue(courseTree.get("title")), stringValue(courseTree.get("titre")), "Cours sans titre"))
                .diagnosticPassed(!latestDiagnostic.isEmpty())
                .masteredConcepts(mastered)
                .learnableConcepts(learnable)
                .blockedConcepts(blocked)
                .conceptsToReview(review)
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
                .build();
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
                    "Le systeme privilegie une strategie de recuperation car des lacunes ont ete detectees.",
                    List.of("RESOURCE", "REVIEW", "LAB", "FORMATIVE"),
                    strategyConstraints(learnerProfile, decision),
                    "Proposer une explication simplifiee et rappeler les prerequis."
            );
        }

        if ("HIGH_PERFORMING".equals(profileType)
                && ("LEARN".equals(decision.nextAction()) || "COMPLETED".equals(decision.nextAction()))) {
            return strategy(
                    "ADVANCED",
                    "Le systeme propose une strategie avancee car le profil indique une bonne maitrise.",
                    List.of("RESOURCE", "CHALLENGE", "FORMATIVE"),
                    strategyConstraints(learnerProfile, decision),
                    "Proposer un defi ou une activite d'approfondissement."
            );
        }

        if ("DATA_INSUFFICIENT".equals(profileType) || (tracesCount == 0 && completedLabsCount == 0)) {
            return strategy(
                    "SUPPORTIVE",
                    "Le systeme propose une progression guidee car les donnees d'apprentissage sont encore limitees.",
                    List.of("RESOURCE", "LAB", "FORMATIVE"),
                    strategyConstraints(learnerProfile, decision),
                    "Encourager l'apprenant et proposer une activite guidee."
            );
        }

        return strategy(
                "STANDARD",
                "Le systeme applique une progression standard basee sur le parcours recommande.",
                List.of("RESOURCE", "LAB", "FORMATIVE"),
                strategyConstraints(learnerProfile, decision),
                "Accompagner l'apprenant dans la sequence normale ressource-TP-evaluation."
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
            constraints.add("Appliquer la strategie au concept recommande: " + decision.nextConcept().getConceptName() + ".");
        }
        if (learnerProfile != null && learnerProfile.getKnowledgeGaps() != null && !learnerProfile.getKnowledgeGaps().isEmpty()) {
            constraints.add("Traiter les lacunes detectees avant d'avancer.");
        }
        if (learnerProfile != null && "DATA_INSUFFICIENT".equals(learnerProfile.getProfileType())) {
            constraints.add("Collecter davantage de traces avant d'affiner la personnalisation.");
        }
        if (constraints.isEmpty()) {
            constraints.add("Conserver la progression recommandee par le parcours adaptatif.");
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
            case "NEEDS_REMEDIATION" -> "Le profil indique des lacunes detectees dans le dernier diagnostic.";
            case "PROGRESSING" -> "Le profil indique une progression active.";
            case "HIGH_PERFORMING" -> "Le profil indique une bonne maitrise des concepts evalues.";
            default -> "Le profil sera affine apres davantage d'activites.";
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
        if ("PASS_DIAGNOSTIC".equals(decision.nextAction())) {
            return "Le diagnostic initial doit etre passe avant de generer le parcours.";
        }
        if ("REMEDIATION".equals(decision.nextAction())) {
            return "Le parcours commence par les concepts non maitrises detectes lors du dernier diagnostic.";
        }
        if ("LEARN".equals(decision.nextAction())) {
            return "Le prochain concept est accessible car ses prerequis sont satisfaits ou inexistants.";
        }
        return "Tous les concepts disponibles sont maitrises ou aucun concept n'est disponible.";
    }

    private String buildDecisionExplanation(AdaptiveDecision decision) {
        if ("PASS_DIAGNOSTIC".equals(decision.nextAction())) {
            return "Le diagnostic initial doit etre passe avant de recommander un parcours personnalise.";
        }
        if ("REMEDIATION".equals(decision.nextAction())) {
            return "La priorite est donnee au concept non maitrise lors du dernier diagnostic.";
        }
        if ("LEARN".equals(decision.nextAction())) {
            return "Le concept recommande est celui qui obtient le meilleur score adaptatif parmi les concepts accessibles.";
        }
        return "Le parcours est termine : aucun concept accessible ne reste a apprendre.";
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
                .explanationReasons(List.of("Ce concept est prioritaire car il n'a pas ete maitrise lors du diagnostic."))
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
            double prerequisiteScore,
            double diagnosticWeaknessScore,
            double historicalPerformanceScore,
            double pedagogicalOrderScore,
            double engagementScore) {
        List<String> reasons = new ArrayList<>();
        if (prerequisiteScore >= 1.0) {
            reasons.add("Tous les prerequis de ce concept sont satisfaits.");
        } else if (prerequisiteScore >= 0.5) {
            reasons.add("Ce concept peut etre aborde sans prerequis declares.");
        }
        if (diagnosticWeaknessScore >= 1.0) {
            reasons.add("Le dernier diagnostic indique que ce concept doit etre renforce.");
        } else if (diagnosticWeaknessScore >= 0.7) {
            reasons.add("Un prerequis proche a ete fragile lors du diagnostic.");
        }
        if (pedagogicalOrderScore >= 0.5) {
            reasons.add("Ce concept suit l'ordre pedagogique recommande.");
        }
        if (historicalPerformanceScore >= 0.7) {
            reasons.add("Votre historique recent montre une progression suffisante.");
        } else if (historicalPerformanceScore <= 0.4) {
            reasons.add("Le moteur garde une progression prudente car les scores precedents sont faibles.");
        }
        if (engagementScore >= 1.0) {
            reasons.add("Votre activite recente sur les TP permet d'aborder ce concept maintenant.");
        } else if (engagementScore <= 0.3) {
            reasons.add("La recommandation tient compte des difficultes ou abandons recents.");
        }
        if (reasons.isEmpty()) {
            reasons.add("Ce concept est accessible et constitue la prochaine etape la plus pertinente.");
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

    private record AdaptiveDecision(String nextAction, AdaptiveConceptDto nextConcept, String learningPhase) {
    }
}
