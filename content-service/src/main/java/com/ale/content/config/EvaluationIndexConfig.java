package com.ale.content.config;

import com.ale.content.domain.Evaluation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

@Configuration
@Slf4j
public class EvaluationIndexConfig {

    @Bean
    ApplicationRunner evaluationIndexMigration(MongoTemplate mongoTemplate) {
        return args -> {
            dropLegacyIndexIfPresent(mongoTemplate, "targetId");
            dropLegacyIndexIfPresent(mongoTemplate, "targetId_1");
            mongoTemplate.indexOps(Evaluation.class).ensureIndex(
                    new Index()
                            .on("targetId", Sort.Direction.ASC)
                            .on("typeEvaluation", Sort.Direction.ASC)
                            .unique()
                            .named("idx_evaluation_target_type")
            );
        };
    }

    private void dropLegacyIndexIfPresent(MongoTemplate mongoTemplate, String indexName) {
        try {
            mongoTemplate.indexOps(Evaluation.class).dropIndex(indexName);
            log.info("[EvaluationIndex] Dropped legacy index {}", indexName);
        } catch (Exception ignored) {
            // Index absent: no migration needed.
        }
    }
}
