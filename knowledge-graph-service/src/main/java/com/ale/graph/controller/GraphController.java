package com.ale.graph.controller;

import com.ale.graph.domain.Chapitre;
import com.ale.graph.domain.Concept;
import com.ale.graph.domain.ModuleEntity;
import com.ale.graph.repository.ChapitreRepository;
import com.ale.graph.repository.ConceptRepository;
import com.ale.graph.repository.ModuleRepository;
import com.ale.graph.domain.Course;
import com.ale.graph.repository.CourseRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.ale.graph.dto.NodePositionDto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/graph")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Knowledge Graph", description = "Course graph, modules, chapters, concepts and prerequisite relations.")
public class GraphController {

    private final CourseRepository courseRepository;
    private final ModuleRepository moduleRepository;
    private final ChapitreRepository chapitreRepository;
    private final ConceptRepository conceptRepository;
    private final Neo4jClient neo4jClient;

    // ==========================================
    // GLOBAL GRAPH
    // ==========================================
    @PutMapping("/nodes/positions")
    @Operation(summary = "Update graph node positions", responses = {
            @ApiResponse(responseCode = "200", description = "Node positions updated")
    })
    public ResponseEntity<?> updateNodePositions(@RequestBody List<NodePositionDto> positions) {
        List<Map<String, Object>> posMaps = positions.stream()
                .map(p -> Map.<String, Object>of("id", p.getId(), "x", p.getX(), "y", p.getY()))
                .collect(java.util.stream.Collectors.toList());
        courseRepository.updateNodePositions(posMaps);
        return ResponseEntity.ok(Map.of("message", "Positions mises à jour avec succès."));
    }

    // ==========================================
    // COURSES
    // ==========================================

    @GetMapping("/courses")
    @Operation(summary = "List courses", responses = {
            @ApiResponse(responseCode = "200", description = "Courses returned")
    })
    public Iterable<Course> getCourses(@Parameter(hidden = true) @AuthenticationPrincipal String authorEmail) {
        return courseRepository.findAllCourses();
    }

    @GetMapping("/courses/teacher/{email}")
    @Operation(summary = "List courses by teacher email")
    public Iterable<Course> getCoursesByTeacherEmail(
            @Parameter(description = "Teacher email") @PathVariable String email,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        String effectiveEmail = isAdmin(userRole) ? email : firstNonBlank(userEmail, email);
        return courseRepository.findByAuthorEmail(effectiveEmail);
    }

    @PostMapping("/courses")
    @Operation(summary = "Create a course")
    public Course createCourse(
            @RequestBody Course course,
            @Parameter(hidden = true) @AuthenticationPrincipal String authorEmail,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        if (course.getId() == null) course.setId(UUID.randomUUID().toString());
        if (course.getCreatedAt() == null) course.setCreatedAt(LocalDateTime.now());
        if (course.getStatus() == null || course.getStatus().isBlank()) course.setStatus("PUBLISHED");
        String requestAuthorEmail = course.getAuthorEmail();
        String resolvedAuthorEmail = isValidAuthor(userEmail)
                ? userEmail
                : isValidAuthor(authorEmail) ? authorEmail : isValidAuthor(requestAuthorEmail) ? requestAuthorEmail : null;
        course.setAuthorEmail(resolvedAuthorEmail);
        if (course.getAuthorName() != null && course.getAuthorName().isBlank()) {
            course.setAuthorName(null);
        }
        Course saved = courseRepository.save(course);
        log.info("Course created with authorEmail: {}", saved.getAuthorEmail());
        return saved;
    }

