# Kubernetes

## Files
- `k8s/namespace.yaml`
- `k8s/deployment.yaml`
- `k8s/service.yaml`
- `k8s/ingress.yaml`
- `k8s/configmap.yaml`
- `k8s/secret.yaml`
- `k8s/hpa.yaml`

## Deploy

1. Ensure your kubeconfig is configured.
2. Apply the namespace and manifest files:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
```

3. Confirm the deployment:

```bash
kubectl rollout status deployment/intellmeet-backend -n intellmeet
```

## Secrets
The `k8s/secret.yaml` file is a template and should be replaced with values from a secret manager or CI/CD secret store.

## Notes
- The deployment uses rolling updates.
- Readiness probes check `/`.
- Liveness probes check `/metrics`.
- Autoscaling is enabled by default using CPU utilization.
