package com.ale.content.repository;

import com.ale.content.domain.Evaluation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface EvaluationRepository extends MongoRepository<Evaluation, String> {
    Optional<Evaluation> findByTargetId(String targetId);
    Optional<Evaluation> findFirstByTargetIdOrderByIdDesc(String targetId);
    Optional<Evaluation> findByTargetIdAndTypeEvaluation(String targetId, String typeEvaluation);
    List<Evaluation> findByCourseId(String courseId);
    List<Evaluation> findByCourseIdAndTypeEvaluationIn(String courseId, Collection<String> typeEvaluations);
    List<Evaluation> findByTargetIdAndTypeEvaluationIn(String targetId, Collection<String> typeEvaluations);
    long deleteByCourseIdIn(Collection<String> courseIds);
    long deleteByTargetIdIn(Collection<String> targetIds);
}
