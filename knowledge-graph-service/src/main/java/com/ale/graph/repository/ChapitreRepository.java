package com.ale.graph.repository;

import com.ale.graph.domain.Chapitre;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

public interface ChapitreRepository extends Neo4jRepository<Chapitre, String> {

    @Query("MATCH (c:Chapitre {id: $chapitreId}) " +
           "OPTIONAL MATCH (c)-[:CONTAINS_CONCEPT*0..1]->(node) " +
           "DETACH DELETE node")
    void deleteChapitreCascade(String chapitreId);

    @Query("MATCH (ch:Chapitre {id: $chapitreId}) SET ch.orderIndex = $index")
    void updateChapitreOrder(String chapitreId, int index);
}
