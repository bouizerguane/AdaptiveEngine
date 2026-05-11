package com.ale.graph.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class BulkCourseDeleteRequest {
    private List<String> courseIds = new ArrayList<>();
}
