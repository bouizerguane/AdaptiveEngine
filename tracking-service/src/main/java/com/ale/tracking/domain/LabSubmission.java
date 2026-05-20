package com.ale.tracking.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Persistance des soumissions de Travaux Pratiques (Labs).
 * Table PostgreSQL : lab_submission
 *
 * Le champ {@code status} alimente l'adaptation rule-based et prépare des données exploitables
 * par de futurs modèles ML pour détecter les abandons (STARTED sans COMPLETED).
 *
 * Le champ {@code timeSpentPerStep} est un JSON sérialisé par le frontend :
 *   ex: {"0": 120, "1": 340, "2": 60}  (secondes par étape)
 */
@Entity
@Table(name = "lab_submission")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LabSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSubmission;

    /** ID de l'apprenant. */
    @Column(nullable = false)
    private String userId;

    private String learnerEmail;

    private String studentEmail;

    /** ID du Lab (document MongoDB). */
    @Column(nullable = false)
    private String labId;

    /** ID du Cours parent — utile pour les stats par cours. */
    private String courseId;

    /** ID du Concept cible — pour le marquage Neo4j (basis='LAB'). */
    private String conceptId;

    private String targetId;

    /**
     * URL du dépôt GitHub soumis par l'apprenant.
     * Validée côté frontend (regex ^https?://github\.com/).
     * Nullable jusqu'à soumission finale.
     */
    private String githubRepoUrl;

    /**
     * Horodatage de la soumission finale.
     * Null si status = STARTED.
     */
    private LocalDateTime completedAt;

    /**
     * Statut du TP :
     *   STARTED   — l'apprenant a ouvert le TP mais ne l'a pas encore soumis.
     *   COMPLETED — l'URL GitHub a été soumise et validée.
     *
     * Les enregistrements STARTED sans COMPLETED après X heures
     * sont des abandons — données utiles au profil apprenant et à une future analyse ML.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private LabStatus status = LabStatus.STARTED;

    /**
     * JSON sérialisé : temps passé (en secondes) par étape.
     * Exemple : {"0":120,"1":340,"2":60}
     * Envoyé par StudentLab.jsx à chaque changement d'étape.
     */
    @Column(columnDefinition = "TEXT")
    private String timeSpentPerStep;

    /**
     * Flag indiquant si la soumission est un test enseignant (dogfooding).
     * Ces entrées sont exclues des statistiques réelles et du moteur adaptatif.
     */
    @Builder.Default
    private boolean isTeacherTest = false;

    public enum LabStatus {
        STARTED, COMPLETED
    }
}
