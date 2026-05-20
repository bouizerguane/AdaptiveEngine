package com.ale.tracking.dto;

import lombok.Data;

@Data
public class AdaptiveRefreshConsumeRequest {
    private String learnerEmail;
    private String courseId;
}
