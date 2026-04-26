package com.ale.iam.controller;

import com.ale.iam.domain.SystemSetting;
import com.ale.iam.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
public class AdminSettingsController {

    private final SystemSettingRepository settingRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SystemSetting>> getAllSettings() {
        return ResponseEntity.ok(settingRepository.findAll());
    }

    @GetMapping("/{key}")
    // Open endpoint for internal cross-service fetching (like from content-service)
    public ResponseEntity<SystemSetting> getSettingByKey(@PathVariable String key) {
        return settingRepository.findById(key)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateSettings(@RequestBody Map<String, String> settingsUpdate) {
        settingsUpdate.forEach((key, value) -> {
            SystemSetting setting = settingRepository.findById(key)
                    .orElse(SystemSetting.builder().settingKey(key).build());
            setting.setSettingValue(value);
            settingRepository.save(setting);
        });
        return ResponseEntity.ok(Map.of("message", "Paramètres mis à jour avec succès."));
    }
}
