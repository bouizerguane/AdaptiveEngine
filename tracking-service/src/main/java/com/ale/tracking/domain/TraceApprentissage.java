package com.ale.tracking.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "trace_apprentissage")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TraceApprentissage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_trace")
    private Long idTrace;

    @Column(nullable = false)
    private String courseId;

    private String targetId; // conceptId ou moduleId ou courseId selon targetType

    /**
     * Type de la cible pédagogique : CONCEPT | MODULE | COURSE.
     * Utilisé par le moteur adaptatif rule-based explicable pour différencier les types de performance.
     */
    private String targetType;

    private String studentEmail;

    private String learnerEmail;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String evaluationId;

    private String typeEvaluation;

    private double scoreObtenu;

    /**
     * Temps de consultation en secondes
     */
    private long tempsConsultation;

    /**
     * Horodatage de soumission
     */
    private LocalDateTime horodatage;

    /**
     * Feedback généré automatiquement selon seuil_reussite
     */
    @Column(length = 1000)
    private String feedbackGenere;

    /**
     * Nombre de changements d'onglet détectés (anti-triche VALIDATION)
     */
    @Builder.Default
    private int tabSwitchesCount = 0;

    /**
     * Source de maîtrise — métadonnée utile au moteur adaptatif et exploitable pour de futurs modèles ML.
     * Valeurs :
     *   null               → quiz standard sans implication sur la maîtrise globale
     *   "QUIZ_DIRECT"      → concept validé directement par un quiz FORMATIVE/VALIDATION
     *   "DIAGNOSTIC_MODULE_SKIP" → concept validé indirectement via un DIAGNOSTIC_POSITIONNEMENT réussi
     *                              (saut de niveau : tous les concepts du module sont marqués ACQUIS)
     */
    private String masterySource;

    /**
     * JSON optionnel contenant les rÃ©sultats agrÃ©gÃ©s par concept pour les diagnostics.
     */
    @Column(columnDefinition = "TEXT")
    private String conceptResults;
}
