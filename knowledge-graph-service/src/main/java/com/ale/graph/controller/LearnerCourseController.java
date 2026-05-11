package com.ale.graph.controller;

import com.ale.graph.dto.CourseSummaryDto;
import com.ale.graph.dto.EnrollmentRequest;
import com.ale.graph.service.CourseEnrollmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/graph/courses")
@RequiredArgsConstructor
@Slf4j
public class LearnerCourseController {

    private final CourseEnrollmentService enrollmentService;

    @GetMapping("/available")
    public ResponseEntity<List<CourseSummaryDto>> getAvailableCourses() {
        return ResponseEntity.ok(enrollmentService.getAvailableCourses());
    }

    @GetMapping("/search")
    public ResponseEntity<List<CourseSummaryDto>> searchCourses(@RequestParam(required = false) String query) {
        return ResponseEntity.ok(enrollmentService.searchCourses(query));
    }

    @PostMapping("/{courseId}/enroll")
    public ResponseEntity<?> enroll(
            @PathVariable String courseId,
            @RequestBody EnrollmentRequest request,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        log.info("[LearnerCourseController] enroll courseId={}, userEmail={}, userRole={}, bodyLearnerEmail={}",
                courseId, userEmail, userRole, request == null ? null : request.getLearnerEmail());
        if (hasGatewayRole(userRole) && !isStudent(userRole)) {
            log.warn("[LearnerCourseController] enroll refused role={}", userRole);
            return ResponseEntity.status(403).body(Map.of("message", "Role STUDENT requis pour s'inscrire a un cours."));
        }
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Body inscription obligatoire."));
        }
        String learnerEmail = firstNonBlank(userEmail, request.getLearnerEmail());
        if (learnerEmail == null) {
            log.warn("[LearnerCourseController] enroll failed: missing learnerEmail");
            return ResponseEntity.badRequest().body(Map.of("message", "learnerEmail est obligatoire."));
        }

        boolean enrolled = enrollmentService.enroll(courseId, learnerEmail, request.getNom(), request.getPrenom());
        if (!enrolled) {
            log.warn("[LearnerCourseController] enroll failed: course not found or unpublished, courseId={}", courseId);
            return ResponseEntity.status(404).body(Map.of("message", "Cours introuvable ou non publie."));
        }

        return ResponseEntity.ok(Map.of("message", "Inscription au cours enregistrée."));
    }

    @GetMapping("/enrolled/{learnerEmail}")
    public ResponseEntity<List<CourseSummaryDto>> getEnrolledCourses(
            @PathVariable String learnerEmail,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        String effectiveEmail = isAdminOrTeacher(userRole) ? learnerEmail : firstNonBlank(userEmail, learnerEmail);
        return ResponseEntity.ok(enrollmentService.getEnrolledCourses(effectiveEmail));
    }

    @GetMapping("/{courseId}/learning-status")
    public ResponseEntity<List<Map<String, Object>>> getLearningStatus(
            @PathVariable String courseId,
            @RequestParam String learnerEmail,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole
    ) {
        String effectiveEmail = isAdminOrTeacher(userRole) ? learnerEmail : firstNonBlank(userEmail, learnerEmail);
        return ResponseEntity.ok(enrollmentService.getLearningStatuses(effectiveEmail, courseId));
    }

    @GetMapping("/{courseId}/enrollments")
    public ResponseEntity<?> getCourseEnrollments(
            @PathVariable String courseId,
            @RequestParam(required = false) String teacherEmail,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole
    ) {
        String effectiveTeacherEmail = isAdminOrTeacher(userRole) ? firstNonBlank(userEmail, teacherEmail) : teacherEmail;
        if (!isAdmin(userRole) && !enrollmentService.courseBelongsToTeacher(courseId, effectiveTeacherEmail)) {
            return ResponseEntity.status(403).body(Map.of("message", "Ce cours n'appartient pas a cet enseignant."));
        }
        return ResponseEntity.ok(enrollmentService.getCourseEnrollments(courseId));
    }

    @DeleteMapping("/{courseId}/enrollments/{learnerEmail}")
    public ResponseEntity<?> unenrollLearner(
            @PathVariable String courseId,
            @PathVariable String learnerEmail,
            @RequestParam(required = false) String teacherEmail,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String userRole
    ) {
        String effectiveTeacherEmail = isAdminOrTeacher(userRole) ? firstNonBlank(userEmail, teacherEmail) : teacherEmail;
        if (!isAdmin(userRole) && !enrollmentService.courseBelongsToTeacher(courseId, effectiveTeacherEmail)) {
            return ResponseEntity.status(403).body(Map.of("message", "Ce cours n'appartient pas a cet enseignant."));
        }

        boolean deleted = enrollmentService.unenrollLearner(courseId, learnerEmail);
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("message", "Inscription introuvable."));
        }

        return ResponseEntity.ok(Map.of("message", "Apprenant desinscrit du cours."));
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank() && !"anonymousUser".equals(value)) return value;
        }
        return null;
    }

    private boolean isAdmin(String role) {
        return "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }

    private boolean isAdminOrTeacher(String role) {
        return isAdmin(role) || "ROLE_TEACHER".equals(role) || "TEACHER".equals(role);
    }

    private boolean hasGatewayRole(String role) {
        return role != null && !role.isBlank();
    }

    private boolean isStudent(String role) {
        return "ROLE_STUDENT".equals(role) || "STUDENT".equals(role)
                || "ROLE_LEARNER".equals(role) || "LEARNER".equals(role);
    }
}
