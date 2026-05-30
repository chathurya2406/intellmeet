# IntellMeet — Security Report

## Overview

IntellMeet implements defence-in-depth security across all layers. This document covers every security control, the OWASP Top 10 mitigations, and the security checklist for production deployment.

---

## Authentication & Session Management

### JWT Access Tokens
- **Algorithm**: HS256 with a minimum 32-character secret
- **Lifetime**: 15 minutes (configurable via `JWT_EXPIRES_IN`)
- **Payload**: `{ id, email, role, v }` — `v` is the token version for invalidation
- **Storage**: Frontend stores in `localStorage` (access token only)
- **Transmission**: `Authorization: Bearer <token>` header

### Refresh Tokens
- **Lifetime**: 7 days (configurable via `REFRESH_TOKEN_EXPIRES_IN`)
- **Storage**: httpOnly, Secure, SameSite=Strict cookie — **never accessible to JavaScript**
- **Server-side validation**: bcrypt hash stored in MongoDB (`refreshTokenHash` field, `select: false`)
- **Rotation**: Every `/api/auth/refresh` call issues a new refresh token and invalidates the old one
- **Reuse detection**: If a rotated token is reused, all sessions for that user are immediately invalidated
- **Invalidation**: On logout, logout-all, and password change

### Token Version (`tokenVersion`)
- Incremented on `logout-all` and `change-password`
- All outstanding tokens with an older version are rejected
- Enables instant revocation of all sessions without a token blacklist

### Password Security
- **Hashing**: bcrypt with cost factor 12 (≈250ms per hash — brute-force resistant)
- **Minimum length**: 8 characters (enforced in route layer)
- **Never returned**: `password` field has `select: false` in Mongoose schema
- **Change flow**: Requires current password verification; invalidates all sessions on success

---

## Transport Security

### HTTPS
- All production traffic must use HTTPS (enforced at ingress/load balancer level)
- Refresh token cookie uses `Secure: true` in production
- HSTS header set by Helmet

### CORS
- Allowlist-based: only origins in `FRONTEND_URL` env var are permitted
- `credentials: true` required for cookie-based refresh tokens
- Configured methods: GET, POST, PUT, PATCH, DELETE, OPTIONS

---

## Input Security

### NoSQL Injection Prevention
- `mongoSanitizeMiddleware`: strips all keys starting with `$` or containing `.` from `req.body` and `req.params`
- Logs stripped keys as `[SECURITY]` warnings for monitoring
- Covers nested objects and arrays recursively

### XSS Prevention
- `xssSanitizeMiddleware`: escapes HTML entities in all string values of `req.body` using the `xss` library
- Helmet sets `Content-Security-Policy` restricting script sources to `'self'`
- `X-XSS-Protection` header set by Helmet

### Body Size Limit
- `express.json({ limit: "10kb" })` — prevents large payload DoS attacks

### Input Validation
- All route handlers validate types, lengths, and formats before touching the database
- Mongoose schema validators provide a second layer of validation

---

## Security Headers (Helmet)

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; connect-src 'self' wss: ws:` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` |
| `Referrer-Policy` | `no-referrer` |
| `X-DNS-Prefetch-Control` | `off` |
| `Cross-Origin-Embedder-Policy` | Disabled (required for WebRTC) |

---

## Rate Limiting

| Endpoint | Limit | Window | Purpose |
|---|---|---|---|
| `/api/auth/*` | 10 requests | 15 minutes | Brute-force prevention |
| `/api/*` | 100 requests | 15 minutes | API abuse prevention |
| `/metrics` | 30 requests | 1 minute | Scraping abuse prevention |

Rate limit headers returned: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

---

## Audit Logging

All sensitive actions are logged to both stdout (structured JSON) and MongoDB:

| Action | Trigger |
|---|---|
| `USER_SIGNUP` | New account created |
| `USER_LOGIN` | Successful login |
| `USER_LOGIN_FAILED` | Failed login attempt (wrong password or unknown email) |
| `USER_LOGOUT` | User logged out |
| `USER_LOGOUT_ALL` | All sessions invalidated |
| `USER_PROFILE_UPDATE` | Name, avatar, or password changed |
| `MEETING_START` | Meeting started via API |
| `MEETING_END` | Meeting ended via API |
| `MEETING_JOIN` | User joined via Socket.io |
| `MEETING_LEAVE` | User left via Socket.io |
| `AI_SUMMARY_SAVED` | AI summary saved to meeting |

