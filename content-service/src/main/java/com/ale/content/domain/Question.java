package com.ale.content.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {
    private String text;
    private String type; // QCM, TRUE_FALSE
    private List<String> options;
    private String correctAnswer;
    private String difficulty; // EASY, MEDIUM, HARD
    private String hintText;  // Indice affiché en FORMATIVE (optionnel)
}
