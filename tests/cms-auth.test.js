import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionCookie,
  createSession,
  createSessionCookie,
  readSessionCookie,
  verifyPassword,
} from "../functions/_lib/auth.js";
import { assertCsrf } from "../functions/_lib/csrf.js";

test("createSessionCookie sets secure admin cookie flags", () => {
  const header = createSessionCookie(
    "session_123",
    new Date("2026-04-18T00:00:00.000Z"),
  );

  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Strict/);
});

test("assertCsrf rejects requests when the session is missing", () => {
  const request = new Request("https://example.com", {
    headers: { "x-csrf-token": "token_123" },
  });

  assert.throws(() => assertCsrf(request), (error) => {
    assert.equal(error.name, "Error");
    assert.equal(error.message, "Invalid CSRF token.");
    return true;
  });
});

test("clearSessionCookie expires the cms session cookie", () => {
  const header = clearSessionCookie();
  assert.match(header, /^cms_session=/);
  assert.match(header, /Expires=/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Strict/);
});

test("verifyPassword returns false for a wrong password", async () => {
  const ok = await verifyPassword(
    "$2b$12$Vn4Y0Q0M0lQ5v0nB08Ww6eS8THvYxjEwRkn5I9WQm5M8f0g5q1n1u",
    "wrong-password",
  );

  assert.equal(ok, false);
});

test("verifyPassword returns true for a valid password", async () => {
  const ok = await verifyPassword(
    "$2b$12$x.iwrptMsEMdkZ4/OUMl9e.L/vFMdVRWidtFbmHwRbfc0vQkX/tya",
    "test-password",
  );

  assert.equal(ok, true);
});

test("readSessionCookie returns the cms session value from the cookie header", () => {
  const sessionId = readSessionCookie(new Request("https://example.com", {
    headers: {
      cookie: "theme=dark; cms_session=session_123; other=value",
    },
  }));

  assert.equal(sessionId, "session_123");
});

test("createSession persists a session row and returns the stored metadata", async () => {
  const inserts = [];
  const env = {
    CMS_DB: {
      prepare(query) {
        return {
          bind(...bindings) {
            return {
              async run() {
                inserts.push({ query, bindings });
                return { success: true, meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };

  const session = await createSession(env, "admin@example.com");

  assert.equal(inserts.length, 1);
  assert.equal(
    inserts[0].query,
    "INSERT INTO cms_sessions (id, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  );
  assert.equal(inserts[0].bindings[0], session.id);
  assert.equal(inserts[0].bindings[1], "admin@example.com");
  assert.equal(inserts[0].bindings[2], session.csrfToken);
  assert.equal(inserts[0].bindings[4], session.expiresAt);
  assert.equal(session.userId, "admin@example.com");
  assert.match(session.id, /^[0-9a-f-]{36}$/);
  assert.match(session.csrfToken, /^[0-9a-f]{64}$/);
});
