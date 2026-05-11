package com.ale.content.controller;

import com.ale.content.dto.CourseCleanupRequest;
import com.ale.content.repository.CourseContentRepository;
import com.ale.content.repository.EvaluationRepository;
import com.ale.content.repository.LabRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/content/admin")
@RequiredArgsConstructor
public class AdminContentController {

    private final CourseContentRepository contentRepository;
    private final EvaluationRepository evaluationRepository;
    private final LabRepository labRepository;

    @DeleteMapping("/courses")
    public ResponseEntity<Map<String, Object>> deleteCourseContent(
            @RequestBody CourseCleanupRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (userRole != null && !userRole.isBlank() && !isAdmin(userRole)) {
            return ResponseEntity.status(403).body(Map.of("error", "ADMIN requis."));
        }
        List<String> courseIds = clean(request.getCourseIds());
        List<String> conceptIds = clean(request.getConceptIds());

        long deletedContents = conceptIds.isEmpty() ? 0 : contentRepository.deleteByConceptIdIn(conceptIds);
        long deletedCourseEvaluations = courseIds.isEmpty() ? 0 : evaluationRepository.deleteByCourseIdIn(courseIds);
        long deletedConceptEvaluations = conceptIds.isEmpty() ? 0 : evaluationRepository.deleteByTargetIdIn(conceptIds);
        long deletedLabs = courseIds.isEmpty() ? 0 : labRepository.deleteByCourseIdIn(courseIds);

        return ResponseEntity.ok(Map.of(
                "deletedContents", deletedContents,
                "deletedEvaluations", deletedCourseEvaluations + deletedConceptEvaluations,
                "deletedLabs", deletedLabs
        ));
    }

    private List<String> clean(List<String> ids) {
        if (ids == null) return List.of();
        return ids.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
    }

    private boolean isAdmin(String role) {
        return "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }
}
