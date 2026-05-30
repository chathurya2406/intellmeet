/**
 * IntellMeet — k6 HTTP Load Test
 *
 * Tests: signup → login → start meeting → get meeting → analytics → end meeting
 *
 * Run:
 *   k6 run loadtests/http-load-test.js
 *   k6 run --env TARGET_URL=https://api.intellmeet.com loadtests/http-load-test.js
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Custom metrics ───────────────────────────────────────────────────────────
const loginSuccessRate = new Rate("login_success_rate");
const meetingStartRate = new Rate("meeting_start_rate");
const apiErrors = new Counter("api_errors");
const loginDuration = new Trend("login_duration_ms");
const meetingDuration = new Trend("meeting_duration_ms");

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "30s", target: 5 },   // Warm up
    { duration: "1m",  target: 20 },  // Ramp up
    { duration: "2m",  target: 50 },  // Sustained load
    { duration: "1m",  target: 20 },  // Scale down
    { duration: "30s", target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration:    ["p(95)<500", "p(99)<1000"],
    http_req_failed:      ["rate<0.02"],
    login_success_rate:   ["rate>0.95"],
    meeting_start_rate:   ["rate>0.95"],
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://localhost:5000";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const randomEmail = () =>
  `loadtest_${Math.random().toString(36).substring(2, 10)}@test.com`;

const randomMeetingId = () =>
  `load-${Math.random().toString(36).substring(2, 10)}`;

// ─── Main test scenario ───────────────────────────────────────────────────────

export default function () {
  const email = randomEmail();
  const password = "LoadTest123!";
  const meetingId = randomMeetingId();
  let token = null;

  // ── 1. Health check ─────────────────────────────────────────────────────────
  group("health", () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      "health returns 200": (r) => r.status === 200,
      "health db connected": (r) => {
        try { return JSON.parse(r.body).db === "connected"; } catch { return false; }
      },
    });
  });

  sleep(0.5);

  // ── 2. Signup ────────────────────────────────────────────────────────────────
  group("auth", () => {
    const signupRes = http.post(
      `${BASE_URL}/api/auth/signup`,
      JSON.stringify({ name: "Load Test User", email, password }),
      { headers: JSON_HEADERS }
    );

    const signupOk = check(signupRes, {
      "signup returns 201": (r) => r.status === 201,
      "signup returns token": (r) => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
    });

    if (!signupOk) {
      apiErrors.add(1);
      return;
    }

    try {
      token = JSON.parse(signupRes.body).token;
    } catch {
      apiErrors.add(1);
      return;
    }

    sleep(0.3);

    // ── 3. Login ───────────────────────────────────────────────────────────────
    const loginStart = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password }),
      { headers: JSON_HEADERS }
    );
    loginDuration.add(Date.now() - loginStart);

    const loginOk = check(loginRes, {
      "login returns 200": (r) => r.status === 200,
      "login returns token": (r) => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
    });
    loginSuccessRate.add(loginOk);

    if (loginOk) {
      try { token = JSON.parse(loginRes.body).token; } catch { /* keep signup token */ }
    }

    sleep(0.3);

    // ── 4. Get profile ─────────────────────────────────────────────────────────
    const profileRes = http.get(`${BASE_URL}/api/auth/profile`, {
      headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
    });
    check(profileRes, {
      "profile returns 200": (r) => r.status === 200,
      "profile has user": (r) => {
        try { return !!JSON.parse(r.body).user; } catch { return false; }
      },
    });
  });

  if (!token) { sleep(1); return; }

  const authHeaders = { ...JSON_HEADERS, Authorization: `Bearer ${token}` };

  sleep(0.5);

  // ── 5. Meeting lifecycle ─────────────────────────────────────────────────────
  group("meetings", () => {
    // Start meeting
    const meetingStart = Date.now();
    const startRes = http.post(
      `${BASE_URL}/api/meetings/${meetingId}/start`,
      null,
      { headers: authHeaders }
    );
    meetingDuration.add(Date.now() - meetingStart);

    const startOk = check(startRes, {
      "meeting start returns 200": (r) => r.status === 200,
      "meeting has meetingId": (r) => {
        try { return !!JSON.parse(r.body).meeting?.meetingId; } catch { return false; }
      },
    });
    meetingStartRate.add(startOk);

    if (!startOk) { apiErrors.add(1); return; }

    sleep(0.5);

    // Get meeting details
    const getRes = http.get(`${BASE_URL}/api/meetings/${meetingId}`, {
      headers: authHeaders,
    });
    check(getRes, {
      "get meeting returns 200": (r) => r.status === 200,
    });

    sleep(0.3);

    // Get analytics
    const analyticsRes = http.get(
      `${BASE_URL}/api/meetings/${meetingId}/analytics`,
      { headers: authHeaders }
    );
    check(analyticsRes, {
      "analytics returns 200": (r) => r.status === 200,
      "analytics has messageCount": (r) => {
        try { return typeof JSON.parse(r.body).analytics?.messageCount === "number"; } catch { return false; }
      },
    });

    sleep(0.3);

    // End meeting
    const endRes = http.post(
      `${BASE_URL}/api/meetings/${meetingId}/end`,
      null,
      { headers: authHeaders }
    );
    check(endRes, {
      "meeting end returns 200": (r) => r.status === 200,
      "meeting status is ended": (r) => {
        try { return JSON.parse(r.body).meeting?.status === "ended"; } catch { return false; }
      },
    });

    sleep(0.3);

    // Get meeting history
    const historyRes = http.get(`${BASE_URL}/api/meetings?page=1&limit=5`, {
      headers: authHeaders,
    });
    check(historyRes, {
      "history returns 200": (r) => r.status === 200,
      "history has pagination": (r) => {
        try { return !!JSON.parse(r.body).pagination; } catch { return false; }
      },
    });
  });

  sleep(0.5);

  // ── 6. Metrics endpoint ──────────────────────────────────────────────────────
  group("monitoring", () => {
    const metricsRes = http.get(`${BASE_URL}/metrics`);
    check(metricsRes, {
      "metrics returns 200": (r) => r.status === 200,
      "metrics has content": (r) => r.body.length > 100,
    });
  });

  sleep(1);
}

// ─── Summary report ───────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    "loadtests/results/http-load-test-summary.json": JSON.stringify(data, null, 2),
    stdout: `
╔══════════════════════════════════════════════════════════╗
║           IntellMeet HTTP Load Test Results              ║
╠══════════════════════════════════════════════════════════╣
║  Total Requests:    ${data.metrics.http_reqs?.values?.count || 0}
║  Failed Requests:   ${data.metrics.http_req_failed?.values?.passes || 0}
║  P95 Duration:      ${Math.round(data.metrics.http_req_duration?.values?.["p(95)"] || 0)}ms
║  P99 Duration:      ${Math.round(data.metrics.http_req_duration?.values?.["p(99)"] || 0)}ms
║  Login Success:     ${Math.round((data.metrics.login_success_rate?.values?.rate || 0) * 100)}%
║  Meeting Success:   ${Math.round((data.metrics.meeting_start_rate?.values?.rate || 0) * 100)}%
╚══════════════════════════════════════════════════════════╝
`,
  };
}
