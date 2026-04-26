package com.ale.tracking.controller;

import com.ale.tracking.domain.LabSubmission;
import com.ale.tracking.domain.TeacherDashboardSummaryDto;
import com.ale.tracking.domain.TraceApprentissage;
import com.ale.tracking.repository.LabSubmissionRepository;
import com.ale.tracking.repository.TraceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tracking/dashboard")
@RequiredArgsConstructor
public class TeacherDashboardController {

    private final TraceRepository traceRepository;
    private final LabSubmissionRepository labSubmissionRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @GetMapping("/summary")
    public ResponseEntity<TeacherDashboardSummaryDto> getSummary(@RequestParam String teacherEmail) {
        
        // 1. Récupérer les cours de l'enseignant via knowledge-graph-service
        String coursesUrl = "http://knowledge-graph-service/api/graph/courses/teacher/" + teacherEmail;
        List<Map<String, Object>> courses = new ArrayList<>();
        try {
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    coursesUrl, HttpMethod.GET, null, new ParameterizedTypeReference<>() {}
            );
            if (response.getBody() != null) courses = response.getBody();
        } catch (Exception e) {
            // Service potentiellement indisponible ou aucun cours
        }

        List<String> courseIds = courses.stream()
                .map(c -> (String) c.get("id"))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        // 2. Récupérer la maîtrise via knowledge-graph-service
        String masteryUrl = "http://knowledge-graph-service/api/graph/mastery/teacher/" + teacherEmail;
        List<Map<String, Object>> masteryData = new ArrayList<>();
        try {
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    masteryUrl, HttpMethod.GET, null, new ParameterizedTypeReference<>() {}
            );
            if (response.getBody() != null) masteryData = response.getBody();
        } catch (Exception e) {
            // Ignorer
        }

        if (courseIds.isEmpty()) {
            return ResponseEntity.ok(TeacherDashboardSummaryDto.builder()
                    .activeStudents(0)
                    .avgSuccessRate(0.0)
                    .completedLabs(0)
                    .topDifficultConcepts(Collections.emptyList())
                    .recentLabSubmissions(Collections.emptyList())
                    .masteryByModule(masteryData)
                    .build());
        }

        // 3. Requêtes BDD
        List<TraceApprentissage> traces = traceRepository.findByCourseIdIn(courseIds);
        List<LabSubmission> labs = labSubmissionRepository.findByCourseIdInAndIsTeacherTestFalse(courseIds);

        // 4. Calculs KPIs
        Set<String> uniqueStudents = new HashSet<>();
        traces.forEach(t -> { if (t.getUserId() != null) uniqueStudents.add(t.getUserId()); });
        labs.forEach(l -> { if (l.getUserId() != null) uniqueStudents.add(l.getUserId()); });
        int activeStudents = uniqueStudents.size();

        double avgSuccessRate = traces.stream()
                .mapToDouble(TraceApprentissage::getScoreObtenu)
                .average()
                .orElse(0.0);

        List<LabSubmission> completedLabsList = labs.stream()
                .filter(l -> l.getStatus() == LabSubmission.LabStatus.COMPLETED)
                .collect(Collectors.toList());
        int completedLabs = completedLabsList.size();

        // 5. Point Chaud (Top 5 concepts difficiles)
        // Regrouper par targetId (où targetType == CONCEPT)
        Map<String, List<TraceApprentissage>> conceptTraces = traces.stream()
                .filter(t -> "CONCEPT".equals(t.getTargetType()))
                .collect(Collectors.groupingBy(TraceApprentissage::getTargetId));

        List<TeacherDashboardSummaryDto.ConceptDifficulty> difficultConcepts = conceptTraces.entrySet().stream()
                .map(entry -> {
                    String conceptId = entry.getKey();
                    List<TraceApprentissage> list = entry.getValue();
                    double avgScore = list.stream().mapToDouble(TraceApprentissage::getScoreObtenu).average().orElse(0.0);
                    double avgTime = list.stream().mapToDouble(TraceApprentissage::getTempsConsultation).average().orElse(0.0);
                    return TeacherDashboardSummaryDto.ConceptDifficulty.builder()
                            .conceptId(conceptId)
                            .avgScore(avgScore)
                            .avgTimeSpent(avgTime)
                            .build();
                })
                .sorted(Comparator.comparingDouble(TeacherDashboardSummaryDto.ConceptDifficulty::getAvgScore)) // Plus bas score d'abord
                .limit(5)
                .collect(Collectors.toList());

        // 6. 10 dernières soumissions TP
        List<TeacherDashboardSummaryDto.LabActivity> recentSubmissions = completedLabsList.stream()
                .sorted((l1, l2) -> l2.getCompletedAt().compareTo(l1.getCompletedAt()))
                .limit(10)
                .map(l -> {
                    long totalTime = 0;
                    if (l.getTimeSpentPerStep() != null && !l.getTimeSpentPerStep().isEmpty()) {
                        try {
                            Map<String, Integer> timeMap = objectMapper.readValue(l.getTimeSpentPerStep(), new TypeReference<>() {});
                            totalTime = timeMap.values().stream().mapToLong(Integer::longValue).sum();
                        } catch (Exception ignored) {}
                    }
                    return TeacherDashboardSummaryDto.LabActivity.builder()
                            .userId(l.getUserId())
                            .labId(l.getLabId())
                            .githubRepoUrl(l.getGithubRepoUrl())
                            .completedAt(l.getCompletedAt())
                            .totalTimeSpent(totalTime)
                            .build();
                })
                .collect(Collectors.toList());

        TeacherDashboardSummaryDto dto = TeacherDashboardSummaryDto.builder()
                .activeStudents(activeStudents)
                .avgSuccessRate(avgSuccessRate)
                .completedLabs(completedLabs)
                .topDifficultConcepts(difficultConcepts)
                .recentLabSubmissions(recentSubmissions)
                .masteryByModule(masteryData)
                .build();

        return ResponseEntity.ok(dto);
    }
}
