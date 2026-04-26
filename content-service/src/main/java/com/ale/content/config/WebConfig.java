package com.ale.content.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Map any request to /uploads/** to the local /data/uploads directory.
        // During dev, this maps to a generic fallback if /data/uploads isn't writable on Windows, 
        // so we use a relative path fallback.
        registry.addResourceHandler("/api/content/uploads/**")
                .addResourceLocations("file:/uploads/", "file:/data/uploads/", "file:uploads/");
    }
}
