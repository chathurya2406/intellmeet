const request = require("supertest");
const { app } = require("../server");

require("./setup");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * signupAndLogin — creates a user and returns { token, cookie }.
 * cookie is the Set-Cookie header value containing the refresh token.
 */
const signupAndLogin = async (
  email = "test@example.com",
  password = "password123",
  name = "Test User"
) => {
  // Attempt signup (may already exist from a previous test in the same suite)
  await request(app)
    .post("/api/auth/signup")
    .send({ name, email, password });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  const cookie = res.headers["set-cookie"];
  return { token: res.body.token, cookie, user: res.body.user };
};

// ─── Signup ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/signup", () => {
  it("should register a new user and return an access token + refresh cookie", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Test User", email: "test@example.com", password: "password123" })
      .expect(201);

    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({ name: "Test User", email: "test@example.com" });
    expect(res.body.user).not.toHaveProperty("password");
    // Refresh token should be set as an httpOnly cookie
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toMatch(/intellmeet_refresh/);
    expect(res.headers["set-cookie"][0]).toMatch(/HttpOnly/i);
  });

  it("should reject signup with duplicate email", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ name: "User A", email: "dup@example.com", password: "password123" });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "User B", email: "dup@example.com", password: "password123" })
      .expect(409);

    expect(res.body.message).toMatch(/already registered/i);
  });

  it("should reject signup with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "missing@example.com" })
      .expect(400);

    expect(res.body).toHaveProperty("message");
  });

  it("should reject signup with short password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "User", email: "short@example.com", password: "abc" })
      .expect(400);

    expect(res.body.message).toMatch(/password/i);
  });

  it("should reject signup with invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "User", email: "not-an-email", password: "password123" })
      .expect(400);

    expect(res.body.message).toMatch(/email/i);
  });

  it("should reject signup with name shorter than 2 characters", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "A", email: "shortname@example.com", password: "password123" })
      .expect(400);

    expect(res.body.message).toMatch(/name/i);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ name: "Login User", email: "login@example.com", password: "password123" });
  });

  it("should login an existing user and return an access token + refresh cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "password123" })
      .expect(200);

    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({ email: "login@example.com" });
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toMatch(/intellmeet_refresh/);
  });

  it("should reject login with wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "wrongpassword" })
      .expect(401);

    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("should reject login with unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" })
      .expect(401);

    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("should reject login with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com" })
      .expect(400);

    expect(res.body).toHaveProperty("message");
  });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

describe("POST /api/auth/refresh", () => {
  it("should issue a new access token when a valid refresh cookie is present", async () => {
    const { cookie } = await signupAndLogin("refresh@example.com");

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body).toHaveProperty("token");
    // New refresh cookie should be set (rotation)
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("should reject refresh when no cookie is present", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .expect(401);

    expect(res.body.message).toMatch(/refresh token not found/i);
  });

  it("should reject refresh with an invalid cookie value", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "intellmeet_refresh=invalid.token.value")
      .expect(401);

    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  it("should rotate the refresh token on each use", async () => {
    const { cookie } = await signupAndLogin("rotate@example.com");

    // First refresh — get new cookie
    const res1 = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie)
      .expect(200);

    const newCookie = res1.headers["set-cookie"];

    // Second refresh with new cookie — should succeed
    const res2 = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", newCookie)
      .expect(200);

    expect(res2.body).toHaveProperty("token");
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("should logout and clear the refresh cookie", async () => {
    const { token, cookie } = await signupAndLogin("logout@example.com");

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body.message).toMatch(/logged out/i);
    // Cookie should be cleared
    const setCookie = res.headers["set-cookie"];
    if (setCookie) {
      expect(setCookie[0]).toMatch(/intellmeet_refresh=;/);
    }
  });

  it("should reject logout without auth token", async () => {
    await request(app)
      .post("/api/auth/logout")
      .expect(401);
  });

  it("should invalidate the refresh token after logout", async () => {
    const { token, cookie } = await signupAndLogin("logout2@example.com");

    // Logout
    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", cookie);

    // Attempt to use the old refresh token — should fail
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie)
      .expect(401);

    expect(res.body.message).toBeDefined();
  });
});

// ─── Logout All ───────────────────────────────────────────────────────────────

describe("POST /api/auth/logout-all", () => {
  it("should invalidate all sessions", async () => {
    const { token, cookie } = await signupAndLogin("logoutall@example.com");

    const res = await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.message).toMatch(/all sessions invalidated/i);

    // Old refresh token should no longer work
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie)
      .expect(401);

    expect(refreshRes.body.message).toBeDefined();
  });
});

// ─── Profile ──────────────────────────────────────────────────────────────────

describe("GET /api/auth/profile", () => {
  let token;

  beforeEach(async () => {
    const result = await signupAndLogin("profile@example.com");
    token = result.token;
  });

  it("should return the authenticated user profile", async () => {
    const res = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.user).toMatchObject({ email: "profile@example.com" });
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.user).not.toHaveProperty("refreshTokenHash");
  });

  it("should reject profile request without token", async () => {
    await request(app).get("/api/auth/profile").expect(401);
  });

  it("should reject profile request with invalid token", async () => {
    await request(app)
      .get("/api/auth/profile")
      .set("Authorization", "Bearer invalid.token.here")
      .expect(401);
  });
});

// ─── Profile Update ───────────────────────────────────────────────────────────

describe("PUT /api/auth/profile", () => {
  let token;

  beforeEach(async () => {
    const result = await signupAndLogin("update@example.com");
    token = result.token;
  });

  it("should update the user name", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name" })
      .expect(200);

    expect(res.body.user.name).toBe("Updated Name");
  });

  it("should update the user avatar", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatar: "https://example.com/avatar.png" })
      .expect(200);

    expect(res.body.user.avatar).toBe("https://example.com/avatar.png");
  });

  it("should reject update with no valid fields", async () => {
    await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it("should reject update with name shorter than 2 characters", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X" })
      .expect(400);

    expect(res.body.message).toMatch(/name/i);
  });
});

// ─── Change Password ──────────────────────────────────────────────────────────

describe("PUT /api/auth/change-password", () => {
  let token;
  let cookie;

  beforeEach(async () => {
    const result = await signupAndLogin("changepw@example.com", "oldpassword1");
    token = result.token;
    cookie = result.cookie;
  });

  it("should change the password and invalidate all sessions", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "oldpassword1", newPassword: "newpassword1" })
      .expect(200);

    expect(res.body.message).toMatch(/password updated/i);

    // Old refresh token should be invalidated
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie)
      .expect(401);

    expect(refreshRes.body.message).toBeDefined();
  });

  it("should reject change-password with wrong current password", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrongpassword", newPassword: "newpassword1" })
      .expect(401);

    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  it("should reject change-password with short new password", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "oldpassword1", newPassword: "short" })
      .expect(400);

    expect(res.body.message).toMatch(/8 characters/i);
  });

  it("should reject change-password with missing fields", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "oldpassword1" })
      .expect(400);

    expect(res.body).toHaveProperty("message");
  });
});
