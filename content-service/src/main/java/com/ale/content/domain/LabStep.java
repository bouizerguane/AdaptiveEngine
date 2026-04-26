package com.ale.content.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Sous-document embarqué dans {@link Lab}.
 * Chaque étape représente une section pédagogique du TP
 * avec un contenu HTML riche (Tiptap).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LabStep {

    /** Identifiant interne (UUID généré côté frontend) */
    private String id;

    /** Titre court affiché dans la sidebar du stepper */
    private String title;

    /**
     * Contenu HTML généré par l'éditeur Tiptap.
     * Peut contenir : blocs de code (CodeBlockLowlight), tableaux, listes, liens, couleurs.
     * Les médias (images/vidéos) sont intentionnellement exclus des TP.
     */
    private String content;

    /** Position dans la liste (0-indexed). Géré par le frontend via @dnd-kit. */
    private int orderIndex;
}
