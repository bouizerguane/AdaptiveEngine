package com.ale.graph.repository;

import com.ale.graph.domain.ModuleEntity;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import java.util.List;

public interface ModuleRepository extends Neo4jRepository<ModuleEntity, String> {

    @Query("MATCH (m:Module {authorEmail: $authorEmail}) " +
           "OPTIONAL MATCH (m)-[r1:CONTAINS_CHAPITRE]->(c:Chapitre) " +
           "OPTIONAL MATCH (c)-[r2:CONTAINS_CONCEPT]->(con:Concept) " +
           "OPTIONAL MATCH (con)-[r3:isPredecessorOf]->(targetCon:Concept) " +
           "RETURN m, collect(r1), collect(c), collect(r2), collect(con), collect(r3), collect(targetCon)")
    List<ModuleEntity> findByAuthorEmail(String authorEmail);

    @Query("MATCH (m:Module {id: $moduleId})-[r:CONTAINS_CHAPITRE]->(c:Chapitre) RETURN m, collect(r), collect(c)")
    ModuleEntity findModuleWithChapitres(String moduleId);

    // Suppression en cascade puissante : Supprime le Module, puis navigue via CONTAINS_CHAPITRE et CONTAINS_CONCEPT
    // pour détacher et supprimer tout le sous-graphe associé (Chapitres et Concepts).
    @Query("MATCH (m:Module {id: $moduleId}) " +
           "OPTIONAL MATCH (m)-[:CONTAINS_CHAPITRE|CONTAINS_CONCEPT*0..2]->(node) " +
           "DETACH DELETE node")
    void deleteModuleCascade(String moduleId);
}
