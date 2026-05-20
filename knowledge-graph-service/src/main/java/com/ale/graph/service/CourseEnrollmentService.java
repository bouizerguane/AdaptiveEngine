package com.ale.graph.service;

import com.ale.graph.dto.ConceptRecommendationDto;
import com.ale.graph.dto.CourseSummaryDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CourseEnrollmentService {

    private final Neo4jClient neo4jClient;

    public List<CourseSummaryDto> getAvailableCourses() {
        String cypher = """
            MATCH (c:Course)
            WHERE c.status IS NULL OR c.status = 'PUBLISHED'
            RETURN c.id AS id,
                   c.title AS title,
                   c.description AS description,
                   c.objectifs AS objectifs,
                   c.prerequisTextuels AS prerequisTextuels,
                   c.authorEmail AS teacherEmail,
                   c.authorName AS teacherName,
                   c.createdAt AS createdAt,
                   coalesce(c.status, 'PUBLISHED') AS status
            ORDER BY coalesce(c.createdAt, datetime('1970-01-01T00:00:00Z')) DESC, c.title
            """;

        return fetchCourseSummaries(cypher, Map.of());
    }

    public List<CourseSummaryDto> searchCourses(String query) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        if (normalizedQuery.isBlank()) {
            return getAvailableCourses();
        }

        String cypher = """
            MATCH (c:Course)
            WHERE (c.status IS NULL OR c.status = 'PUBLISHED')
              AND (
                toLower(coalesce(c.title, '')) CONTAINS $query OR
                toLower(coalesce(c.description, '')) CONTAINS $query OR
                toLower(coalesce(c.authorEmail, '')) CONTAINS $query OR
                toLower(coalesce(c.authorName, '')) CONTAINS $query
              )
            RETURN c.id AS id,
                   c.title AS title,
                   c.description AS description,
                   c.objectifs AS objectifs,
                   c.prerequisTextuels AS prerequisTextuels,
                   c.authorEmail AS teacherEmail,
                   c.authorName AS teacherName,
                   c.createdAt AS createdAt,
                   coalesce(c.status, 'PUBLISHED') AS status
            ORDER BY c.title
            """;

        return fetchCourseSummaries(cypher, Map.of("query", normalizedQuery));
    }

    public boolean enroll(String courseId, String learnerEmail, String nom, String prenom) {
        log.info("[CourseEnrollmentService] enroll requested courseId={}, learnerEmail={}", courseId, learnerEmail);
        String cypher = """
            MATCH (c:Course {id: $courseId})
            WHERE c.status IS NULL OR c.status = 'PUBLISHED'
            MERGE (l:Learner {email: $learnerEmail})
            SET l.nom = CASE WHEN $nom = '' THEN l.nom ELSE $nom END,
                l.prenom = CASE WHEN $prenom = '' THEN l.prenom ELSE $prenom END
            MERGE (l)-[r:ENROLLED_IN]->(c)
            ON CREATE SET r.enrolledAt = datetime()
            RETURN count(r) AS enrolled
            """;

        Long enrolled = neo4jClient.query(cypher)
                .bindAll(new java.util.HashMap<>() {{
                    put("courseId", courseId);
                    put("learnerEmail", learnerEmail);
                    put("nom", nom == null ? "" : nom.trim());
                    put("prenom", prenom == null ? "" : prenom.trim());
                }})
                .fetchAs(Long.class)
                .mappedBy((typeSystem, record) -> record.get("enrolled").asLong())
                .first()
                .orElse(0L);

        log.info("[CourseEnrollmentService] enroll result courseId={}, learnerEmail={}, enrolledCount={}",
                courseId, learnerEmail, enrolled);
        return enrolled > 0;
    }

    public List<CourseSummaryDto> getEnrolledCourses(String learnerEmail) {
        String cypher = """
            MATCH (:Learner {email: $learnerEmail})-[:ENROLLED_IN]->(c:Course)
            RETURN c.id AS id,
                   c.title AS title,
                   c.description AS description,
                   c.objectifs AS objectifs,
                   c.prerequisTextuels AS prerequisTextuels,
                   c.authorEmail AS teacherEmail,
                   c.authorName AS teacherName,
                   c.createdAt AS createdAt,
                   coalesce(c.status, 'PUBLISHED') AS status
            ORDER BY c.title
            """;

        return fetchCourseSummaries(cypher, Map.of("learnerEmail", learnerEmail));
    }

    public boolean courseBelongsToTeacher(String courseId, String teacherEmail) {
        if (teacherEmail == null || teacherEmail.isBlank()) {
            return false;
        }

        String cypher = """
            MATCH (c:Course {id: $courseId})
            WHERE c.authorEmail = $teacherEmail
            RETURN count(c) AS count
            """;

        Long count = neo4jClient.query(cypher)
                .bindAll(Map.of("courseId", courseId, "teacherEmail", teacherEmail))
                .fetchAs(Long.class)
                .mappedBy((typeSystem, record) -> record.get("count").asLong())
                .first()
                .orElse(0L);

        return count > 0;
    }

    public List<Map<String, Object>> getCourseEnrollments(String courseId) {
        String cypher = """
            MATCH (learner)-[r:ENROLLED_IN]->(:Course {id: $courseId})
            WHERE learner:Learner OR learner:User
            RETURN coalesce(learner.email, learner.id) AS email,
                   coalesce(learner.nom, learner.lastName, '') AS nom,
                   coalesce(learner.prenom, learner.firstName, '') AS prenom,
                   r.enrolledAt AS enrolledAt
            ORDER BY enrolledAt DESC, email
            """;

        return new java.util.ArrayList<>(neo4jClient.query(cypher)
                .bindAll(Map.of("courseId", courseId))
                .fetch()
                .all());
    }

    public boolean unenrollLearner(String courseId, String learnerEmail) {
        String cypher = """
            MATCH (learner)-[r:ENROLLED_IN]->(:Course {id: $courseId})
            WHERE (learner:Learner OR learner:User)
              AND coalesce(learner.email, learner.id) = $learnerEmail
            DELETE r
            RETURN count(r) AS deleted
            """;

        Long deleted = neo4jClient.query(cypher)
                .bindAll(Map.of("courseId", courseId, "learnerEmail", learnerEmail))
                .fetchAs(Long.class)
                .mappedBy((typeSystem, record) -> record.get("deleted").asLong())
                .first()
                .orElse(0L);

        return deleted > 0;
    }

    public Optional<ConceptRecommendationDto> recommendNextConcept(String learnerEmail, String courseId) {
        String cypher = """
            MATCH (c:Course {id: $courseId})-[:CONTAINS_MODULE]->(m:Module)-[:CONTAINS_CHAPITRE]->(ch:Chapitre)-[:CONTAINS_CONCEPT]->(co:Concept)
            WHERE NOT EXISTS {
                MATCH (:User {id: $learnerEmail})-[:ACQUIS]->(co)
            }
            OPTIONAL MATCH (pre:Concept)-[:isPredecessorOf]->(co)
            WITH c, m, ch, co, collect(pre) AS prerequisites
            WHERE all(pre IN prerequisites WHERE EXISTS {
                MATCH (:User {id: $learnerEmail})-[:ACQUIS]->(pre)
            })
            RETURN c.id AS courseId,
                   co.id AS conceptId,
                   co.labelPedagogique AS label,
                   co.description AS description,
                   m.title AS moduleTitle,
                   ch.title AS chapitreTitle,
                   size(prerequisites) AS prerequisiteCount
            ORDER BY coalesce(m.orderIndex, 0), coalesce(ch.orderIndex, 0), coalesce(co.orderIndex, 0)
            LIMIT 1
            """;

        return neo4jClient.query(cypher)
                .bindAll(Map.of("learnerEmail", learnerEmail, "courseId", courseId))
                .fetchAs(ConceptRecommendationDto.class)
                .mappedBy((typeSystem, record) -> {
                    long prerequisiteCount = record.get("prerequisiteCount").isNull()
                            ? 0L
                            : record.get("prerequisiteCount").asLong();
                    String label = record.get("label").isNull() ? "Concept suivant" : record.get("label").asString();
                    String reason = prerequisiteCount == 0
                            ? "Ce concept est proposé car il n'a pas de prérequis et n'est pas encore maîtrisé."
                            : "Ce concept est proposé car ses prérequis sont satisfaits et il n'est pas encore maîtrisé.";

                    return ConceptRecommendationDto.builder()
                            .courseId(record.get("courseId").isNull() ? null : record.get("courseId").asString())
                            .conceptId(record.get("conceptId").isNull() ? null : record.get("conceptId").asString())
                            .label(label)
                            .description(record.get("description").isNull() ? "" : record.get("description").asString())
                            .moduleTitle(record.get("moduleTitle").isNull() ? "" : record.get("moduleTitle").asString())
                            .chapitreTitle(record.get("chapitreTitle").isNull() ? "" : record.get("chapitreTitle").asString())
                            .reason(reason)
                            .remediation("En cas d'échec, relisez le contenu du concept puis repassez le quiz.")
                            .build();
                })
                .first();
    }

    public List<Map<String, Object>> getLearningStatuses(String learnerEmail, String courseId) {
        String cypher = """
            MATCH (c:Course {id: $courseId})-[:CONTAINS_MODULE]->(m:Module)-[:CONTAINS_CHAPITRE]->(ch:Chapitre)-[:CONTAINS_CONCEPT]->(co:Concept)
            OPTIONAL MATCH (pre:Concept)-[:isPredecessorOf]->(co)
            WITH m, ch, co, collect(DISTINCT pre) AS prerequisites,
                 EXISTS { MATCH (:User {id: $learnerEmail})-[:ACQUIS]->(co) } AS mastered
            WITH m, ch, co, mastered, prerequisites,
                 [pre IN prerequisites WHERE pre IS NOT NULL AND NOT EXISTS {
                    MATCH (:User {id: $learnerEmail})-[:ACQUIS]->(pre)
                 }] AS missingPrerequisites
            RETURN co.id AS conceptId,
                   co.labelPedagogique AS label,
                   m.title AS moduleTitle,
                   ch.title AS chapitreTitle,
                   CASE
                     WHEN mastered THEN 'MASTERED'
                     WHEN size(missingPrerequisites) = 0 THEN 'LEARNABLE'
                     ELSE 'BLOCKED'
                   END AS status,
                   [pre IN missingPrerequisites | pre.id] AS missingPrerequisiteIds
            ORDER BY coalesce(m.orderIndex, 0), coalesce(ch.orderIndex, 0), coalesce(co.orderIndex, 0)
            """;

        return new java.util.ArrayList<>(neo4jClient.query(cypher)
                .bindAll(Map.of("learnerEmail", learnerEmail, "courseId", courseId))
                .fetch()
                .all());
    }

    private List<CourseSummaryDto> fetchCourseSummaries(String cypher, Map<String, Object> params) {
        return neo4jClient.query(cypher)
                .bindAll(params)
                .fetchAs(CourseSummaryDto.class)
                .mappedBy((typeSystem, record) -> CourseSummaryDto.builder()
                        .id(record.get("id").isNull() ? null : record.get("id").asString())
                        .title(record.get("title").isNull() ? "" : record.get("title").asString())
                        .description(record.get("description").isNull() ? "" : record.get("description").asString())
                        .objectifs(record.get("objectifs").isNull() ? "" : record.get("objectifs").asString())
                        .prerequisTextuels(record.get("prerequisTextuels").isNull() ? "" : record.get("prerequisTextuels").asString())
                        .teacherEmail(record.get("teacherEmail").isNull() ? "" : record.get("teacherEmail").asString())
                        .teacherName(record.get("teacherName").isNull() ? "" : record.get("teacherName").asString())
                        .createdAt(toLocalDateTime(record.get("createdAt").asObject()))
                        .status(record.get("status").isNull() ? "PUBLISHED" : record.get("status").asString())
                        .build())
                .all()
                .stream()
                .toList();
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof OffsetDateTime offsetDateTime) {
            return offsetDateTime.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        return null;
    }
}
