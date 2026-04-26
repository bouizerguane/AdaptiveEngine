package com.ale.content.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Document(collection = "evaluations")
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
     * Indexé en unicité : une seule évaluation par cible pédagogique.
     */
    @Indexed(unique = true)
    private String targetId;

    /**
     * Type de la cible pédagogique.
     * Valeurs : COURSE | MODULE | CONCEPT
     * Permet à l'Adaptive Engine de différencier les niveaux de diagnostic.
     */
    private String targetType; // COURSE, MODULE, CONCEPT

    /**
     * Type d'évaluation.
     * Valeurs : POSITIONNEMENT | FORMATIVE | VALIDATION | DIAGNOSTIC_ENTREE | DIAGNOSTIC_POSITIONNEMENT
     */
    private String typeEvaluation;

    // ---- COMMON SETTINGS ----
    private double seuilReussite;
    private int nbrTentativesMax;

    /**
     * Temps imparti en minutes (0 = pas de limite)
     */
    private int tempsImparti;

    // ---- ADVANCED / CONDITIONAL SETTINGS ----

    /**
     * FORMATIVE & POSITIONNEMENT — Autoriser la navigation arrière entre questions
     */
    @Builder.Default
    private boolean allowBacktrack = true;

    /**
     * Mélanger l'ordre des questions à chaque session
     */
    @Builder.Default
    private boolean shuffleQuestions = false;

    /**
     * FORMATIVE uniquement — Afficher correction immédiate après chaque réponse
     */
    @Builder.Default
    private boolean showImmediateFeedback = false;

    /**
     * FORMATIVE — Délai en heures avant nouvelle tentative (0 = immédiat)
     */
    private int retryDelayHours;

    /**
     * FORMATIVE — Identifiant de la ressource de remédiation associée
     */
    private String remediationResourceId;

    /**
     * VALIDATION — Coefficient pour le calcul de la note de module
     */
    private double coefficient;

    // ---- POOL & TIRAGE ALÉATOIRE ----

    /**
     * Nombre de questions à tirer aléatoirement à chaque session.
     * 0 = toutes les questions de la banque sont utilisées.
     */
    @Builder.Default
    private int nbQuestionsATirer = 0;

    /**
     * Si true : le tirage est stratifié par difficulté (EASY/MEDIUM/HARD)
     * afin de garantir un équilibre proportionnel entre les niveaux.
     */
    @Builder.Default
    private boolean equilibrerDifficulte = false;

    /**
     * DIAGNOSTIC_POSITIONNEMENT uniquement.
     * Score minimum (à ne pas confondre avec seuilReussite générique)
     * requis pour valider le saut de niveau et marquer tous les concepts du module comme ACQUIS.
     */
    @Builder.Default
    private double seuilDeSaut = 80.0;

    // ---- QUESTIONS ----
    private List<Question> questions;
}
