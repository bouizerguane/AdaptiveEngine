package com.ale.iam.controller;

import com.ale.iam.domain.AppUser;
import com.ale.iam.dto.ProfileUpdateDTO;
import com.ale.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal String email) {
        AppUser user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

        return ResponseEntity.ok(Map.of(
                "nom", user.getNom(),
                "prenom", user.getPrenom(),
                "email", user.getEmail(),
                "role", user.getRole().name()
        ));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@AuthenticationPrincipal String email,
                                           @RequestBody ProfileUpdateDTO updateDTO) {
        AppUser user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

        if (updateDTO.getFirstName() != null && !updateDTO.getFirstName().trim().isEmpty()) {
            user.setNom(updateDTO.getFirstName());
        }
        
        if (updateDTO.getLastName() != null && !updateDTO.getLastName().trim().isEmpty()) {
            user.setPrenom(updateDTO.getLastName());
        }

        if (updateDTO.getNewPassword() != null && !updateDTO.getNewPassword().trim().isEmpty()) {
            if (updateDTO.getCurrentPassword() == null || updateDTO.getCurrentPassword().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Le mot de passe actuel est requis pour le modifier."));
            }
            if (!passwordEncoder.matches(updateDTO.getCurrentPassword(), user.getPassword())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Le mot de passe actuel est incorrect."));
            }
            user.setPassword(passwordEncoder.encode(updateDTO.getNewPassword()));
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "Profil mis à jour avec succès.",
                "nom", user.getNom(),
                "prenom", user.getPrenom()
        ));
    }
}
