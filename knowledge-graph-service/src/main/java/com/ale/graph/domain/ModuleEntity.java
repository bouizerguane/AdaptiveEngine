package com.ale.graph.domain;

import lombok.Data;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import java.util.ArrayList;
import java.util.List;

@Node("Module")
@Data
public class ModuleEntity {
    @Id
    private String id;
    private String title;
    private String description;
    private String authorEmail;
    private Integer orderIndex = 0;
    private Double posX;
    private Double posY;
    
    @Relationship(type = "CONTAINS_CHAPITRE", direction = Relationship.Direction.OUTGOING)
    private List<Chapitre> chapitres = new ArrayList<>();
}
