# Docker

## Files
- `Dockerfile`: builds the backend image.
- `frontend/Dockerfile`: builds the frontend static site.
- `.dockerignore`: excludes local artifacts.
- `docker-compose.yml`: composes backend, frontend, and Mongo.

## Build and run

```bash
docker compose up --build
```

## Service endpoints
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:3000`

## Environment variables
The backend container reads:
- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `NODE_ENV`
- `SENTRY_DSN`

These are configured in `docker-compose.yml` and can also be supplied through shell environment variables.

## Persistence
Mongo data is persisted in a Docker volume named `mongo_data`.
