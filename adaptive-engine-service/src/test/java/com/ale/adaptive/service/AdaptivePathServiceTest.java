package com.ale.adaptive.service;

import com.ale.adaptive.dto.AdaptiveConceptDto;
import com.ale.adaptive.dto.AdaptivePathResponse;
import com.ale.adaptive.dto.LearningPathStepDto;
import com.ale.adaptive.dto.PathFreshnessDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdaptivePathServiceTest {

    private static final String LEARNER_EMAIL = "learner@test.local";
    private static final String COURSE_ID = "course-java";

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private AdaptiveRefreshStateService refreshStateService;

    private AdaptivePathService adaptivePathService;
    private Map<String, Object> courseTree;
    private Map<String, Object> latestDiagnostic;
    private List<Map<String, Object>> learningStatuses;
    private List<Map<String, Object>> traces;
    private List<Map<String, Object>> labs;

    @BeforeEach
    void setUp() {
        adaptivePathService = new AdaptivePathService(restTemplate, new ObjectMapper(), refreshStateService);
        ReflectionTestUtils.setField(adaptivePathService, "graphServiceUrl", "http://graph");
        ReflectionTestUtils.setField(adaptivePathService, "trackingServiceUrl", "http://tracking");
        ReflectionTestUtils.setField(adaptivePathService, "mlServiceUrl", "http://ml");

        courseTree = tree(
                concept("variables", "Variables"),
                concept("conditions", "Conditions")
        );
        latestDiagnostic = diagnostic(List.of());
        learningStatuses = List.of();
        traces = List.of();
        labs = List.of();

        when(refreshStateService.persistentOrFallbackFreshness(LEARNER_EMAIL, COURSE_ID))
                .thenReturn(PathFreshnessDto.builder().refreshedAfterEvent(false).build());
        lenient().when(restTemplate.postForObject(anyString(), any(), eq(Map.class))).thenReturn(Map.of());

        stubServiceResponses();
    }

    @Test
    void returnsPassDiagnosticWithoutPrincipalConceptWhenDiagnosticIsAbsent() {
        latestDiagnostic = Map.of();
        learningStatuses = List.of(status("variables", "LEARNABLE", List.of()));

        AdaptivePathResponse response = adaptivePathService.buildPath(LEARNER_EMAIL, COURSE_ID);

        assertThat(response.getNextAction()).isEqualTo("PASS_DIAGNOSTIC");
        assertThat(response.getNextConcept()).isNull();
        assertThat(response.isDiagnosticPassed()).isFalse();
    }

    @Test
    void keepsMissingPrerequisiteConceptLockedAndExplainsItsState() {
        learningStatuses = List.of(
                status("variables", "LEARNABLE", List.of()),
                status("conditions", "BLOCKED", List.of("variables"))
        );

        AdaptivePathResponse response = adaptivePathService.buildPath(LEARNER_EMAIL, COURSE_ID);

        LearningPathStepDto lockedStep = step(response, "conditions");
        assertThat(lockedStep.getStatus()).isEqualTo("LOCKED");
        assertThat(lockedStep.getExplanationReasons())
                .isNotEmpty()
                .anyMatch(reason -> reason.toLowerCase().contains("verrouill"));
    }

    @Test
    void recommendsAccessibleConceptForLearning() {
        learningStatuses = List.of(status("variables", "LEARNABLE", List.of()));

        AdaptivePathResponse response = adaptivePathService.buildPath(LEARNER_EMAIL, COURSE_ID);

        assertThat(response.getNextAction()).isEqualTo("LEARN");
        assertThat(response.getNextConcept()).isNotNull();
        assertThat(response.getNextConcept().getConceptId()).isEqualTo("variables");
        assertThat(step(response, "variables").getStatus()).isEqualTo("READY");
    }

    @Test
    void movesDiagnosticKnowledgeGapToRemediation() {
        latestDiagnostic = diagnostic(List.of(
                Map.of("conceptId", "variables", "conceptName", "Variables", "mastered", false, "score", 35)
        ));
        learningStatuses = List.of(status("variables", "LEARNABLE", List.of()));

        AdaptivePathResponse response = adaptivePathService.buildPath(LEARNER_EMAIL, COURSE_ID);

        assertThat(response.getNextAction()).isEqualTo("REMEDIATION");
        assertThat(response.getNextConcept().getConceptId()).isEqualTo("variables");
        assertThat(response.getConceptsToReview()).extracting(AdaptiveConceptDto::getConceptId)
                .containsExactly("variables");
        assertThat(step(response, "variables").getStatus()).isEqualTo("TO_REVIEW");
    }

    @Test
    void returnsCompletedWhenEveryConceptIsMastered() {
        latestDiagnostic = diagnostic(List.of(
                Map.of("conceptId", "variables", "mastered", true, "score", 85),
                Map.of("conceptId", "conditions", "mastered", true, "score", 90)
        ));
        learningStatuses = List.of(
                status("variables", "MASTERED", List.of()),
                status("conditions", "MASTERED", List.of())
        );

        AdaptivePathResponse response = adaptivePathService.buildPath(LEARNER_EMAIL, COURSE_ID);

        assertThat(response.getNextAction()).isEqualTo("COMPLETED");
        assertThat(response.getNextConcept()).isNull();
        assertThat(response.getRecommendedLearningPath())
                .extracting(LearningPathStepDto::getStatus)
                .containsOnly("COMPLETED");
    }

    @Test
    void scoresAccessibleConceptHigherThanConceptWithMissingPrerequisiteAndKeepsScoresBounded() {
        learningStatuses = List.of(
                status("variables", "LEARNABLE", List.of()),
                status("conditions", "LEARNABLE", List.of("variables"))
        );

        AdaptivePathResponse response = adaptivePathService.buildPath(LEARNER_EMAIL, COURSE_ID);

        AdaptiveConceptDto accessible = conceptFrom(response.getLearnableConcepts(), "variables");
        AdaptiveConceptDto missingPrerequisite = conceptFrom(response.getLearnableConcepts(), "conditions");
        assertThat(accessible.getAdaptiveScore()).isBetween(0.0, 1.0);
        assertThat(missingPrerequisite.getAdaptiveScore()).isBetween(0.0, 1.0);
        assertThat(accessible.getAdaptiveScore()).isGreaterThan(missingPrerequisite.getAdaptiveScore());
    }

    @Test
    void providesAnExplanationForEveryStepInThePersonalizedPath() {
        latestDiagnostic = diagnostic(List.of(
                Map.of("conceptId", "variables", "conceptName", "Variables", "mastered", false, "score", 40)
        ));
        learningStatuses = List.of(
                status("variables", "LEARNABLE", List.of()),
                status("conditions", "BLOCKED", List.of("variables"))
        );

        AdaptivePathResponse response = adaptivePathService.buildPath(LEARNER_EMAIL, COURSE_ID);

        assertThat(response.getRecommendedLearningPath()).isNotEmpty();
        assertThat(response.getRecommendedLearningPath())
                .allSatisfy(step -> assertThat(step.getExplanationReasons()).isNotEmpty());
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private void stubServiceResponses() {
        lenient().doAnswer(invocation -> {
            String url = invocation.getArgument(0);
            if (url.contains("/api/graph/courses/") && url.endsWith("/tree")) {
                return ResponseEntity.ok(courseTree);
            }
            if (url.contains("/learning-status")) {
                return ResponseEntity.ok(learningStatuses);
            }
            if (url.contains("/api/traces/diagnostics/latest")) {
                return ResponseEntity.ok(latestDiagnostic);
            }
            if (url.contains("/api/traces/user/")) {
                return ResponseEntity.ok(traces);
            }
            if (url.contains("/api/labs/user/")) {
                return ResponseEntity.ok(labs);
            }
            throw new AssertionError("Unexpected GET request: " + url);
        }).when(restTemplate).exchange(
                anyString(),
                eq(HttpMethod.GET),
                isNull(),
                any(ParameterizedTypeReference.class)
        );
    }

    @SafeVarargs
    private final Map<String, Object> tree(Map<String, Object>... concepts) {
        return Map.of(
                "id", COURSE_ID,
                "title", "Java",
                "modules", List.of(Map.of(
                        "title", "Bases",
                        "chapitres", List.of(Map.of(
                                "title", "Introduction",
                                "concepts", List.of(concepts)
                        ))
                ))
        );
    }

    private Map<String, Object> concept(String id, String name) {
        return Map.of(
                "id", id,
                "labelPedagogique", name,
                "poidsCognitif", 1.0
        );
    }

    private Map<String, Object> diagnostic(List<Map<String, Object>> conceptResults) {
        return Map.of("conceptResults", conceptResults);
    }

    private Map<String, Object> status(String conceptId, String status, List<String> missingPrerequisiteIds) {
        return Map.of(
                "conceptId", conceptId,
                "courseId", COURSE_ID,
                "status", status,
                "missingPrerequisiteIds", missingPrerequisiteIds
        );
    }

    private LearningPathStepDto step(AdaptivePathResponse response, String conceptId) {
        return response.getRecommendedLearningPath().stream()
                .filter(candidate -> conceptId.equals(candidate.getConceptId()))
                .findFirst()
                .orElseThrow();
    }

    private AdaptiveConceptDto conceptFrom(List<AdaptiveConceptDto> concepts, String conceptId) {
        return concepts.stream()
                .filter(candidate -> conceptId.equals(candidate.getConceptId()))
                .findFirst()
                .orElseThrow();
    }
}
