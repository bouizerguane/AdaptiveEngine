package com.ale.graph.repository;

import com.ale.graph.domain.Course;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import java.util.List;
import java.util.Optional;

public interface CourseRepository extends Neo4jRepository<Course, String> {

    @Query("MATCH (c:Course {authorEmail: $authorEmail}) RETURN c")
    List<Course> findByAuthorEmail(String authorEmail);

    @Query("MATCH (c:Course {id: $courseId}) " +
           "OPTIONAL MATCH (c)-[:CONTAINS_MODULE|CONTAINS_CHAPITRE|CONTAINS_CONCEPT*0..3]->(node) " +
           "DETACH DELETE node")
    void deleteCourseCascade(String courseId);

    @Query("MATCH (c:Course {id: $courseId}) " +
           "OPTIONAL MATCH (c)-[r1:CONTAINS_MODULE]->(m:Module) " +
           "OPTIONAL MATCH (m)-[r2:CONTAINS_CHAPITRE]->(ch:Chapitre) " +
           "OPTIONAL MATCH (ch)-[r3:CONTAINS_CONCEPT]->(co:Concept) " +
           "OPTIONAL MATCH (co)-[r4:isPredecessorOf]->(targetCo:Concept) " +
           "WITH c, r1, m, r2, ch, r3, co, r4, targetCo " +
           "ORDER BY m.orderIndex, ch.orderIndex, co.orderIndex " +
           "RETURN c, collect(r1), collect(m), collect(r2), collect(ch), collect(r3), collect(co), collect(r4), collect(targetCo)")
    Optional<Course> findFullTree(String courseId);

    @Query("MATCH (m:Module) WHERE NOT (:Course)-[:CONTAINS_MODULE]->(m) AND m.authorEmail = $authorEmail RETURN m.id")
    List<String> findOrphanModuleIds(String authorEmail);

    @Query("MATCH (m:Module) WHERE NOT (:Course)-[:CONTAINS_MODULE]->(m) AND m.id = $moduleId RETURN m.id")
    List<String> findOrphanModuleIdsForCheck(String moduleId);

    @Query("MATCH (c:Course {id: $courseId}), (m:Module {id: $moduleId}) " +
           "MERGE (c)-[:CONTAINS_MODULE]->(m)")
    void attachModuleToCourse(String courseId, String moduleId);

    @Query("MATCH (m:Module {id: $moduleId}) SET m.orderIndex = $index")
    void updateModuleOrder(String moduleId, int index);

    @Query("UNWIND $positions AS pos MATCH (n) WHERE n.id = pos.id SET n.posX = pos.x, n.posY = pos.y")
    void updateNodePositions(List<java.util.Map<String, Object>> positions);
}
