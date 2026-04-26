package com.ale.tracking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class TrackingApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrackingApplication.class, args);
    }
}
