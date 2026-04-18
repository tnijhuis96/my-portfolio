import crypto from "node:crypto";

export function createSessionCookie(sessionId, expiresAt) {
  return [
    `cms_session=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Expires=${expiresAt.toUTCString()}`,
  ].join("; ");
}

export function newToken() {
  return crypto.randomBytes(32).toString("hex");
}
