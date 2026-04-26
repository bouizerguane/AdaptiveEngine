package com.ale.iam.dto;

import com.ale.iam.domain.RoleType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserUpdateRequest {
    private String nom;
    private String prenom;
    private RoleType role;
}
