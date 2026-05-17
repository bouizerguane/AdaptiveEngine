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
                    "Le diagnostic montre une lacune sur " + conceptName + ". Commencez par revoir la ressource, puis consolidez avec le TP avant de passer l'evaluation formative.",
                    List.of("Revoir la ressource du concept", "Realiser ou refaire le TP", "Passer l'evaluation formative"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            case "FORMATIVE_FAILED" -> new TutoringFeedbackResponse(
                    eventType,
                    "L'evaluation formative de " + conceptName + " n'est pas encore reussie. Travaillez la remediation, puis repassez le quiz.",
                    List.of("Relire la ressource de remediation", "Reprendre les points difficiles", "Repasser le quiz formatif"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            case "LAB_SUBMITTED" -> new TutoringFeedbackResponse(
                    eventType,
                    "TP soumis pour " + conceptName + ". Vous pouvez maintenant verifier votre maitrise avec l'evaluation formative.",
                    List.of("Passer l'evaluation formative", "Conserver le lien GitHub du TP"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            case "CONCEPT_MASTERED" -> new TutoringFeedbackResponse(
                    eventType,
                    "Bravo, " + conceptName + " est maitrise. Continuez avec le prochain concept recommande.",
                    List.of("Continuer le parcours", "Ouvrir le prochain concept recommande"),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    null
            );
            default -> new TutoringFeedbackResponse(
                    "GENERAL",
                    "Continuez votre progression pas a pas : ressource, TP, puis evaluation formative.",
                    List.of("Revoir la ressource", "Realiser le TP", "Passer le quiz"),
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
                    "Des lacunes ont ete detectees sur " + conceptName + ". Il est recommande de revoir la ressource avant de refaire le TP puis l'evaluation formative.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "REVIEW", "LAB", "FORMATIVE")),
                    List.of("Revoir la ressource", "Reprendre les prerequis", "Realiser ou refaire le TP", "Passer l'evaluation formative"),
                    "Cette etape sert a consolider vos bases avant de continuer.",
                    explanation(request, "La strategie RECOVERY est appliquee car le parcours signale une remediation ou des lacunes.")
            );
            case "SUPPORTIVE" -> strategyResponse(
                    eventType,
                    "GUIDED_SUPPORT",
                    "Le systeme vous propose une progression guidee afin de collecter davantage d'indices sur votre apprentissage.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "LAB", "FORMATIVE")),
                    List.of("Consulter la ressource", "Realiser une activite guidee", "Passer l'evaluation formative"),
                    "Avancez etape par etape ; vos prochaines activites aideront a personnaliser davantage le parcours.",
                    explanation(request, "La strategie SUPPORTIVE est appliquee car les donnees disponibles restent limitees.")
            );
            case "STANDARD" -> strategyResponse(
                    eventType,
                    "STANDARD_GUIDANCE",
                    "Vous pouvez suivre la sequence normale : consulter la ressource, realiser le TP, puis passer l'evaluation formative.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "LAB", "FORMATIVE")),
                    List.of("Consulter la ressource", "Realiser le TP", "Passer l'evaluation formative"),
                    "Continuez votre progression.",
                    explanation(request, "La strategie STANDARD accompagne le parcours recommande sans remediation specifique.")
            );
            case "ADVANCED" -> strategyResponse(
                    eventType,
                    "ENRICHMENT_FEEDBACK",
                    "Votre profil indique une bonne maitrise. Vous pouvez aborder " + conceptName + " avec une activite plus avancee.",
                    firstNonEmpty(request.recommendedSequence(), List.of("RESOURCE", "CHALLENGE", "FORMATIVE")),
                    List.of("Consulter rapidement la ressource", "Tenter un defi", "Valider par l'evaluation formative"),
                    "Essayez d'aller plus loin avec un defi ou une variante du TP.",
                    explanation(request, "La strategie ADVANCED est appliquee car le profil indique une bonne maitrise.")
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
            parts.add("evaluation=" + request.evaluationType());
        }
        if (request.score() != null) {
            parts.add("score=" + request.score());
        }
        if (request.knowledgeGaps() != null && !request.knowledgeGaps().isEmpty()) {
            parts.add("lacunes=" + String.join(", ", request.knowledgeGaps()));
        }
        if (parts.isEmpty()) return fallback;
        return fallback + " Contexte utilise: " + String.join("; ", parts) + ".";
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
