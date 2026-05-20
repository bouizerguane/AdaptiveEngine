package com.ale.tracking.dto;

import lombok.Data;

@Data
public class AdaptiveRefreshEventRequest {
    private String learnerEmail;
    private String courseId;
    private String lastEventType;
    private String refreshReason;
    private String eventPayload;
    private String eventAt;
}
