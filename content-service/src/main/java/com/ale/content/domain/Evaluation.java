package com.ale.content.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Document(collection = "evaluations")
@CompoundIndex(name = "idx_evaluation_target_type", def = "{ 'targetId': 1, 'typeEvaluation': 1 }", unique = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Evaluation {

    @Id
    private String id;

    private String courseId;

    /**
     * ID polymorphe : peut être un conceptId, chapitreId, moduleId ou courseId.
     * Une cible peut posséder plusieurs banques de questions selon le type d'évaluation.
     */
    @Indexed
    private String targetId;

    /**
     * Type de la cible pédagogique.
     * Valeurs : COURSE | MODULE | CONCEPT.
     */
    private String targetType;

    /**
     * Type d'évaluation.
     * Valeurs utilisées : FORMATIVE, VALIDATION, VALIDATION_COURS,
     * DIAGNOSTIC_ENTREE, DIAGNOSTIC_POSITIONNEMENT.
     */
    private String typeEvaluation;

    private double seuilReussite;
    private int nbrTentativesMax;
    private int tempsImparti;

    @Builder.Default
    private boolean allowBacktrack = true;

    @Builder.Default
    private boolean shuffleQuestions = false;

    @Builder.Default
    private boolean showImmediateFeedback = false;

    private int retryDelayHours;
    private String remediationResourceId;
    private double coefficient;

    @Builder.Default
    private int nbQuestionsATirer = 0;

    @Builder.Default
    private boolean equilibrerDifficulte = false;

    @Builder.Default
    private double seuilDeSaut = 80.0;

    private List<Question> questions;
}
