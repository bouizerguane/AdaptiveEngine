package com.ale.tracking.domain;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class TeacherDashboardSummaryDto {
    private int activeStudents;
    private double avgSuccessRate;
    private int completedLabs;
    private List<ConceptDifficulty> topDifficultConcepts;
    private List<LabActivity> recentLabSubmissions;
    private List<Map<String, Object>> masteryByModule;

    @Data
    @Builder
    public static class ConceptDifficulty {
        private String conceptId;
        private double avgScore;
        private double avgTimeSpent; // Temps moyen passé
    }

    @Data
    @Builder
    public static class LabActivity {
        private String userId;
        private String labId;
        private String githubRepoUrl;
        private long totalTimeSpent;
        private LocalDateTime completedAt;
    }
}
