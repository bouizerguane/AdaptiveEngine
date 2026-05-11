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

        return switch (eventType) {
            case "DIAGNOSTIC_FAILED" -> new TutoringFeedbackResponse(
                    eventType,
                    "Le diagnostic montre une lacune sur " + conceptName + ". Commencez par revoir la ressource, puis consolidez avec le TP avant de passer l'evaluation formative.",
                    List.of("Revoir la ressource du concept", "Realiser ou refaire le TP", "Passer l'evaluation formative")
            );
            case "FORMATIVE_FAILED" -> new TutoringFeedbackResponse(
                    eventType,
                    "L'evaluation formative de " + conceptName + " n'est pas encore reussie. Travaillez la remediation, puis repassez le quiz.",
                    List.of("Relire la ressource de remediation", "Reprendre les points difficiles", "Repasser le quiz formatif")
            );
            case "LAB_SUBMITTED" -> new TutoringFeedbackResponse(
                    eventType,
                    "TP soumis pour " + conceptName + ". Vous pouvez maintenant verifier votre maitrise avec l'evaluation formative.",
                    List.of("Passer l'evaluation formative", "Conserver le lien GitHub du TP")
            );
            case "CONCEPT_MASTERED" -> new TutoringFeedbackResponse(
                    eventType,
                    "Bravo, " + conceptName + " est maitrise. Continuez avec le prochain concept recommande.",
                    List.of("Continuer le parcours", "Ouvrir le prochain concept recommande")
            );
            default -> new TutoringFeedbackResponse(
                    "GENERAL",
                    "Continuez votre progression pas a pas : ressource, TP, puis evaluation formative.",
                    List.of("Revoir la ressource", "Realiser le TP", "Passer le quiz")
            );
        };
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? "GENERAL" : value.trim().toUpperCase();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }
}
