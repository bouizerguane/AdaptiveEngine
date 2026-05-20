package com.ale.adaptive.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PathFreshnessDto {
    private boolean refreshedAfterEvent;
    private String lastEventType;
    private String lastEventAt;
    private String refreshReason;
    private String message;
}
