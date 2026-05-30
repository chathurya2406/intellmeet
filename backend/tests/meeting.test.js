const request = require("supertest");
const { app } = require("../server");

require("./setup");

// ─── Helpers ─────────────────────────────────────────────────────────────────

let authToken;

beforeEach(async () => {
  // Create and login a user before each test
  await request(app).post("/api/auth/signup").send({
    name: "Meeting User",
    email: "meeting@example.com",
    password: "password123",
  });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "meeting@example.com", password: "password123" });

  authToken = loginRes.body.token;
});

// ─── Start Meeting ────────────────────────────────────────────────────────────

describe("POST /api/meetings/:meetingId/start", () => {
  it("should start a meeting and return meeting metadata", async () => {
    const res = await request(app)
      .post("/api/meetings/test-room-start/start")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.meeting).toHaveProperty("meetingId", "test-room-start");
    expect(res.body.meeting).toHaveProperty("status", "active");
    expect(res.body.meeting.participants).toContain("Meeting User");
  });

  it("should reject start without auth token", async () => {
    await request(app)
      .post("/api/meetings/test-room-noauth/start")
      .expect(401);
  });

  it("should restart an ended meeting", async () => {
    await request(app)
      .post("/api/meetings/restart-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    await request(app)
      .post("/api/meetings/restart-room/end")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .post("/api/meetings/restart-room/start")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.meeting.status).toBe("active");
  });

  it("should add participant to an already active meeting", async () => {
    // Start once
    await request(app)
      .post("/api/meetings/multi-join-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    // Start again (same user — should not duplicate)
    const res = await request(app)
      .post("/api/meetings/multi-join-room/start")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.meeting.status).toBe("active");
  });
});

// ─── Get Meeting ──────────────────────────────────────────────────────────────

