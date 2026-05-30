# IntellMeet — AI-Powered Meeting & Collaboration Platform

[![CI](https://github.com/your-org/intellmeet/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/intellmeet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

IntellMeet is a production-grade, enterprise MERN application providing real-time video meetings, persistent chat, WebRTC peer-to-peer video, AI meeting summaries, action item tracking, and a full analytics dashboard.

---

## Features

| Feature | Status |
|---|---|
| JWT Authentication + Refresh Tokens | ✅ |
| User Profiles (name, avatar, password change) | ✅ |
| Real-time Meetings via Socket.io | ✅ |
| WebRTC Video Calls (multi-participant) | ✅ |
| Screen Sharing | ✅ |
| Persistent Chat with History | ✅ |
| AI Meeting Summary + Action Items | ✅ |
| Meeting Analytics Dashboard | ✅ |
| Meeting History with Pagination | ✅ |
| Prometheus Metrics | ✅ |
| Sentry Error Tracking | ✅ |
| Audit Logging | ✅ |
| Rate Limiting + Input Sanitization | ✅ |
| Docker + Docker Compose | ✅ |
| Kubernetes Manifests | ✅ |
| Helm Charts | ✅ |
| GitHub Actions CI/CD | ✅ |
| Grafana Dashboards | ✅ |
| k6 Load Tests | ✅ |
| 76 Integration Tests | ✅ |

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- npm 9+

### 1. Clone and install

```bash
git clone https://github.com/your-org/intellmeet.git
cd intellmeet
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET and REFRESH_TOKEN_SECRET
# Leave MONGO_URI commented out to use in-memory MongoDB
npm install
npm run dev
```

Backend starts at **http://localhost:5000**

### 3. Frontend setup (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at **http://localhost:5173**

### 4. Open the app

Navigate to **http://localhost:5173**, create an account, and start a meeting.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `MONGO_URI` | No | In-memory | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Access token secret (min 32 chars) |
| `REFRESH_TOKEN_SECRET` | **Yes** | — | Refresh token secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS allowed origin |
| `SENTRY_DSN` | No | — | Sentry error tracking DSN |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_BACKEND_URL` | No | `http://localhost:5000` | Backend API URL |

---

## Project Structure

```
intellmeet/
├── backend/                  # Express + Socket.io + MongoDB
│   ├── config/db.js          # MongoDB connection with pooling
│   ├── middleware/           # auth, rateLimiter, sanitize, metrics, errorHandler, auditLogger
│   ├── models/               # User, Meeting, Message, AuditLog
│   ├── routes/               # auth.js, meetings.js
│   ├── tests/                # 76 integration tests
│   └── server.js             # Main server + Socket.io + WebRTC signaling
├── frontend/                 # React 19 + Vite + Tailwind CSS v4
│   └── src/
│       ├── context/          # AuthContext (JWT + refresh token management)
│       ├── pages/            # Home, Login, Signup, Dashboard, MeetingRoom, Profile, History, Analytics
│       ├── components/       # Navbar, Controls, ChatBox, VideoCard, ProtectedRoute
│       └── socket/           # Authenticated Socket.io client
├── k8s/                      # Kubernetes manifests
├── helm/                     # Helm chart
├── grafana/                  # Grafana dashboard JSON
├── monitoring/               # Prometheus config
├── loadtests/                # k6 load test scripts
├── .github/workflows/        # CI + Deploy GitHub Actions
├── docker-compose.yml        # Full stack Docker Compose
└── Dockerfile                # Multi-stage backend image
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns access token + sets refresh cookie |
| POST | `/api/auth/refresh` | Cookie | Rotate refresh token, get new access token |
| POST | `/api/auth/logout` | Bearer | Invalidate session |
| POST | `/api/auth/logout-all` | Bearer | Invalidate all sessions |
| GET | `/api/auth/profile` | Bearer | Get current user profile |
| PUT | `/api/auth/profile` | Bearer | Update name/avatar |
| PUT | `/api/auth/change-password` | Bearer | Change password (invalidates all sessions) |

### Meetings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/meetings` | Bearer | Paginated meeting history |
| POST | `/api/meetings/:id/start` | Bearer | Start/join a meeting |
| GET | `/api/meetings/:id` | Bearer | Get meeting + chat history |
| POST | `/api/meetings/:id/end` | Bearer | End a meeting |
| GET | `/api/meetings/:id/analytics` | Bearer | Meeting analytics |
| POST | `/api/meetings/:id/ai-summary` | Bearer | Save AI summary + action items |
| PATCH | `/api/meetings/:id/action-items/:itemId` | Bearer | Update action item |
| POST | `/api/meetings/:id/recording` | Bearer | Save recording metadata |

### System
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check (K8s probe) |
| GET | `/metrics` | No | Prometheus metrics |

---

## Socket.io Events

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ meetingId }` | Join a meeting room |
| `leave-room` | `{ meetingId }` | Leave a meeting room |
| `chat-message` | `{ meetingId, text }` | Send a chat message |
| `webrtc-offer` | `{ targetSocketId, offer }` | WebRTC offer |
| `webrtc-answer` | `{ targetSocketId, answer }` | WebRTC answer |
| `webrtc-ice-candidate` | `{ targetSocketId, candidate }` | ICE candidate |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `chat-history` | `Message[]` | Full chat history on join |
| `chat-message` | `Message` | New chat message |
| `meeting-info` | `{ participants, startTime }` | Meeting state on join |
| `user-joined` | `{ name, userId }` | Another user joined |
| `user-left` | `{ name, userId }` | A user left |
| `webrtc-offer` | `{ offer, fromSocketId, fromUser }` | Relayed WebRTC offer |
| `webrtc-answer` | `{ answer, fromSocketId }` | Relayed WebRTC answer |
| `webrtc-ice-candidate` | `{ candidate, fromSocketId }` | Relayed ICE candidate |

---

## Running Tests

```bash
cd backend
npm test
```

Output: **76 tests, 3 suites, all passing**

Coverage targets: 80% lines/statements, 75% functions, 70% branches

---

## Docker

```bash
# Copy and configure environment
cp backend/.env.example .env
# Set JWT_SECRET and REFRESH_TOKEN_SECRET in .env

# Build and start all services
docker compose up --build

# Services:
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
# MongoDB:  internal only
```

See [DOCKER.md](DOCKER.md) for full details.

---

## Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
```

See [KUBERNETES.md](KUBERNETES.md) for full details.

---

## Monitoring

- **Prometheus**: scrapes `/metrics` every 15s
- **Grafana**: dashboard at `grafana/dashboards/intellmeet-backend-dashboard.json`
- **Sentry**: set `SENTRY_DSN` env var to enable

See [MONITORING.md](MONITORING.md) for setup.

---

## Security

- JWT access tokens (15m) + httpOnly refresh tokens (7d)
- Token rotation on every refresh
- bcrypt password hashing (cost factor 12)
- Helmet security headers + strict CSP
- CORS allowlist
- Rate limiting (auth: 10/15min, API: 100/15min)
- MongoDB injection prevention
- XSS sanitization on all inputs
- Audit log for all sensitive actions
- `password` and `refreshTokenHash` never returned in API responses

See [SECURITY.md](SECURITY.md) for full details.

---

## License

MIT
