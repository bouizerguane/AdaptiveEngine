package com.ale.iam.dto;

import lombok.Data;

@Data
public class ProfileUpdateDTO {
    private String firstName;
    private String lastName;
    private String currentPassword;
    private String newPassword;
}
