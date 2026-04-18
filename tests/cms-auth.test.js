import test from "node:test";
import assert from "node:assert/strict";
import { createSessionCookie } from "../functions/_lib/auth.js";

test("createSessionCookie sets secure admin cookie flags", () => {
  const header = createSessionCookie(
    "session_123",
    new Date("2026-04-18T00:00:00.000Z"),
  );

  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Strict/);
});
