# IntellMeet — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                               │
│                                                                         │
│  React 19 + Vite + Tailwind CSS v4                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  AuthContext  │  │  Socket.io   │  │  WebRTC      │                  │
│  │  JWT + Cookie │  │  Client      │  │  PeerConn    │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                  │                          │
└─────────┼─────────────────┼──────────────────┼──────────────────────────┘
          │ HTTPS REST       │ WSS               │ P2P (STUN/TURN)
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Node.js 20)                             │
│                                                                         │
│  Express 5                          Socket.io 4                         │
│  ┌─────────────────────────┐        ┌──────────────────────────────┐    │
│  │  Middleware Stack        │        │  Socket Middleware            │    │
│  │  Helmet → CORS → Body   │        │  socketAuthMiddleware (JWT)   │    │
│  │  CookieParser → Sanitize│        └──────────────────────────────┘    │
│  │  Metrics → RateLimit    │                                            │
│  └─────────────────────────┘        ┌──────────────────────────────┐    │
│                                     │  Socket Events               │    │
│  ┌─────────────────────────┐        │  join-room → chat-message    │    │
│  │  REST Routes             │        │  webrtc-offer/answer/ice     │    │
│  │  /api/auth/*             │        │  leave-room → disconnect     │    │
│  │  /api/meetings/*         │        └──────────────────────────────┘    │
│  │  /health  /metrics       │                                            │
│  └─────────────────────────┘                                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Mongoose ODM                                                    │    │
│  │  User  Meeting  Message  AuditLog                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MongoDB                                         │
│  Collections: users  meetings  messages  auditlogs                      │
│  Indexes: compound, TTL, sparse                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
Browser                    Backend                    MongoDB
  │                           │                          │
  │── POST /api/auth/login ──►│                          │
  │                           │── findOne({ email }) ──►│
  │                           │◄── user doc ─────────────│
  │                           │── bcrypt.compare() ──────│
  │                           │── issueTokens()           │
  │                           │   ├─ sign accessToken (15m)
  │                           │   ├─ sign refreshToken (7d)
  │                           │   └─ bcrypt.hash(refresh) → DB
  │◄── { token } + Set-Cookie─│                          │
  │    (httpOnly refresh)      │                          │
  │                           │                          │
  │── GET /api/auth/profile ──►│                          │
  │   Authorization: Bearer   │── findById(id) ─────────►│
  │◄── { user } ──────────────│◄── user doc ─────────────│
  │                           │                          │
  │── POST /api/auth/refresh ─►│  (cookie sent auto)      │
  │                           │── jwt.verify(cookie)      │
  │                           │── bcrypt.compare(hash) ──►│
  │                           │── issueTokens() (rotate) ─│
  │◄── { token } + new cookie─│                          │
```

---

## WebRTC Signaling Flow

```
User A (Initiator)          Server (Relay)          User B (Receiver)
     │                          │                         │
     │── join-room ────────────►│                         │
     │                          │── user-joined ─────────►│
     │                          │   (to User A)           │
     │◄── user-joined ──────────│                         │
     │   (User B joined)        │                         │
     │                          │                         │
     │── createOffer() ─────────│                         │
     │── webrtc-offer ─────────►│── webrtc-offer ────────►│
     │                          │                         │── createAnswer()
     │                          │◄── webrtc-answer ───────│
     │◄── webrtc-answer ────────│                         │
     │                          │                         │
     │── webrtc-ice-candidate ─►│── webrtc-ice-candidate ►│
     │◄── webrtc-ice-candidate ─│◄── webrtc-ice-candidate─│
     │                          │                         │
     │◄══════════ P2P Media Stream (direct) ══════════════►│
```

---

## Database Schema

### users
```
_id          ObjectId  PK
name         String    required, 2-100 chars
email        String    unique, lowercase
password     String    bcrypt hash, select:false
role         String    enum: user|admin
avatar       String    nullable
lastLogin    Date      nullable
refreshTokenHash String nullable, select:false
tokenVersion Number    default:0
createdAt    Date      auto
updatedAt    Date      auto

Indexes:
  email: unique
  lastLogin: sparse desc
  role: asc
```

### meetings
```
_id                  ObjectId  PK
meetingId            String    unique, human-readable room ID
status               String    enum: active|ended
startTime            Date      required
endTime              Date      nullable
durationSeconds      Number    nullable
participants         String[]  display names, max 500
participantIds       ObjectId[] refs to users, max 500
createdBy            ObjectId  ref to user
aiSummary            String    nullable, max 10000
actionItems          ActionItem[] max 100
recordingMetadata    RecordingMetadata nullable
peakParticipantCount Number    denormalized
createdAt            Date      auto
updatedAt            Date      auto

Indexes:
  meetingId: unique
  { status, createdAt }: compound desc
  { createdBy, status, createdAt }: compound desc
  endTime: sparse desc
```

### messages
```
_id       ObjectId  PK
meetingId String    required
sender    String    default: Guest
userId    ObjectId  ref to user, nullable
text      String    required, max 2000
createdAt Date      auto
updatedAt Date      auto

Indexes:
  { meetingId, createdAt }: compound asc  ← primary query
  { userId, createdAt }: sparse desc
```

### auditlogs
```
_id       ObjectId  PK
action    String    enum: USER_SIGNUP|USER_LOGIN|USER_LOGOUT|...
userId    ObjectId  ref to user, nullable
email     String    nullable
meetingId String    nullable
ip        String    nullable
userAgent String    nullable
meta      Mixed     {}
success   Boolean   default: true
createdAt Date      auto (TTL: 90 days)

Indexes:
  createdAt: TTL 90 days
  { userId, createdAt }: compound desc
  { meetingId, createdAt }: compound desc
  { action, createdAt }: compound desc
  { success, ip, createdAt }: compound desc
  { email, createdAt }: sparse desc
```

---

## Security Architecture

```
Request
  │
  ▼
Helmet (CSP, HSTS, X-Frame-Options, ...)
  │
  ▼
CORS (allowlist: FRONTEND_URL env var)
  │
  ▼
Body Parser (limit: 10kb — DoS prevention)
  │
  ▼
Cookie Parser (httpOnly refresh token)
  │
  ▼
mongoSanitizeMiddleware (strip $, . keys)
  │
  ▼
xssSanitizeMiddleware (escape HTML in body)
  │
  ▼
Rate Limiter
  ├─ /api/auth/*  → 10 req / 15 min
  ├─ /api/*       → 100 req / 15 min
  └─ /metrics     → 30 req / 1 min
  │
  ▼
authMiddleware (JWT Bearer verification)
  │
  ▼
Route Handler
  │
  ▼
AuditLogger (async, fire-and-forget)
  │
  ▼
Response
```

---

## Deployment Architecture

```
Internet
  │
  ▼
Ingress (nginx-ingress-controller)
  │  TLS termination
  │  WebSocket upgrade (socket.io)
  │
  ▼
Kubernetes Service (ClusterIP)
  │
  ▼
Deployment (2-10 replicas via HPA)
  │  Rolling update strategy
  │  Liveness: GET /health
  │  Readiness: GET /health
  │
  ▼
Pod (intellmeet-backend)
  │  node:20-alpine
  │  non-root user
  │  resource limits: 500m CPU, 512Mi RAM
  │
  ▼
MongoDB (Atlas or self-hosted)
  │  Connection pool: 10 max
  │  Replica set for HA
```

---

## Monitoring Stack

```
Backend (/metrics)
  │
  ▼
Prometheus (scrape every 15s)
  │  intellmeet_http_requests_total
  │  intellmeet_http_request_duration_seconds
  │  intellmeet_active_meetings
  │  intellmeet_active_users
  │  process_* (default Node.js metrics)
  │
  ▼
Grafana (dashboards)
  │  API Request Rate
  │  Response Time P95
  │  Active Meetings
  │  Active Users
  │  Error Rate
  │  Memory / CPU
```

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 19 |
| Frontend Build | Vite | 8 |
| CSS | Tailwind CSS | 4 |
| Frontend Routing | React Router | 6 |
| Real-time Client | Socket.io-client | 4 |
| Backend Runtime | Node.js | 20 |
| Backend Framework | Express | 5 |
| Database ODM | Mongoose | 9 |
| Real-time Server | Socket.io | 4 |
| Authentication | jsonwebtoken | 9 |
| Password Hashing | bcryptjs | 2 |
| Security Headers | Helmet | 8 |
| Rate Limiting | express-rate-limit | 8 |
| Metrics | prom-client | 14 |
| Error Tracking | @sentry/node | 8 |
| Testing | Jest + Supertest | 29 |
| Containerization | Docker | — |
| Orchestration | Kubernetes | 1.30 |
| Package Manager | Helm | 3 |
| CI/CD | GitHub Actions | — |
| Monitoring | Prometheus + Grafana | — |
| Load Testing | k6 | — |
