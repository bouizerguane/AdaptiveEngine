package com.ale.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.List;

@Component
public class JwtGatewayFilter implements GlobalFilter, Ordered {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        HttpMethod method = request.getMethod();

        if (isPublic(path, method)) {
            return chain.filter(exchange);
        }

        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return reject(exchange, HttpStatus.UNAUTHORIZED);
        }

        Claims claims;
        try {
            claims = Jwts.parserBuilder()
                    .setSigningKey(signingKey())
                    .build()
                    .parseClaimsJws(authHeader.substring(7))
                    .getBody();
        } catch (Exception ex) {
            return reject(exchange, HttpStatus.UNAUTHORIZED);
        }

        String email = claims.getSubject();
        String role = normalizeRole(claims.get("role", String.class));

        if (email == null || email.isBlank() || role == null) {
            return reject(exchange, HttpStatus.UNAUTHORIZED);
        }

        if (!isAllowed(path, method, role)) {
            return reject(exchange, HttpStatus.FORBIDDEN);
        }

        ServerHttpRequest securedRequest = request.mutate()
                .headers(headers -> {
                    headers.remove("X-User-Email");
                    headers.remove("X-User-Role");
                    headers.add("X-User-Email", email);
                    headers.add("X-User-Role", role);
                })
                .build();

        return chain.filter(exchange.mutate().request(securedRequest).build());
    }

    @Override
    public int getOrder() {
        return -100;
    }

    private boolean isPublic(String path, HttpMethod method) {
        if (HttpMethod.OPTIONS.equals(method)) return true;
        if (path.equals("/actuator/health") || path.equals("/actuator/info")) return true;
        if (HttpMethod.GET.equals(method) && path.startsWith("/api/content/uploads/")) return true;
        return HttpMethod.POST.equals(method)
                && List.of("/api/auth/login", "/api/auth/signup", "/api/auth/register").contains(path);
    }

    private boolean isAllowed(String path, HttpMethod method, String role) {
        if (path.startsWith("/api/user/")) {
            return isAuthenticatedRole(role);
        }

        if (path.startsWith("/api/admin/settings/") && HttpMethod.GET.equals(method)) {
            return isAuthenticatedRole(role);
        }

        if (path.startsWith("/api/admin/")
                || path.startsWith("/api/graph/admin/")
                || path.startsWith("/api/content/admin/")) {
            return isAdmin(role);
        }

        if (path.startsWith("/api/tracking/dashboard/")) {
            return isTeacher(role) || isAdmin(role);
        }

        if (path.startsWith("/api/tracking/adaptive-refresh/")) {
            return isStudent(role) || isTeacher(role) || isAdmin(role);
        }

        if (path.startsWith("/api/tracking/recommendation-traces/")) {
            return isTeacher(role) || isAdmin(role);
        }

        if (path.startsWith("/api/adaptive/")) {
            return isStudent(role) || isTeacher(role) || isAdmin(role);
        }

        if (path.startsWith("/api/tutoring/")) {
            return isStudent(role) || isTeacher(role) || isAdmin(role);
        }

        if (path.matches("^/api/labs/[^/]+/submissions$")) {
            return HttpMethod.GET.equals(method) && (isTeacher(role) || isAdmin(role));
        }

        if (path.startsWith("/api/labs/")) {
            return isStudent(role) || isTeacher(role) || isAdmin(role);
        }

        if (path.matches("^/api/graph/courses/[^/]+/enrollments.*")) {
            return isTeacher(role) || isAdmin(role);
        }

        if (path.matches("^/api/graph/mastery/teacher/.*")) {
            return isTeacher(role) || isAdmin(role);
        }

        if (path.startsWith("/api/graph/mastery/validate-")) {
            return HttpMethod.POST.equals(method) && isStudent(role);
        }

        if (path.matches("^/api/graph/courses/[^/]+/enroll$")) {
            return HttpMethod.POST.equals(method) && isStudent(role);
        }

        if (isGraphWrite(path, method) || isContentWrite(path, method)) {
            return isTeacher(role) || isAdmin(role);
        }

        if (path.startsWith("/api/graph/") && HttpMethod.GET.equals(method)) {
            return isAuthenticatedRole(role);
        }

        if (path.startsWith("/api/content/") && HttpMethod.GET.equals(method)) {
            return isAuthenticatedRole(role);
        }

        if (path.startsWith("/api/traces/")
                || path.equals("/api/traces")
                || path.startsWith("/api/graph/adaptive/")
                || path.startsWith("/api/graph/recommendations/")
                || path.matches("^/api/graph/mastery/concepts/.*")) {
            return isStudent(role) || isTeacher(role) || isAdmin(role);
        }

        return false;
    }

    private boolean isGraphWrite(String path, HttpMethod method) {
        if (!(HttpMethod.POST.equals(method) || HttpMethod.PUT.equals(method) || HttpMethod.DELETE.equals(method))) {
            return false;
        }
        return path.startsWith("/api/graph/courses")
                || path.startsWith("/api/graph/modules")
                || path.startsWith("/api/graph/chapitres")
                || path.startsWith("/api/graph/concepts")
                || path.startsWith("/api/graph/nodes/positions");
    }

    private boolean isContentWrite(String path, HttpMethod method) {
        if (!(HttpMethod.POST.equals(method) || HttpMethod.DELETE.equals(method))) {
            return false;
        }
        return path.startsWith("/api/content/save")
                || path.startsWith("/api/content/upload")
                || path.startsWith("/api/content/evaluations")
                || path.startsWith("/api/content/labs");
    }

    private Mono<Void> reject(ServerWebExchange exchange, HttpStatus status) {
        exchange.getResponse().setStatusCode(status);
        return exchange.getResponse().setComplete();
    }

    private Key signingKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) return null;
        return role.startsWith("ROLE_") ? role : "ROLE_" + role;
    }

    private boolean isAdmin(String role) {
        return "ROLE_ADMIN".equals(role);
    }

    private boolean isTeacher(String role) {
        return "ROLE_TEACHER".equals(role);
    }

    private boolean isStudent(String role) {
        return "ROLE_STUDENT".equals(role) || "ROLE_LEARNER".equals(role);
    }

    private boolean isAuthenticatedRole(String role) {
        return isStudent(role) || isTeacher(role) || isAdmin(role);
    }
}
