package com.ale.iam;

import com.ale.iam.domain.AppUser;
import com.ale.iam.domain.RoleType;
import com.ale.iam.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminDefaultPassword;

    public DataSeeder(UserRepository userRepository,
                      PasswordEncoder passwordEncoder,
                      @Value("${ADMIN_DEFAULT_PASSWORD:change_me_admin_password}") String adminDefaultPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminDefaultPassword = adminDefaultPassword;
    }

    @Override
    public void run(String... args) throws Exception {
        if (!userRepository.existsByEmail("admin@system.com")) {
            AppUser admin = new AppUser();
            admin.setNom("System");
            admin.setPrenom("Admin");
            admin.setEmail("admin@system.com");
            admin.setPassword(passwordEncoder.encode(adminDefaultPassword));
            admin.setRole(RoleType.ADMIN);
            admin.setEstApprouve(true); // Super Admin auto-approuvé
            
            userRepository.save(admin);
            System.out.println("COMPTE ADMIN CRÉÉ AVEC SUCCÈS : admin@system.com / mot de passe configuré via ADMIN_DEFAULT_PASSWORD");
        }
    }
}
