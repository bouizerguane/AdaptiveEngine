package com.ale.graph.domain;

import lombok.Data;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import java.util.ArrayList;
import java.util.List;

@Node("Chapitre")
@Data
public class Chapitre {
    @Id
    private String id;
    private String title;
    private String description;
    private Integer orderIndex = 0;
    private Double posX;
    private Double posY;
    
    @Relationship(type = "CONTAINS_CONCEPT", direction = Relationship.Direction.OUTGOING)
    private List<Concept> concepts = new ArrayList<>();
}
