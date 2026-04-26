package com.ale.content.controller;

import com.ale.content.domain.CourseContent;
import com.ale.content.repository.CourseContentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/content")
@RequiredArgsConstructor
public class ContentController {

    private final CourseContentRepository contentRepository;
    private final RestTemplate restTemplate;

    private static final String UPLOAD_DIR = "/uploads/";

    @PostMapping("/upload")
    public ResponseEntity<?> uploadMedia(@RequestParam("file") MultipartFile file) {
        try {
            // 1. Check Constraint from IAM Service
            long maxUploadSizeMB = 5; // default fallback
            try {
                Map<String, String> response = restTemplate.getForObject(
                        "http://iam-service/api/admin/settings/MAX_UPLOAD_SIZE", Map.class);
                if (response != null && response.containsKey("settingValue")) {
                    maxUploadSizeMB = Long.parseLong(response.get("settingValue"));
                }
            } catch (Exception e) {
                System.out.println("Could not fetch MAX_UPLOAD_SIZE from IAM, using fallback.");
            }

            long maxSizeBytes = maxUploadSizeMB * 1024 * 1024;
            if (file.getSize() > maxSizeBytes) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body(Map.of("message", "Le fichier dépasse la limite autorisée de " + maxUploadSizeMB + " MB."));
            }

            // 2. Prepare Directory
            Path dirPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            // 3. Save file locally
            String originalFileName = file.getOriginalFilename();
            String extension = originalFileName != null && originalFileName.contains(".") 
                    ? originalFileName.substring(originalFileName.lastIndexOf(".")) : "";
            
            String uniqueFileName = UUID.randomUUID().toString() + extension;
            Path filePath = dirPath.resolve(uniqueFileName);
            
            file.transferTo(filePath.toFile());

            // 4. Return serving URL
            String fileUrl = "/api/content/uploads/" + uniqueFileName;
            return ResponseEntity.ok(Map.of("url", fileUrl));

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Erreur lors de la sauvegarde du fichier"));
        }
    }

    @PostMapping("/save")
    public ResponseEntity<?> saveContent(@RequestBody CourseContent requestData) {
        CourseContent content = contentRepository.findByConceptId(requestData.getConceptId())
                .orElse(CourseContent.builder().conceptId(requestData.getConceptId()).build());

        content.setHtmlContent(requestData.getHtmlContent());
        content.setLastUpdated(LocalDateTime.now());
        
        CourseContent saved = contentRepository.save(content);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/concept/{conceptId}")
    public ResponseEntity<?> getContentByConcept(@PathVariable String conceptId) {
        return contentRepository.findByConceptId(conceptId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
