const client = require("prom-client");

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const httpRequestCounter = new client.Counter({
  name: "intellmeet_http_requests_total",
  help: "Total HTTP requests processed.",
  labelNames: ["method", "route", "status"],
});

const httpRequestDuration = new client.Histogram({
  name: "intellmeet_http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status"],
  buckets: [0.1, 0.3, 0.5, 1, 2.5, 5, 10],
});

const activeMeetingsGauge = new client.Gauge({
  name: "intellmeet_active_meetings",
  help: "Current number of active meetings.",
});

const activeUsersGauge = new client.Gauge({
  name: "intellmeet_active_users",
  help: "Current number of connected users.",
});

const metricsMiddleware = (req, res, next) => {
  const route = req.route?.path || req.path || "unknown";
  const end = httpRequestDuration.startTimer({ method: req.method, route });

  res.on("finish", () => {
    const status = res.statusCode ? String(res.statusCode) : "unknown";
    httpRequestCounter.inc({ method: req.method, route, status });
    end({ status });
  });

  return next();
};

const metricsHandler = async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.send(await client.register.metrics());
};

module.exports = {
  metricsMiddleware,
  metricsHandler,
  activeMeetingsGauge,
  activeUsersGauge,
  register: client.register,
};
