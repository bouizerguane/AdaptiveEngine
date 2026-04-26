package com.ale.graph.controller;

import com.ale.graph.domain.Chapitre;
import com.ale.graph.domain.Concept;
import com.ale.graph.domain.ModuleEntity;
import com.ale.graph.repository.ChapitreRepository;
import com.ale.graph.repository.ConceptRepository;
import com.ale.graph.repository.ModuleRepository;
import com.ale.graph.domain.Course;
import com.ale.graph.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
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
public class GraphController {

    private final CourseRepository courseRepository;
    private final ModuleRepository moduleRepository;
    private final ChapitreRepository chapitreRepository;
    private final ConceptRepository conceptRepository;

    // ==========================================
    // GLOBAL GRAPH
    // ==========================================
    @PutMapping("/nodes/positions")
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
    public Iterable<Course> getCourses(@AuthenticationPrincipal String authorEmail) {
        if (authorEmail != null) {
            return courseRepository.findByAuthorEmail(authorEmail);
        }
        return courseRepository.findAll();
    }

    @GetMapping("/courses/teacher/{email}")
    public Iterable<Course> getCoursesByTeacherEmail(@PathVariable String email) {
        return courseRepository.findByAuthorEmail(email);
    }

    @PostMapping("/courses")
    public Course createCourse(@RequestBody Course course, @AuthenticationPrincipal String authorEmail) {
        if (course.getId() == null) course.setId(UUID.randomUUID().toString());
        if (course.getCreatedAt() == null) course.setCreatedAt(LocalDateTime.now());
        if (course.getStatus() == null || course.getStatus().isBlank()) course.setStatus("PUBLISHED");
        course.setAuthorEmail(authorEmail);
        return courseRepository.save(course);
    }

    @PutMapping("/courses/{id}")
    public ResponseEntity<Course> updateCourse(@PathVariable String id, @RequestBody Course updated) {
        return courseRepository.findById(id).map(course -> {
            course.setTitle(updated.getTitle());
            course.setDescription(updated.getDescription());
            if (updated.getStatus() != null && !updated.getStatus().isBlank()) {
                course.setStatus(updated.getStatus());
            }
            return ResponseEntity.ok(courseRepository.save(course));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/courses/{id}")
    public ResponseEntity<?> deleteCourse(@PathVariable String id) {
        courseRepository.deleteCourseCascade(id);
        return ResponseEntity.ok(Map.of("message", "Le cours et toute sa hiérarchie ont été supprimés."));
    }

    @GetMapping("/courses/{id}/tree")
    public ResponseEntity<Course> getCourseTree(@PathVariable String id) {
        return courseRepository.findFullTree(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ==========================================
    // MODULES
    // ==========================================

    @GetMapping("/modules")
    public Iterable<ModuleEntity> getModules(@AuthenticationPrincipal String authorEmail) {
        if (authorEmail != null) {
            return moduleRepository.findByAuthorEmail(authorEmail);
        }
        return moduleRepository.findAll();
    }

    @PostMapping("/modules")
    public ResponseEntity<?> createModule(@RequestBody ModuleEntity module, 
                                          @RequestParam(required = true) String courseId,
                                          @AuthenticationPrincipal String authorEmail) {
        if (courseId == null || courseId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "courseId est obligatoire pour créer un module."));
        }
        if (module.getId() == null) module.setId(UUID.randomUUID().toString());
        module.setAuthorEmail(authorEmail);
        
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
    public Iterable<Concept> getAllConcepts() {
        return conceptRepository.findAll();
    }

    @PostMapping("/chapitres/{chapitreId}/concepts")
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
    public ResponseEntity<?> addExigence(@PathVariable String sourceId, @PathVariable String targetId) {
        if (!conceptRepository.isDagValid(sourceId, targetId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "L'ajout de ce lien crée un cycle inattendu (DAG Invalide)."));
        }
        
        conceptRepository.addExigenceEdge(sourceId, targetId);
        
        return ResponseEntity.ok(Map.of("message", "Lien de dépendance créé avec succès."));
    }

    @DeleteMapping("/concepts/{sourceId}/exige/{targetId}")
    public ResponseEntity<?> removeExigence(@PathVariable String sourceId, @PathVariable String targetId) {
        conceptRepository.removeExigence(sourceId, targetId);
        return ResponseEntity.ok(Map.of("message", "Lien de dépendance supprimé."));
    }
}