    private boolean isValidAuthor(String email) {
        return email != null && !email.isBlank() && !"anonymousUser".equals(email);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (isValidAuthor(value)) return value;
        }
        return null;
    }

    private boolean isAdmin(String role) {
        return "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }

    @PutMapping("/courses/{id}")
    @Operation(summary = "Update a course")
    public ResponseEntity<Course> updateCourse(@PathVariable String id, @RequestBody Course updated) {
        return courseRepository.findById(id).map(course -> {
            course.setTitle(updated.getTitle());
            course.setDescription(updated.getDescription());
            course.setObjectifs(updated.getObjectifs());
            course.setPrerequisTextuels(updated.getPrerequisTextuels());
            if (updated.getStatus() != null && !updated.getStatus().isBlank()) {
                course.setStatus(updated.getStatus());
            }
            return ResponseEntity.ok(courseRepository.save(course));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/courses/{id}")
    @Operation(summary = "Delete a course and its graph hierarchy")
    public ResponseEntity<?> deleteCourse(@PathVariable String id) {
        courseRepository.deleteCourseCascade(id);
        return ResponseEntity.ok(Map.of("message", "Le cours et toute sa hiérarchie ont été supprimés."));
    }

    @GetMapping("/courses/{id}/tree")
    @Operation(summary = "Get full course graph tree")
    public ResponseEntity<Course> getCourseTree(@PathVariable String id) {
        return courseRepository.findFullTree(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/courses/{id}/prerequisite-concepts")
    @Operation(summary = "List external prerequisite concepts for a course")
    public ResponseEntity<List<Map<String, Object>>> getExternalPrerequisiteConcepts(@PathVariable String id) {
        String cypher = """
            MATCH (c:Course {id: $courseId})-[:CONTAINS_MODULE]->(:Module)-[:CONTAINS_CHAPITRE]->(:Chapitre)-[:CONTAINS_CONCEPT]->(co:Concept)
            MATCH (pre:Concept)-[:isPredecessorOf]->(co)
            WHERE NOT EXISTS {
                MATCH (c)-[:CONTAINS_MODULE]->(:Module)-[:CONTAINS_CHAPITRE]->(:Chapitre)-[:CONTAINS_CONCEPT]->(pre)
            }
            RETURN DISTINCT pre.id AS id,
                   pre.labelPedagogique AS labelPedagogique,
                   pre.description AS description
            ORDER BY labelPedagogique
            """;
        return ResponseEntity.ok(new java.util.ArrayList<>(neo4jClient.query(cypher)
                .bindAll(Map.of("courseId", id))
                .fetch()
                .all()));
    }

    // ==========================================
    // MODULES
    // ==========================================

    @GetMapping("/modules")
    @Operation(summary = "List modules")
    public Iterable<ModuleEntity> getModules(@Parameter(hidden = true) @AuthenticationPrincipal String authorEmail) {
        if (authorEmail != null) {
            return moduleRepository.findByAuthorEmail(authorEmail);
        }
        return moduleRepository.findAll();
    }

    @PostMapping("/modules")
    @Operation(summary = "Create a module and attach it to a course")
    public ResponseEntity<?> createModule(@RequestBody ModuleEntity module, 
                                          @RequestParam(required = true) String courseId,
                                          @Parameter(hidden = true) @AuthenticationPrincipal String authorEmail,
                                          @Parameter(hidden = true) @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        if (courseId == null || courseId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "courseId est obligatoire pour créer un module."));
        }
        if (module.getId() == null) module.setId(UUID.randomUUID().toString());
        String resolvedAuthorEmail = isValidAuthor(userEmail)
                ? userEmail
                : isValidAuthor(authorEmail) ? authorEmail : courseRepository.findById(courseId).map(Course::getAuthorEmail).orElse(null);
        module.setAuthorEmail(resolvedAuthorEmail);
        
        ModuleEntity saved = moduleRepository.save(module);
        courseRepository.attachModuleToCourse(courseId, saved.getId());
        
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/modules/{id}")
    public ResponseEntity<ModuleEntity> updateModule(@PathVariable String id, @RequestBody ModuleEntity updated) {
        return moduleRepository.findById(id).map(module -> {
            module.setTitle(updated.getTitle());
            return ResponseEntity.ok(moduleRepository.save(module));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/modules/{id}")
    public ResponseEntity<?> deleteModule(@PathVariable String id) {
        moduleRepository.deleteModuleCascade(id);
        return ResponseEntity.ok(Map.of("message", "Module et son contenu ont été supprimés en cascade."));
    }

    @PutMapping("/modules/reorder")
    public ResponseEntity<?> reorderModules(@RequestBody List<String> ids) {
        for (int i = 0; i < ids.size(); i++) {
            courseRepository.updateModuleOrder(ids.get(i), i);
        }
        return ResponseEntity.ok(Map.of("message", "Ordre des modules mis à jour."));
    }

    // ==========================================
    // CHAPITRES
    // ==========================================
    @PostMapping("/modules/{moduleId}/chapitres")
    public ResponseEntity<Chapitre> createChapitre(@PathVariable String moduleId, @RequestBody Chapitre chapitre) {
        ModuleEntity module = moduleRepository.findById(moduleId).orElseThrow(() -> new RuntimeException("Module not found"));
        if (chapitre.getId() == null) chapitre.setId(UUID.randomUUID().toString());
        
        chapitre = chapitreRepository.save(chapitre);
        module.getChapitres().add(chapitre);
        moduleRepository.save(module); // Met à jour la relation CONTAINS_CHAPITRE
        
        return ResponseEntity.ok(chapitre);
    }

    @PutMapping("/chapitres/{id}")
    public ResponseEntity<Chapitre> updateChapitre(@PathVariable String id, @RequestBody Chapitre updated) {
        return chapitreRepository.findById(id).map(chap -> {
            chap.setTitle(updated.getTitle());
            return ResponseEntity.ok(chapitreRepository.save(chap));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/chapitres/{id}")
    public ResponseEntity<?> deleteChapitre(@PathVariable String id) {
        chapitreRepository.deleteChapitreCascade(id);
        return ResponseEntity.ok(Map.of("message", "Chapitre et ses concepts supprimés en cascade."));
    }

    @PutMapping("/chapitres/reorder")
    public ResponseEntity<?> reorderChapitres(@RequestBody List<String> ids) {
        for (int i = 0; i < ids.size(); i++) {
            chapitreRepository.updateChapitreOrder(ids.get(i), i);
        }
        return ResponseEntity.ok(Map.of("message", "Ordre des chapitres mis à jour."));
    }

    // ==========================================
    // CONCEPTS (GRAPHE)
    // ==========================================
    @GetMapping("/concepts")
    @Operation(summary = "List all concepts")
    public Iterable<Concept> getAllConcepts() {
        return conceptRepository.findAll();
    }

    @GetMapping("/concepts/{conceptId}/context")
    @Operation(summary = "Get concept context and owning course")
    public ResponseEntity<?> getConceptContext(
            @PathVariable String conceptId,
            @RequestParam(required = false) String currentCourseId) {
        String cypher = """
            MATCH (co:Concept {id: $conceptId})
            OPTIONAL MATCH (course:Course)-[:CONTAINS_MODULE]->(:Module)-[:CONTAINS_CHAPITRE]->(:Chapitre)-[:CONTAINS_CONCEPT]->(co)
            RETURN co.id AS conceptId,
                   co.labelPedagogique AS conceptName,
                   co.description AS description,
                   course.id AS courseId,
                   course.title AS courseTitle,
                   CASE WHEN course.id IS NOT NULL AND course.id = $currentCourseId THEN true ELSE false END AS isInCurrentCourse
            LIMIT 1
            """;
        return neo4jClient.query(cypher)
                .bindAll(Map.of(
                        "conceptId", conceptId,
                        "currentCourseId", currentCourseId == null ? "" : currentCourseId
                ))
                .fetch()
                .one()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/chapitres/{chapitreId}/concepts")
    @Operation(summary = "Create a concept inside a chapter")
    public ResponseEntity<Concept> createConceptInChapitre(@PathVariable String chapitreId, @RequestBody Concept concept) {
        Chapitre chapitre = chapitreRepository.findById(chapitreId).orElseThrow(() -> new RuntimeException("Chapitre not found"));
        if (concept.getId() == null) concept.setId(UUID.randomUUID().toString());
        
        concept = conceptRepository.save(concept);
        chapitre.getConcepts().add(concept);
        chapitreRepository.save(chapitre); // Met à jour relation CONTAINS_CONCEPT
        
        return ResponseEntity.ok(concept);
    }

    @PutMapping("/concepts/{id}")
    public ResponseEntity<Concept> updateConcept(@PathVariable String id, @RequestBody Concept updated) {
        return conceptRepository.findById(id).map(concept -> {
            concept.setLabelPedagogique(updated.getLabelPedagogique());
            concept.setPoidsCognitif(updated.getPoidsCognitif());
            concept.setEstVerrouille(updated.getEstVerrouille());
            return ResponseEntity.ok(conceptRepository.save(concept));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/concepts/{id}")
    public ResponseEntity<?> deleteConcept(@PathVariable String id) {
        // Neo4jRepository deleteById applique un DETACH DELETE par défaut (supprime les relations proprement)
        conceptRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Concept supprimé."));
    }

    @PutMapping("/concepts/reorder")
    public ResponseEntity<?> reorderConcepts(@RequestBody List<String> ids) {
        for (int i = 0; i < ids.size(); i++) {
            conceptRepository.updateConceptOrder(ids.get(i), i);
        }
        return ResponseEntity.ok(Map.of("message", "Ordre des concepts mis à jour."));
    }

    // ==========================================
    // RELATIONS (EXIGENCES)
    // ==========================================
    @PostMapping("/concepts/{sourceId}/exige/{targetId}")
    @Operation(summary = "Create prerequisite relation between concepts")
    public ResponseEntity<?> addExigence(@PathVariable String sourceId, @PathVariable String targetId) {
        if (!conceptRepository.isDagValid(sourceId, targetId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "L'ajout de ce lien crée un cycle inattendu (DAG Invalide)."));
        }
        
        conceptRepository.addExigenceEdge(sourceId, targetId);
        
        return ResponseEntity.ok(Map.of("message", "Lien de dépendance créé avec succès."));
    }

    @DeleteMapping("/concepts/{sourceId}/exige/{targetId}")
    @Operation(summary = "Remove prerequisite relation between concepts")
    public ResponseEntity<?> removeExigence(@PathVariable String sourceId, @PathVariable String targetId) {
        conceptRepository.removeExigence(sourceId, targetId);
        return ResponseEntity.ok(Map.of("message", "Lien de dépendance supprimé."));
    }
}
