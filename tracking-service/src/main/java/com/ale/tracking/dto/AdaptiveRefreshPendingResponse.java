package com.ale.tracking.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdaptiveRefreshPendingResponse {
    private boolean pending;
    private Long id;
    private String learnerEmail;
    private String courseId;
    private String lastEventType;
    private String refreshReason;
    private String eventAt;
    private String consumedAt;
}
