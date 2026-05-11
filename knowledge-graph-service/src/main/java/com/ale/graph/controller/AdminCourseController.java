package com.ale.graph.controller;

import com.ale.graph.dto.BulkCourseDeleteRequest;
import com.ale.graph.domain.Course;
import com.ale.graph.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/graph/admin/courses")
@RequiredArgsConstructor
public class AdminCourseController {

    private final CourseRepository courseRepository;
    private final RestTemplate restTemplate;

    @GetMapping
    public ResponseEntity<?> getAllCourses(@RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (!isAdmin(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "ADMIN requis."));
        }
        return ResponseEntity.ok(courseRepository.findAllCourses());
    }

    @DeleteMapping("/bulk")
    public ResponseEntity<Map<String, Object>> deleteSelectedCourses(
            @RequestBody BulkCourseDeleteRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (!isAdmin(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "ADMIN requis."));
        }
        List<String> courseIds = clean(request.getCourseIds());
        if (courseIds.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "courseIds est obligatoire."));
        }

        long deletedCourses = courseRepository.countByIdIn(courseIds);
        List<String> conceptIds = courseRepository.findConceptIdsByCourseIds(courseIds);

        Map<String, Object> contentSummary;
        try {
            contentSummary = cleanupContent(courseIds, conceptIds);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "error", "Nettoyage MongoDB impossible. Les cours Neo4j n'ont pas ete supprimes.",
                    "details", ex.getMessage()
            ));
        }

        courseRepository.deleteCoursesByIdsCascade(courseIds);
        return ResponseEntity.ok(Map.of(
                "deletedCourses", deletedCourses,
                "deletedContents", numberValue(contentSummary.get("deletedContents")),
                "deletedEvaluations", numberValue(contentSummary.get("deletedEvaluations")),
                "deletedLabs", numberValue(contentSummary.get("deletedLabs")),
                "message", "Cours selectionnes supprimes."
        ));
    }

    private Map<String, Object> cleanupContent(List<String> courseIds, List<String> conceptIds) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(Map.of(
                "courseIds", courseIds,
                "conceptIds", clean(conceptIds)
        ), headers);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "http://content-service/api/content/admin/courses",
                HttpMethod.DELETE,
                entity,
                new ParameterizedTypeReference<>() {}
        );
        return response.getBody() == null ? Map.of() : response.getBody();
    }

    private List<String> clean(List<String> ids) {
        if (ids == null) return List.of();
        return ids.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
    }

    private long numberValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        return 0L;
    }

    private boolean isAdmin(String role) {
        return "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }
}
