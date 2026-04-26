package com.ale.content.repository;

import com.ale.content.domain.Ressource;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface RessourceRepository extends MongoRepository<Ressource, String> {
    List<Ressource> findByConceptId(String conceptId);
}
