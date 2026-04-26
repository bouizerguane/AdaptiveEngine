package com.ale.content.repository;

import com.ale.content.domain.Evaluation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EvaluationRepository extends MongoRepository<Evaluation, String> {
    Optional<Evaluation> findByTargetId(String targetId);
}
