package com.ale.content.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ressources")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Ressource {
    @Id
    private String idRessource;
    private String conceptId;
    private FormatType typeFormat;
    private String uriContenu;
    private Integer complexite;
    private Evaluation evaluation;
}