Audit logs include: `userId`, `email`, `ip`, `userAgent`, `success`, `meta`, `timestamp`

Audit logs auto-expire after **90 days** (TTL index).

---

## Error Handling

- Stack traces **never** returned in production responses
- Generic error messages for auth failures (no user enumeration)
- Mongoose errors mapped to appropriate HTTP status codes
- All unhandled exceptions captured by Sentry (when `SENTRY_DSN` is set)

---

## OWASP Top 10 Mitigations

| # | Risk | Mitigation |
|---|---|---|
| A01 | Broken Access Control | `authMiddleware` on all protected routes; `requireRole()` for RBAC |
| A02 | Cryptographic Failures | bcrypt 12 rounds; JWT HS256; httpOnly cookies; HTTPS enforced |
| A03 | Injection | MongoDB sanitization; XSS sanitization; parameterized Mongoose queries |
| A04 | Insecure Design | Refresh token rotation; token version invalidation; audit logging |
| A05 | Security Misconfiguration | Helmet headers; CORS allowlist; body size limits; env var validation at startup |
| A06 | Vulnerable Components | `npm audit` in CI pipeline; pinned dependency versions |
| A07 | Auth Failures | Rate limiting on auth; bcrypt; refresh token rotation; reuse detection |
| A08 | Software Integrity | Docker multi-stage builds; non-root container user |
| A09 | Logging Failures | Structured JSON audit logs; Sentry error tracking; Prometheus metrics |
| A10 | SSRF | No outbound HTTP requests from user input; no URL fetching |

---

## Socket.io Security

- Every socket connection authenticated via JWT in `socket.handshake.auth.token`
- `socketAuthMiddleware` rejects connections with invalid/expired tokens
- Socket events validate all input before database operations
- Message length capped at 2000 characters
- Meeting ID validated as non-empty string before room join

---

## Container Security

- Multi-stage Docker build (no dev dependencies in production image)
- Non-root user (`nodeuser`, UID 1001) in production container
- `NODE_ENV=production` set in Dockerfile
- No secrets in Dockerfile or docker-compose.yml (all via env vars)
- `.dockerignore` excludes `node_modules`, `.env`, `coverage`, logs

---

## Kubernetes Security

- Secrets stored in Kubernetes `Secret` objects (not ConfigMaps)
- Resource limits set on all containers (CPU: 500m, Memory: 512Mi)
- Health checks prevent unhealthy pods from receiving traffic
- Rolling update strategy prevents downtime during deployments

---

## Production Security Checklist

- [ ] `JWT_SECRET` is a cryptographically random string (≥32 chars): `openssl rand -hex 48`
- [ ] `REFRESH_TOKEN_SECRET` is different from `JWT_SECRET`
- [ ] `NODE_ENV=production` is set
- [ ] `MONGO_URI` points to an authenticated MongoDB instance
- [ ] MongoDB is not publicly accessible (firewall/VPC)
- [ ] HTTPS/TLS is configured at the ingress/load balancer
- [ ] `FRONTEND_URL` is set to the production domain only
- [ ] `SENTRY_DSN` is configured for error tracking
- [ ] `npm audit` passes with no high/critical vulnerabilities
- [ ] Docker image uses non-root user
- [ ] Kubernetes secrets are not committed to version control
- [ ] Database backups are enabled and tested
- [ ] Rate limiting is tuned for expected production traffic
- [ ] Audit log TTL is set per compliance requirements (default: 90 days)
- [ ] Monitoring and alerting are configured

---

## Dependency Audit

Run regularly:
```bash
cd backend && npm audit --audit-level=moderate
cd frontend && npm audit --audit-level=moderate
```

The CI pipeline runs `npm audit --audit-level=moderate` on every push to `main`.

---

## Reporting Security Issues

Please report security vulnerabilities to **security@intellmeet.com** — do not open public GitHub issues for security bugs.
