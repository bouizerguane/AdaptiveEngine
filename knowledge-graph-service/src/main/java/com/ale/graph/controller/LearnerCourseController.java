package com.ale.graph.controller;

import com.ale.graph.dto.CourseSummaryDto;
import com.ale.graph.dto.EnrollmentRequest;
import com.ale.graph.service.CourseEnrollmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/graph/courses")
@RequiredArgsConstructor
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
    public ResponseEntity<?> enroll(@PathVariable String courseId, @RequestBody EnrollmentRequest request) {
        if (request.getLearnerEmail() == null || request.getLearnerEmail().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "learnerEmail est obligatoire."));
        }

        boolean enrolled = enrollmentService.enroll(courseId, request.getLearnerEmail());
        if (!enrolled) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of("message", "Inscription au cours enregistrée."));
    }

    @GetMapping("/enrolled/{learnerEmail}")
    public ResponseEntity<List<CourseSummaryDto>> getEnrolledCourses(@PathVariable String learnerEmail) {
        return ResponseEntity.ok(enrollmentService.getEnrolledCourses(learnerEmail));
    }
}
