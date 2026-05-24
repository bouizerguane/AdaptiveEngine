package com.ale.content.controller;

import com.ale.content.domain.CourseContent;
import com.ale.content.repository.CourseContentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/content")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Content", description = "Course content and media upload endpoints.")
public class ContentController {

    private final CourseContentRepository contentRepository;
    private final RestTemplate restTemplate;

    private static final String UPLOAD_DIR = "/uploads/";
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".pdf");

    @Value("${services.iam.url}")
    private String iamServiceUrl;

    @PostMapping("/upload")
    @Operation(summary = "Upload a media file", description = "Supports images, videos and PDF files.", responses = {
            @ApiResponse(responseCode = "200", description = "File uploaded"),
            @ApiResponse(responseCode = "403", description = "Teacher or admin role required"),
            @ApiResponse(responseCode = "415", description = "Unsupported media type")
    })
    public ResponseEntity<?> uploadMedia(
            @RequestParam("file") MultipartFile file,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isTeacherOrAdmin(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Rôle TEACHER requis."));
        }
        try {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Le fichier est vide."));
            }

            String originalFileName = file.getOriginalFilename();
            String extension = originalFileName != null && originalFileName.contains(".")
                    ? originalFileName.substring(originalFileName.lastIndexOf(".")).toLowerCase(Locale.ROOT)
                    : "";
            String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            if (!isSupportedMedia(contentType, extension)) {
                return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(Map.of(
                        "message", "Format non pris en charge. Formats acceptés : image, vidéo MP4/WebM ou PDF."
                ));
            }

            long maxUploadSizeMB = 5;
            try {
                Map<String, String> response = restTemplate.getForObject(
                        iamServiceUrl + "/api/admin/settings/MAX_UPLOAD_SIZE", Map.class);
                if (response != null && response.containsKey("settingValue")) {
                    maxUploadSizeMB = Long.parseLong(response.get("settingValue"));
                }
            } catch (Exception e) {
                log.warn("Could not fetch MAX_UPLOAD_SIZE from IAM, using fallback.");
            }

            long maxSizeBytes = maxUploadSizeMB * 1024 * 1024;
            if (file.getSize() > maxSizeBytes) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body(Map.of("message", "Le fichier dépasse la limite autorisée de " + maxUploadSizeMB + " MB."));
            }

            Path dirPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            String uniqueFileName = UUID.randomUUID() + extension;
            Path filePath = dirPath.resolve(uniqueFileName);
            file.transferTo(filePath.toFile());

            String fileUrl = "/api/content/uploads/" + uniqueFileName;
            return ResponseEntity.ok(Map.of("url", fileUrl, "fileName", uniqueFileName, "contentType", contentType));

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Erreur lors de la sauvegarde du fichier."));
        }
    }

    @PostMapping("/save")
    @Operation(summary = "Save rich HTML content for a concept")
    public ResponseEntity<?> saveContent(
            @RequestBody CourseContent requestData,
            @Parameter(hidden = true) @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        if (hasGatewayRole(userRole) && !isTeacherOrAdmin(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Rôle TEACHER requis."));
        }
        if (requestData.getConceptId() == null || requestData.getConceptId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "conceptId est obligatoire."));
        }

        log.info("[ContentController] saveContent conceptId={}, htmlLength={}",
                requestData.getConceptId(), requestData.getHtmlContent() == null ? 0 : requestData.getHtmlContent().length());

        CourseContent content = contentRepository.findByConceptId(requestData.getConceptId())
                .orElse(CourseContent.builder().conceptId(requestData.getConceptId()).build());

        content.setHtmlContent(requestData.getHtmlContent() == null ? "" : requestData.getHtmlContent());
        content.setLastUpdated(LocalDateTime.now());

        CourseContent saved = contentRepository.save(content);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/concept/{conceptId}")
    @Operation(summary = "Get content by concept")
    public ResponseEntity<?> getContentByConcept(@PathVariable String conceptId) {
        return contentRepository.findByConceptId(conceptId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    private boolean hasGatewayRole(String role) {
        return role != null && !role.isBlank();
    }

    private boolean isTeacherOrAdmin(String role) {
        return "ROLE_TEACHER".equals(role) || "TEACHER".equals(role)
                || "ROLE_ADMIN".equals(role) || "ADMIN".equals(role);
    }

    private boolean isSupportedMedia(String contentType, String extension) {
        boolean supportedMime = contentType.startsWith("image/")
                || contentType.equals("video/mp4")
                || contentType.equals("video/webm")
                || contentType.equals("application/pdf");
        return supportedMime || ALLOWED_EXTENSIONS.contains(extension);
    }
}
