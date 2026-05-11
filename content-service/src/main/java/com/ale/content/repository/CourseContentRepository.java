package com.ale.content.repository;

import com.ale.content.domain.CourseContent;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Collection;
import java.util.Optional;

public interface CourseContentRepository extends MongoRepository<CourseContent, String> {
    Optional<CourseContent> findByConceptId(String conceptId);
    long deleteByConceptIdIn(Collection<String> conceptIds);
}
