package com.ale.content.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

/**
 * Document MongoDB représentant un Travail Pratique (TP) pédagogique.
 *
 * Un Lab est toujours rattaché à un Concept pédagogique du Knowledge Graph via {@code targetId}.
 * La réussite d'un Lab valide une "Capacité d'Application" (basis='LAB') dans Neo4j,
 * distincte de la "Connaissance" validée par un Quiz (basis='QUIZ').
 *
 * Collection MongoDB : "labs"
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "labs")
public class Lab {

    @Id
    private String id;

    /**
     * ID du nœud Concept dans le Knowledge Graph (Neo4j).
     * Indexé en unique : un seul Lab par Concept.
     */
    @Indexed(unique = true)
    private String targetId;

    /** ID du Cours parent — permet de lister tous les Labs d'un cours. */
    private String courseId;

    /** Titre du TP affiché à l'apprenant. */
    private String title;

    /**
     * Niveau de difficulté : EASY | MEDIUM | HARD.
     * Utilisé par le moteur adaptatif LSTM pour les recommandations.
     */
    private String difficulty;

    /** Durée estimée en minutes. Affiché dans le header du stepper apprenant. */
    private int estimatedTime;

    /**
     * Toujours true : chaque TP requiert une soumission GitHub.
     * La dernière étape "Soumission" est générée automatiquement côté frontend.
     */
    @Builder.Default
    private boolean requireGithub = true;

    /**
     * Liste ordonnée des étapes du TP.
     * L'ordre est géré par {@link LabStep#orderIndex} et le drag-and-drop @dnd-kit.
     * L'étape "Soumission" est toujours la dernière ; elle est gérée côté frontend.
     */
    @Builder.Default
    private List<LabStep> steps = new ArrayList<>();
}
