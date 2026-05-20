package com.ale.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "adaptive_refresh_event",
        indexes = {
                @Index(name = "idx_adaptive_refresh_learner", columnList = "learnerEmail"),
                @Index(name = "idx_adaptive_refresh_course", columnList = "courseId"),
                @Index(name = "idx_adaptive_refresh_consumed", columnList = "consumed")
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdaptiveRefreshEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String learnerEmail;

    @Column(nullable = false)
    private String courseId;

    @Column(nullable = false)
    private String lastEventType;

    @Column(nullable = false)
    private String refreshReason;

    @Column(columnDefinition = "TEXT")
    private String eventPayload;

    private LocalDateTime eventAt;

    @Builder.Default
    private boolean consumed = false;

    private LocalDateTime consumedAt;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (eventAt == null) {
            eventAt = createdAt;
        }
    }
}
