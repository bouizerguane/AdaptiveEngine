package com.ale.iam.controller;

import com.ale.iam.domain.AppUser;
import com.ale.iam.domain.RoleType;
import com.ale.iam.repository.UserRepository;
import com.ale.iam.security.JwtUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Registration and JWT authentication endpoints.")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtUtils jwtUtils;

    @PostMapping("/signup")
    @Operation(
            summary = "Register a user account",
            description = "Creates a pending user account that must be approved before login.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "User registered"),
                    @ApiResponse(responseCode = "400", description = "Email already exists", content = @Content)
            })
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("message", "L'email est déjà pris."));
        }

        AppUser user = new AppUser();
        user.setNom(signUpRequest.getNom());
        user.setPrenom(signUpRequest.getPrenom());
        user.setEmail(signUpRequest.getEmail());
        user.setPassword(encoder.encode(signUpRequest.getPassword()));
        user.setRole(RoleType.valueOf(signUpRequest.getRole().toUpperCase()));
        user.setEstApprouve(false);

        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Utilisateur enregistre avec succes. En attente de validation."));
    }

    @PostMapping("/login")
    @Operation(
            summary = "Authenticate a user",
            description = "Validates credentials and returns a JWT token with the user identity and role.",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Authenticated"),
                    @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content),
                    @ApiResponse(responseCode = "403", description = "Account pending approval", content = @Content),
                    @ApiResponse(responseCode = "404", description = "User not found", content = @Content)
            })
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        AppUser user = userRepository.findByEmail(loginRequest.getEmail()).orElse(null);

        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Vous n’êtes pas encore inscrit."));
        }

        if (!encoder.matches(loginRequest.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Email ou mot de passe incorrect."));
        }

        if (!user.getEstApprouve()) {
            return ResponseEntity.status(403).body(Map.of("message", "Votre compte est en attente de validation."));
        }

        String jwt = jwtUtils.generateJwtToken(user.getEmail(), user.getRole().name());

        return ResponseEntity.ok(Map.of(
                "token", jwt,
                "email", user.getEmail(),
                "nom", user.getNom(),
                "prenom", user.getPrenom(),
                "role", user.getRole().name()
        ));
    }
}

@Data
class LoginRequest {
    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String password;
}

@Data
class SignupRequest {
    @NotBlank
    private String nom;

    @NotBlank
    private String prenom;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(min = 6, message = "Le mot de passe doit faire au moins 6 caractères")
    private String password;

    @NotBlank
    private String role;
}
