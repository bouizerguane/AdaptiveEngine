package com.ale.iam;

import com.ale.iam.domain.AppUser;
import com.ale.iam.domain.RoleType;
import com.ale.iam.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminDefaultPassword;
    private final boolean adminResetOnStartup;

    public DataSeeder(UserRepository userRepository,
                      PasswordEncoder passwordEncoder,
                      @Value("${ADMIN_DEFAULT_PASSWORD:change_me_admin_password}") String adminDefaultPassword,
                      @Value("${ADMIN_RESET_ON_STARTUP:false}") boolean adminResetOnStartup) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminDefaultPassword = adminDefaultPassword;
        this.adminResetOnStartup = adminResetOnStartup;
    }

    @Override
    public void run(String... args) throws Exception {
        userRepository.findByEmail("admin@system.com").ifPresentOrElse(admin -> {
            if (adminResetOnStartup) {
                admin.setPassword(passwordEncoder.encode(adminDefaultPassword));
                admin.setRole(RoleType.ADMIN);
                admin.setEstApprouve(true);
                userRepository.save(admin);
                log.info("Default admin password reset because ADMIN_RESET_ON_STARTUP=true");
            }
        }, () -> {
            AppUser admin = new AppUser();
            admin.setNom("System");
            admin.setPrenom("Admin");
            admin.setEmail("admin@system.com");
            admin.setPassword(passwordEncoder.encode(adminDefaultPassword));
            admin.setRole(RoleType.ADMIN);
            admin.setEstApprouve(true); // Super Admin auto-approuvé
            
            userRepository.save(admin);
            log.info("Compte admin de developpement cree : admin@system.com / mot de passe configure via ADMIN_DEFAULT_PASSWORD");
        });
    }
}
