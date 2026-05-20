package com.ale.tutoring.service;

import com.ale.tutoring.dto.TutoringFeedbackRequest;
import com.ale.tutoring.dto.TutoringFeedbackResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TutoringFeedbackService {

    public TutoringFeedbackResponse generate(TutoringFeedbackRequest request) {
        String eventType = normalize(request.eventType());
        String conceptName = firstNonBlank(request.conceptName(), "ce concept");
        String strategyType = normalizeNullable(request.strategyType());

        if (strategyType != null) {
            return generateStrategyFeedback(request, eventType, conceptName, strategyType);
        }

        return switch (eventType) {
            case "DIAGNOSTIC_FAILED" -> new TutoringFeedbackResponse(
                    eventType,
                    "Le diagnostic met en évidence une lacune sur " + conceptName + ". Une consolidation est recommandée avant de poursuivre la progression.",
                    List.of("Revoir la ressource du concept", "Reprendre les prérequis associés", "Réaliser le TP de consolidation", "Passer l'évaluation formative"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            case "FORMATIVE_FAILED" -> new TutoringFeedbackResponse(
                    eventType,
                    "L'évaluation formative indique que " + conceptName + " n'est pas encore stabilisé. Une reprise ciblée permet de consolider les points fragiles.",
                    List.of("Relire la ressource de remédiation", "Identifier les erreurs récurrentes", "Reprendre les points difficiles", "Repasser le quiz formatif"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            case "LAB_SUBMITTED" -> new TutoringFeedbackResponse(
                    eventType,
                    "Le TP associé à " + conceptName + " a été soumis. L'évaluation formative permet maintenant de vérifier la maîtrise du concept.",
                    List.of("Consulter le retour sur le TP", "Passer l'évaluation formative", "Conserver le lien GitHub du TP"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            case "CONCEPT_MASTERED" -> new TutoringFeedbackResponse(
                    eventType,
                    conceptName + " est considéré comme maîtrisé. La progression peut se poursuivre vers le prochain concept recommandé.",
                    List.of("Continuer le parcours", "Ouvrir le prochain concept recommandé"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            default -> new TutoringFeedbackResponse(
                    "GENERAL",
                    "La progression recommandée suit une séquence graduelle : comprendre la ressource, pratiquer, puis vérifier la maîtrise.",
                    List.of("Consulter la ressource", "Réaliser le TP", "Passer l'évaluation formative"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
        };
    }

    private TutoringFeedbackResponse generateStrategyFeedback(
            TutoringFeedbackRequest request,
            String eventType,
            String conceptName,
            String strategyType) {
        return switch (strategyType) {
            case "RECOVERY" -> strategyResponse(
                    eventType,
                    "REMEDIATION_FEEDBACK",
                    "Des lacunes ont été identifiées sur " + conceptName + ". Une remédiation structurée est recommandée avant la poursuite du parcours.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "REVIEW", "LAB", "FORMATIVE")),
                    List.of("Revoir la ressource", "Reprendre les prérequis", "Réaliser ou refaire le TP", "Passer l'évaluation formative"),
                    "Cette étape consolide les bases nécessaires avant d'aborder de nouveaux concepts.",
                    explanation(request, "Une approche de remédiation est appliquée car le parcours signale des lacunes à consolider.")
            );
            case "SUPPORTIVE" -> strategyResponse(
                    eventType,
                    "GUIDED_SUPPORT",
                    "Une progression guidée est proposée afin d'accompagner l'apprentissage et de recueillir davantage d'indicateurs.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "LAB", "FORMATIVE")),
                    List.of("Consulter la ressource", "Réaliser une activité guidée", "Passer l'évaluation formative"),
                    "Avancez étape par étape ; les prochaines activités permettront d'affiner l'accompagnement.",
                    explanation(request, "Une approche guidée est appliquée car les données disponibles restent limitées.")
            );
            case "STANDARD" -> strategyResponse(
                    eventType,
                    "STANDARD_GUIDANCE",
                    "Le parcours peut suivre la séquence pédagogique standard : ressource, pratique, puis évaluation formative.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "LAB", "FORMATIVE")),
                    List.of("Consulter la ressource", "Réaliser le TP", "Passer l'évaluation formative"),
                    "Continuez la progression selon l'ordre d'apprentissage prévu.",
                    explanation(request, "Une approche standard accompagne le parcours recommandé sans remédiation spécifique.")
            );
            case "ADVANCED" -> strategyResponse(
                    eventType,
                    "ENRICHMENT_FEEDBACK",
                    "Le profil indique une maîtrise solide. " + conceptName + " peut être abordé avec une activité d'approfondissement.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "CHALLENGE", "FORMATIVE")),
                    List.of("Consulter rapidement la ressource", "Tenter un défi", "Valider par l'évaluation formative"),
                    "Un défi ou une variante du TP permet d'étendre la maîtrise déjà observée.",
                    explanation(request, "Une approche avancée est appliquée car le profil indique une bonne maîtrise.")
            );
            default -> generate(new TutoringFeedbackRequest(
                    request.eventType(),
                    request.learnerEmail(),
                    request.courseId(),
                    request.courseTitle(),
                    request.conceptId(),
                    request.conceptName(),
                    request.score(),
                    request.evaluationType(),
                    null,
                    request.nextAction(),
                    request.profileType(),
                    request.masteryScore(),
                    request.knowledgeGaps(),
                    request.recommendedSequence(),
                    request.tutoringMessageHint()
            ));
        };
    }

    private TutoringFeedbackResponse strategyResponse(
            String eventType,
            String feedbackType,
            String message,
            List<String> learningSequence,
            List<String> recommendedActions,
            String motivationalMessage,
            String explanation) {
        return new TutoringFeedbackResponse(
                eventType,
                message,
                recommendedActions,
                feedbackType,
                recommendedActions,
                learningSequence,
                motivationalMessage,
                explanation
        );
    }

    private String explanation(TutoringFeedbackRequest request, String fallback) {
        List<String> parts = new java.util.ArrayList<>();
        if (request.profileType() != null && !request.profileType().isBlank()) {
            parts.add("profil=" + request.profileType());
        }
        if (request.nextAction() != null && !request.nextAction().isBlank()) {
            parts.add("action=" + request.nextAction());
        }
        if (request.evaluationType() != null && !request.evaluationType().isBlank()) {
            parts.add("évaluation=" + request.evaluationType());
        }
        if (request.score() != null) {
            parts.add("score=" + request.score());
        }
        if (request.knowledgeGaps() != null && !request.knowledgeGaps().isEmpty()) {
            parts.add("lacunes=" + String.join(", ", request.knowledgeGaps()));
        }
        if (parts.isEmpty()) return fallback;
        return fallback + " Contexte utilisé: " + String.join("; ", parts) + ".";
    }

    private List<String> firstNonEmpty(List<String> value, List<String> fallback) {
        return value == null || value.isEmpty() ? fallback : value;
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? "GENERAL" : value.trim().toUpperCase();
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }
}
