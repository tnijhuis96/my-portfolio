import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionCookie,
  createSessionCookie,
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
});

test("verifyPassword returns false for a wrong password", async () => {
  const ok = await verifyPassword(
    "$2b$12$Vn4Y0Q0M0lQ5v0nB08Ww6eS8THvYxjEwRkn5I9WQm5M8f0g5q1n1u",
    "wrong-password",
  );

  assert.equal(ok, false);
});
