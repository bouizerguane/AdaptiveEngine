package com.ale.adaptive.service;

import com.ale.adaptive.dto.AdaptiveConceptDto;
import com.ale.adaptive.dto.AdaptivePathResponse;
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

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${services.graph.url}")
    private String graphServiceUrl;

    @Value("${services.tracking.url}")
    private String trackingServiceUrl;

    public AdaptivePathResponse buildPath(String learnerEmail, String courseId) {
        Map<String, Object> courseTree = getMap(graphServiceUrl + "/api/graph/courses/" + courseId + "/tree");
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
        AdaptiveDecision decision = decide(!latestDiagnostic.isEmpty(), review, learnable);

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
                .build();
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
