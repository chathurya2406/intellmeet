# IntelliMeet Deployment

## Overview
This repository now includes production-ready deployment artifacts for:
- Docker Compose
- Kubernetes
- Helm

## Deployment options

### Docker Compose
1. Create a `.env` file from `backend/.env.example`.
2. Ensure `JWT_SECRET` and `MONGO_URI` are set in the environment or `.env`.
3. Run:

```bash
docker compose up --build
```

This starts:
- `backend` on port `5000`
- `frontend` on port `3000`
- `mongo` with persistent storage

### Kubernetes
1. Configure your cluster credentials.
2. Create the namespace and apply manifests:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
```

3. Verify rollout:

```bash
kubectl rollout status deployment/intellmeet-backend -n intellmeet
```

## Environment variables
Required values:
- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `NODE_ENV`
- `SENTRY_DSN` (optional)

## Notes
- The backend exposes `/metrics` for Prometheus scraping.
- Sentry is enabled when `SENTRY_DSN` is configured.
