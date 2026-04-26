package com.ale.graph.service;

import com.ale.graph.dto.CourseSummaryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CourseEnrollmentService {

    private final Neo4jClient neo4jClient;

    public List<CourseSummaryDto> getAvailableCourses() {
        String cypher = """
            MATCH (c:Course)
            WHERE c.status IS NULL OR c.status = 'PUBLISHED'
            RETURN c.id AS id,
                   c.title AS title,
                   c.description AS description,
                   c.authorEmail AS teacherEmail,
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
                toLower(coalesce(c.authorEmail, '')) CONTAINS $query
              )
            RETURN c.id AS id,
                   c.title AS title,
                   c.description AS description,
                   c.authorEmail AS teacherEmail,
                   c.createdAt AS createdAt,
                   coalesce(c.status, 'PUBLISHED') AS status
            ORDER BY c.title
            """;

        return fetchCourseSummaries(cypher, Map.of("query", normalizedQuery));
    }

    public boolean enroll(String courseId, String learnerEmail) {
        String cypher = """
            MATCH (c:Course {id: $courseId})
            WHERE c.status IS NULL OR c.status = 'PUBLISHED'
            MERGE (l:Learner {email: $learnerEmail})
            MERGE (l)-[r:ENROLLED_IN]->(c)
            ON CREATE SET r.enrolledAt = datetime()
            RETURN count(r) AS enrolled
            """;

        Long enrolled = neo4jClient.query(cypher)
                .bindAll(Map.of("courseId", courseId, "learnerEmail", learnerEmail))
                .fetchAs(Long.class)
                .mappedBy((typeSystem, record) -> record.get("enrolled").asLong())
                .first()
                .orElse(0L);

        return enrolled > 0;
    }

    public List<CourseSummaryDto> getEnrolledCourses(String learnerEmail) {
        String cypher = """
            MATCH (:Learner {email: $learnerEmail})-[:ENROLLED_IN]->(c:Course)
            RETURN c.id AS id,
                   c.title AS title,
                   c.description AS description,
                   c.authorEmail AS teacherEmail,
                   c.createdAt AS createdAt,
                   coalesce(c.status, 'PUBLISHED') AS status
            ORDER BY c.title
            """;

        return fetchCourseSummaries(cypher, Map.of("learnerEmail", learnerEmail));
    }

    private List<CourseSummaryDto> fetchCourseSummaries(String cypher, Map<String, Object> params) {
        return neo4jClient.query(cypher)
                .bindAll(params)
                .fetchAs(CourseSummaryDto.class)
                .mappedBy((typeSystem, record) -> CourseSummaryDto.builder()
                        .id(record.get("id").isNull() ? null : record.get("id").asString())
                        .title(record.get("title").isNull() ? "" : record.get("title").asString())
                        .description(record.get("description").isNull() ? "" : record.get("description").asString())
                        .teacherEmail(record.get("teacherEmail").isNull() ? "" : record.get("teacherEmail").asString())
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