describe("GET /api/meetings/:meetingId", () => {
  it("should retrieve meeting details and message history", async () => {
    await request(app)
      .post("/api/meetings/get-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get("/api/meetings/get-room")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.meeting).toHaveProperty("meetingId", "get-room");
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it("should return 404 for non-existent meeting", async () => {
    await request(app)
      .get("/api/meetings/does-not-exist-xyz")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(404);
  });
});

// ─── End Meeting ──────────────────────────────────────────────────────────────

describe("POST /api/meetings/:meetingId/end", () => {
  it("should end a meeting and return duration information", async () => {
    await request(app)
      .post("/api/meetings/end-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .post("/api/meetings/end-room/end")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.meeting).toHaveProperty("status", "ended");
    expect(typeof res.body.meeting.durationSeconds).toBe("number");
  });

  it("should handle ending an already-ended meeting gracefully", async () => {
    await request(app)
      .post("/api/meetings/double-end-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    await request(app)
      .post("/api/meetings/double-end-room/end")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .post("/api/meetings/double-end-room/end")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.message).toMatch(/already ended/i);
  });

  it("should return 404 when ending a non-existent meeting", async () => {
    await request(app)
      .post("/api/meetings/nonexistent-end-room/end")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(404);
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

describe("GET /api/meetings/:meetingId/analytics", () => {
  it("should return analytics for a meeting", async () => {
    await request(app)
      .post("/api/meetings/analytics-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    await request(app)
      .post("/api/meetings/analytics-room/end")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get("/api/meetings/analytics-room/analytics")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.analytics).toHaveProperty("meetingId", "analytics-room");
    expect(res.body.analytics).toHaveProperty("messageCount");
    expect(res.body.analytics).toHaveProperty("participantCount");
    expect(res.body.analytics).toHaveProperty("durationSeconds");
    expect(res.body.analytics).toHaveProperty("hasAiSummary", false);
    expect(res.body.analytics).toHaveProperty("hasRecording", false);
  });

  it("should return 404 analytics for non-existent meeting", async () => {
    await request(app)
      .get("/api/meetings/no-such-analytics-room/analytics")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(404);
  });
});

// ─── AI Summary ───────────────────────────────────────────────────────────────

describe("POST /api/meetings/:meetingId/ai-summary", () => {
  it("should save an AI summary and action items", async () => {
    await request(app)
      .post("/api/meetings/ai-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .post("/api/meetings/ai-room/ai-summary")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        summary: "This meeting covered Q3 planning and budget allocation.",
        actionItems: [
          { text: "Prepare Q3 report", assignedTo: "Meeting User" },
          { text: "Schedule follow-up", assignedTo: null },
        ],
      })
      .expect(200);

    expect(res.body.aiSummary).toContain("Q3 planning");
    expect(res.body.actionItems).toHaveLength(2);
    expect(res.body.actionItems[0]).toHaveProperty("text", "Prepare Q3 report");
    expect(res.body.actionItems[0]).toHaveProperty("completed", false);
  });

  it("should save AI summary without action items", async () => {
    await request(app)
      .post("/api/meetings/ai-room-noitems/start")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .post("/api/meetings/ai-room-noitems/ai-summary")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ summary: "Brief summary with no action items." })
      .expect(200);

    expect(res.body.aiSummary).toBe("Brief summary with no action items.");
    expect(res.body.actionItems).toHaveLength(0);
  });

  it("should reject AI summary with empty text", async () => {
    await request(app)
      .post("/api/meetings/ai-room2/start")
      .set("Authorization", `Bearer ${authToken}`);

    await request(app)
      .post("/api/meetings/ai-room2/ai-summary")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ summary: "" })
      .expect(400);
  });

  it("should return 404 for AI summary on non-existent meeting", async () => {
    await request(app)
      .post("/api/meetings/no-such-ai-room/ai-summary")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ summary: "Some summary" })
      .expect(404);
  });
});

// ─── Action Items ─────────────────────────────────────────────────────────────

describe("PATCH /api/meetings/:meetingId/action-items/:itemId", () => {
  let meetingId;
  let itemId;

  beforeEach(async () => {
    meetingId = "action-item-room";

    await request(app)
      .post(`/api/meetings/${meetingId}/start`)
      .set("Authorization", `Bearer ${authToken}`);

    const summaryRes = await request(app)
      .post(`/api/meetings/${meetingId}/ai-summary`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        summary: "Action item test meeting.",
        actionItems: [{ text: "Complete the report", assignedTo: "Meeting User" }],
      });

    itemId = summaryRes.body.actionItems[0]._id;
  });

  it("should mark an action item as completed", async () => {
    const res = await request(app)
      .patch(`/api/meetings/${meetingId}/action-items/${itemId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ completed: true })
      .expect(200);

    expect(res.body.actionItem).toHaveProperty("completed", true);
  });

  it("should update assignedTo on an action item", async () => {
    const res = await request(app)
      .patch(`/api/meetings/${meetingId}/action-items/${itemId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ assignedTo: "Another User" })
      .expect(200);

    expect(res.body.actionItem).toHaveProperty("assignedTo", "Another User");
  });

  it("should return 404 for non-existent action item", async () => {
    await request(app)
      .patch(`/api/meetings/${meetingId}/action-items/000000000000000000000000`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ completed: true })
      .expect(404);
  });

  it("should return 404 for action item on non-existent meeting", async () => {
    await request(app)
      .patch(`/api/meetings/no-such-meeting/action-items/${itemId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ completed: true })
      .expect(404);
  });
});

// ─── Recording Metadata ───────────────────────────────────────────────────────

describe("POST /api/meetings/:meetingId/recording", () => {
  it("should save recording metadata", async () => {
    await request(app)
      .post("/api/meetings/recording-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .post("/api/meetings/recording-room/recording")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        url: "https://storage.example.com/recordings/recording-room.webm",
        durationSeconds: 3600,
        sizeBytes: 104857600,
        format: "webm",
      })
      .expect(200);

    expect(res.body.recordingMetadata).toHaveProperty(
      "url",
      "https://storage.example.com/recordings/recording-room.webm"
    );
    expect(res.body.recordingMetadata).toHaveProperty("durationSeconds", 3600);
    expect(res.body.recordingMetadata).toHaveProperty("format", "webm");
  });

  it("should reject recording without a URL", async () => {
    await request(app)
      .post("/api/meetings/recording-room2/start")
      .set("Authorization", `Bearer ${authToken}`);

    await request(app)
      .post("/api/meetings/recording-room2/recording")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ durationSeconds: 100 })
      .expect(400);
  });

  it("should return 404 for recording on non-existent meeting", async () => {
    await request(app)
      .post("/api/meetings/no-such-recording-room/recording")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ url: "https://example.com/rec.webm" })
      .expect(404);
  });
});

// ─── Meeting History ──────────────────────────────────────────────────────────

describe("GET /api/meetings", () => {
  it("should return paginated meeting history for the user", async () => {
    await request(app)
      .post("/api/meetings/history-room-1/start")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get("/api/meetings")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body.meetings)).toBe(true);
    expect(res.body.pagination).toHaveProperty("total");
    expect(res.body.pagination).toHaveProperty("page", 1);
    expect(res.body.pagination).toHaveProperty("limit", 10);
  });

  it("should filter meeting history by status", async () => {
    await request(app)
      .post("/api/meetings/history-active-room/start")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get("/api/meetings?status=active")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body.meetings)).toBe(true);
    res.body.meetings.forEach((m) => {
      expect(m.status).toBe("active");
    });
  });

  it("should support pagination parameters", async () => {
    const res = await request(app)
      .get("/api/meetings?page=1&limit=5")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.page).toBe(1);
  });
});
