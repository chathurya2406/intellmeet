# Monitoring

## Backend metrics
The backend exposes Prometheus metrics at `/metrics`.

## Prometheus
Configuration is available in `monitoring/prometheus.yml`.

Scrape targets include:
- `localhost:5000`
- `backend:5000`

## Grafana
Dashboard file:
- `grafana/dashboards/intellmeet-backend-dashboard.json`

Tracked metrics:
- `intellmeet_http_requests_total`
- `intellmeet_http_request_duration_seconds`
- `intellmeet_active_meetings`
- `intellmeet_active_users`

## Notes
Use the dashboard JSON to import the panel into Grafana and connect it to your Prometheus datasource.
