package com.ale.graph.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseSummaryDto {
    private String id;
    private String title;
    private String description;
    private String teacherEmail;
    private LocalDateTime createdAt;
    private String status;
}
