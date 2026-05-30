/**
 * IntellMeet — k6 Socket.io Load Test
 *
 * Simulates concurrent users connecting to Socket.io, joining rooms,
 * sending chat messages, and disconnecting.
 *
 * NOTE: k6 does not natively support Socket.io protocol.
 * This test uses the raw WebSocket transport with Socket.io framing.
 *
 * Run:
 *   k6 run loadtests/socket-load-test.js
 *   k6 run --env TARGET_URL=wss://api.intellmeet.com --env AUTH_TOKEN=<jwt> loadtests/socket-load-test.js
 */

import ws from "k6/ws";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Custom metrics ───────────────────────────────────────────────────────────
const socketConnectRate = new Rate("socket_connect_rate");
const socketMessageRate = new Rate("socket_message_rate");
const socketErrors = new Counter("socket_errors");
const socketConnectTime = new Trend("socket_connect_time_ms");

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m",  target: 20 },
    { duration: "2m",  target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    socket_connect_rate:  ["rate>0.90"],
    socket_message_rate:  ["rate>0.90"],
    checks:               ["rate>0.90"],
  },
};

const BASE_URL  = __ENV.TARGET_URL  || "http://localhost:5000";
const WS_URL    = BASE_URL.replace(/^http/, "ws");
const JSON_HEADERS = { "Content-Type": "application/json" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const randomEmail    = () => `socket_${Math.random().toString(36).substring(2, 10)}@test.com`;
const randomMeetingId = () => `socket-room-${Math.random().toString(36).substring(2, 8)}`;

/**
 * getAuthToken — signs up and logs in to get a JWT for socket auth.
 */
function getAuthToken() {
  const email    = randomEmail();
  const password = "SocketTest123!";

  const signupRes = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify({ name: "Socket Load User", email, password }),
    { headers: JSON_HEADERS }
  );

  if (signupRes.status === 201) {
    try { return JSON.parse(signupRes.body).token; } catch { /* fall through */ }
  }

  // Try login if signup failed (user may already exist)
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS }
  );

  try { return JSON.parse(loginRes.body).token; } catch { return null; }
}

// ─── Socket.io message framing ────────────────────────────────────────────────
// Socket.io v4 uses Engine.io framing:
//   "0"  = open
//   "40" = socket.io connect
//   "42[\"event\", data]" = emit

const sioConnect  = "40";
const sioEmit     = (event, data) => `42${JSON.stringify([event, data])}`;
const sioHeartbeat = "2";  // ping

// ─── Main test scenario ───────────────────────────────────────────────────────

export default function () {
  const token = getAuthToken();
  if (!token) {
    socketErrors.add(1);
    sleep(1);
    return;
  }

  const meetingId = randomMeetingId();
  const connectStart = Date.now();

  // Connect with JWT token in query string (Socket.io auth handshake)
  const socketUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&token=${token}`;

  const res = ws.connect(socketUrl, {}, (socket) => {
    let connected = false;
    let joinedRoom = false;
    let messageReceived = false;

    socket.on("open", () => {
      socketConnectTime.add(Date.now() - connectStart);
      // Send Socket.io connect packet
      socket.send(sioConnect);
    });

    socket.on("message", (msg) => {
      // Engine.io open packet
      if (msg.startsWith("0")) {
        connected = true;
        socketConnectRate.add(true);

        // Join a meeting room
        socket.send(sioEmit("join-room", { meetingId }));
        return;
      }

      // Socket.io connect confirmation
      if (msg === "40" || msg.startsWith("40{")) {
        return;
      }

      // Heartbeat ping — respond with pong
      if (msg === "2") {
        socket.send("3");
        return;
      }

      // Parse Socket.io event messages
      if (msg.startsWith("42")) {
        try {
          const [event, data] = JSON.parse(msg.slice(2));

          if (event === "chat-history") {
            joinedRoom = true;
            // Send a test chat message
            socket.send(sioEmit("chat-message", {
              meetingId,
              text: `Load test message from VU ${__VU} at ${Date.now()}`,
            }));
          }

          if (event === "chat-message") {
            messageReceived = true;
            socketMessageRate.add(true);
          }

          if (event === "meeting-info") {
            // Successfully received meeting info
          }

          if (event === "error") {
            socketErrors.add(1);
          }
        } catch { /* ignore parse errors */ }
      }
    });

    socket.on("error", () => {
      socketErrors.add(1);
      socketConnectRate.add(false);
    });

    // Stay connected for 3 seconds to simulate a real user
    sleep(3);

    // Leave the room gracefully
    if (connected) {
      socket.send(sioEmit("leave-room", { meetingId }));
      sleep(0.5);
    }

    socket.close();

    // Record final checks
    check(null, {
      "socket connected":      () => connected,
      "joined room":           () => joinedRoom,
    });
  });

  check(res, {
    "websocket handshake 101": (r) => r && r.status === 101,
  });

  sleep(1);
}

// ─── Summary report ───────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    "loadtests/results/socket-load-test-summary.json": JSON.stringify(data, null, 2),
    stdout: `
╔══════════════════════════════════════════════════════════╗
║         IntellMeet Socket.io Load Test Results           ║
╠══════════════════════════════════════════════════════════╣
║  Socket Connections:  ${data.metrics.socket_connect_rate?.values?.passes || 0}
║  Connect Success:     ${Math.round((data.metrics.socket_connect_rate?.values?.rate || 0) * 100)}%
║  Message Success:     ${Math.round((data.metrics.socket_message_rate?.values?.rate || 0) * 100)}%
║  Socket Errors:       ${data.metrics.socket_errors?.values?.count || 0}
║  Avg Connect Time:    ${Math.round(data.metrics.socket_connect_time_ms?.values?.avg || 0)}ms
╚══════════════════════════════════════════════════════════╝
`,
  };
}
