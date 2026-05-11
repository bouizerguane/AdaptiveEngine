package com.ale.content.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class CourseCleanupRequest {
    private List<String> courseIds = new ArrayList<>();
    private List<String> conceptIds = new ArrayList<>();
}
