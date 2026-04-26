package com.ale.content.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "course_content")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CourseContent {

    @Id
    private String id;

    @Indexed(unique = true)
    private String conceptId;

    private String htmlContent;

    private LocalDateTime lastUpdated;
}
