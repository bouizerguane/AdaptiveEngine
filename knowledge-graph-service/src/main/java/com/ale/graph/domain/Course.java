package com.ale.graph.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Node("Course")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Course {
    @Id
    private String id;
    private String title;
    private String description;
    private String objectifs;
    private String prerequisTextuels;
    private String authorEmail;
    private String authorName;
    private LocalDateTime createdAt;
    private String status;
    private Double posX;
    private Double posY;

    @Builder.Default
    @Relationship(type = "CONTAINS_MODULE", direction = Relationship.Direction.OUTGOING)
    private List<ModuleEntity> modules = new ArrayList<>();
}
