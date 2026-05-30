# Helm

## Chart Layout
- `helm/Chart.yaml`
- `helm/values.yaml`
- `helm/templates/deployment.yaml`
- `helm/templates/service.yaml`
- `helm/templates/ingress.yaml`
- `helm/templates/configmap.yaml`
- `helm/templates/secret.yaml`
- `helm/templates/hpa.yaml`

## Install

```bash
helm install intellmeet helm/ --values helm/values.yaml
```

## Upgrade

```bash
helm upgrade intellmeet helm/ --values helm/values.yaml
```

## Configuration
Update `helm/values.yaml` for:
- Docker image repo and tag
- service port
- ingress host names
- resource requests and limits
- environment values
- secrets

## Secrets
Provide secure values for:
- `secret.JWT_SECRET`
- `secret.MONGO_URI`
- `secret.SENTRY_DSN`

## Autoscaling
The chart includes an HPA resource configured via `values.autoscaling`.
