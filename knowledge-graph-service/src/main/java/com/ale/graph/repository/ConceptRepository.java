package com.ale.graph.repository;

import com.ale.graph.domain.Concept;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

public interface ConceptRepository extends Neo4jRepository<Concept, String> {

    @Query("MATCH path = (target:Concept {id: $targetId})-[:isPredecessorOf*0..50]->(source:Concept {id: $sourceId}) " +
           "RETURN count(path) = 0")
    boolean isDagValid(String sourceId, String targetId);

    @Query("MATCH (s:Concept {id: $sourceId}), (t:Concept {id: $targetId}) MERGE (s)-[:isPredecessorOf]->(t)")
    void addExigenceEdge(String sourceId, String targetId);

    @Query("MATCH (s:Concept {id: $sourceId})-[r:isPredecessorOf]->(t:Concept {id: $targetId}) DELETE r")
    void removeExigence(String sourceId, String targetId);

    @Query("MATCH (c:Concept {id: $conceptId}) SET c.orderIndex = $index")
    void updateConceptOrder(String conceptId, int index);
}
