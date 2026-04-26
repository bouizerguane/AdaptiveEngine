package com.ale.graph.domain;

import lombok.Data;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import java.util.ArrayList;
import java.util.List;

@Node("Concept")
@Data
public class Concept {
    @Id
    private String id;
    private String labelPedagogique;
    private String description;
    private Float poidsCognitif;
    private Boolean estVerrouille;
    private Integer orderIndex = 0;
    private Double posX;
    private Double posY;

    @Relationship(type = "isPredecessorOf", direction = Relationship.Direction.OUTGOING)
    private List<Concept> exigences = new ArrayList<>();
}
