import test from "node:test";
import assert from "node:assert/strict";
import { requireCmsEnv } from "../functions/_lib/env.js";
import { writeAuditEvent } from "../functions/_lib/audit.js";
import { assertRateLimitAllowed } from "../functions/_lib/rate-limit.js";
import { onRequest, shouldProtectAdminPath } from "../functions/_middleware.js";
import { onRequestPost } from "../functions/api/admin/login.js";
import { onRequestPost as onRequestLogoutPost } from "../functions/api/admin/logout.js";
import { onRequestGet as onRequestSessionGet } from "../functions/api/admin/session.js";

function createTestEnv(options = {}) {
  const state = {
    rateLimits: new Map(),
    auditLog: [],
    sessions: new Map(),
    failAuditWrites: options.failAuditWrites ?? false,
    uniqueInsertRaceKeys: new Set(options.uniqueInsertRaceKeys ?? []),
    racedInsertKeys: new Set(),
    concurrentIncrementKeys: new Set(options.concurrentIncrementKeys ?? []),
    racedIncrementKeys: new Set(),
  };

  function buildStatement(query, bindings = []) {
    return {
      bind(...nextBindings) {
        return buildStatement(query, nextBindings);
      },
      async first() {
        if (query.includes("FROM cms_rate_limits")) {
          const [bucket, key] = bindings;
          return state.rateLimits.get(`${bucket}:${key}`) ?? null;
        }

        if (query.includes("FROM cms_sessions")) {
          const [id] = bindings;
          return state.sessions.get(id) ?? null;
        }

        throw new Error(`Unsupported first() query: ${query}`);
      },
      async run() {
        if (query.startsWith("INSERT INTO cms_rate_limits")) {
          const [id, bucket, key, count, windowStartedAt, expiresAt] = bindings;
          const rateLimitKey = `${bucket}:${key}`;

          if (
            state.uniqueInsertRaceKeys.has(rateLimitKey)
            && !state.racedInsertKeys.has(rateLimitKey)
          ) {
            state.racedInsertKeys.add(rateLimitKey);
            state.rateLimits.set(rateLimitKey, {
              id: "race_winner",
              bucket,
              key,
              count: 1,
              window_started_at: windowStartedAt,
              expires_at: expiresAt,
            });

            if (query.includes("ON CONFLICT(bucket, key) DO NOTHING")) {
              return { success: true, meta: { changes: 0 } };
            }

            throw new Error("UNIQUE constraint failed: cms_rate_limits.bucket, cms_rate_limits.key");
          }

          if (
            query.includes("ON CONFLICT(bucket, key) DO NOTHING")
            && state.rateLimits.has(rateLimitKey)
          ) {
            return { success: true, meta: { changes: 0 } };
          }

          state.rateLimits.set(rateLimitKey, {
            id,
            bucket,
            key,
            count,
            window_started_at: windowStartedAt,
            expires_at: expiresAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (
          query.startsWith(
            "UPDATE cms_rate_limits SET count = ?, window_started_at = ?, expires_at = ? WHERE bucket = ? AND key = ? AND expires_at <= ?",
          )
        ) {
          const [count, windowStartedAt, expiresAt, bucket, key, now] = bindings;
          const existing = state.rateLimits.get(`${bucket}:${key}`);
          if (!existing || existing.expires_at > now) {
            return { success: true, meta: { changes: 0 } };
          }

          state.rateLimits.set(`${bucket}:${key}`, {
            ...existing,
            count,
            window_started_at: windowStartedAt,
            expires_at: expiresAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (
          query.startsWith(
            "UPDATE cms_rate_limits SET count = count + 1 WHERE bucket = ? AND key = ? AND expires_at > ? AND count < ?",
          )
        ) {
          const [bucket, key, now, limit] = bindings;
          const rateLimitKey = `${bucket}:${key}`;
          const existing = state.rateLimits.get(rateLimitKey);
          if (!existing || existing.expires_at <= now || existing.count >= limit) {
            return { success: true, meta: { changes: 0 } };
          }

          if (
            state.concurrentIncrementKeys.has(rateLimitKey)
            && !state.racedIncrementKeys.has(rateLimitKey)
          ) {
            state.racedIncrementKeys.add(rateLimitKey);
            state.rateLimits.set(rateLimitKey, {
              ...existing,
              count: existing.count + 1,
            });
          }

          const current = state.rateLimits.get(rateLimitKey);
          state.rateLimits.set(rateLimitKey, {
            ...current,
            count: current.count + 1,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (query.startsWith("UPDATE cms_rate_limits")) {
          const [count, windowStartedAt, expiresAt, id] = bindings;
          const existing = [...state.rateLimits.values()].find((entry) => entry.id === id);
          if (!existing) {
            throw new Error(`Missing rate limit row for ${id}`);
          }

          const rateLimitKey = `${existing.bucket}:${existing.key}`;
          if (
            state.concurrentIncrementKeys.has(rateLimitKey)
            && !state.racedIncrementKeys.has(rateLimitKey)
          ) {
            state.racedIncrementKeys.add(rateLimitKey);
            state.rateLimits.set(rateLimitKey, {
              ...existing,
              count: existing.count + 1,
            });
          }

          state.rateLimits.set(rateLimitKey, {
            ...state.rateLimits.get(rateLimitKey),
            count,
            window_started_at: windowStartedAt,
            expires_at: expiresAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (query.startsWith("INSERT INTO cms_audit_log")) {
          const [id, actorUserId, action, targetType, targetId, metadataJson, createdAt] = bindings;
          if (state.failAuditWrites) {
            throw new Error("audit write failed");
          }

          state.auditLog.push({
            id,
            actor_user_id: actorUserId,
            action,
            target_type: targetType,
            target_id: targetId,
            metadata_json: metadataJson,
            created_at: createdAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (query.startsWith("INSERT INTO cms_sessions")) {
          const [id, userId, csrfToken, createdAt, expiresAt] = bindings;
          state.sessions.set(id, {
            id,
            user_id: userId,
            csrf_token: csrfToken,
            created_at: createdAt,
            expires_at: expiresAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (query.startsWith("DELETE FROM cms_sessions WHERE id = ?")) {
          const [id] = bindings;
          const deleted = state.sessions.delete(id);
          return { success: true, meta: { changes: deleted ? 1 : 0 } };
        }

        throw new Error(`Unsupported run() query: ${query}`);
      },
    };
  }

  return {
    env: {
      CMS_PASSWORD_HASH: options.passwordHash ?? "$2b$12$x.iwrptMsEMdkZ4/OUMl9e.L/vFMdVRWidtFbmHwRbfc0vQkX/tya",
      CMS_DB: {
        prepare(query) {
          return buildStatement(query);
        },
      },
    },
    state,
  };
}

test("requireCmsEnv throws when required CMS env is missing", () => {
  assert.throws(
    () => requireCmsEnv({ CMS_SESSION_SECRET: "" }),
    /CMS_SESSION_SECRET/,
  );
});

test("requireCmsEnv returns normalized CMS env values", () => {
  assert.deepEqual(
    requireCmsEnv({
      CMS_SESSION_SECRET: "secret",
      CMS_PASSWORD_HASH: "hash",
      PAGES_DEPLOY_HOOK_URL: "https://example.com/hook",
    }),
    {
      sessionSecret: "secret",
      passwordHash: "hash",
      deployHookUrl: "https://example.com/hook",
    },
  );
});

test("shouldProtectAdminPath matches admin pages and APIs", () => {
  assert.equal(shouldProtectAdminPath("/admin"), true);
  assert.equal(shouldProtectAdminPath("/api/admin/posts"), true);
  assert.equal(shouldProtectAdminPath("/blog/hello-world.html"), false);
});

test("middleware blocks protected admin paths without Cloudflare Access identity", async () => {
  let nextCalled = false;
  const response = await onRequest({
    request: new Request("https://example.com/admin"),
    next() {
      nextCalled = true;
      return new Response("ok");
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(response.status, 401);
});

test("middleware allows protected admin paths with Cloudflare Access identity", async () => {
  let nextCalled = false;
  const response = await onRequest({
    request: new Request("https://example.com/api/admin/posts", {
      headers: {
        "cf-access-authenticated-user-email": "admin@example.com",
      },
    }),
    next() {
      nextCalled = true;
      return new Response("ok");
    },
  });

  assert.equal(nextCalled, true);
  assert.equal(await response.text(), "ok");
});

test("assertRateLimitAllowed increments a bucket and blocks when the limit is exceeded", async () => {
  const { env, state } = createTestEnv();

  assert.equal(
    await assertRateLimitAllowed(env, "login", "single-admin", {
      now: "2025-01-01T00:00:00.000Z",
      limit: 2,
      windowSeconds: 60,
    }),
    null,
  );
  assert.equal(state.rateLimits.get("login:single-admin").count, 1);

  assert.equal(
    await assertRateLimitAllowed(env, "login", "single-admin", {
      now: "2025-01-01T00:00:15.000Z",
      limit: 2,
      windowSeconds: 60,
    }),
    null,
  );
  assert.equal(state.rateLimits.get("login:single-admin").count, 2);

  const blocked = await assertRateLimitAllowed(env, "login", "single-admin", {
    now: "2025-01-01T00:00:20.000Z",
    limit: 2,
    windowSeconds: 60,
  });

  assert.equal(blocked.status, 429);
  assert.equal(state.rateLimits.get("login:single-admin").count, 2);
});

test("assertRateLimitAllowed recovers when the first insert loses a uniqueness race", async () => {
  const { env, state } = createTestEnv({
    uniqueInsertRaceKeys: ["login:single-admin"],
  });

  assert.equal(
    await assertRateLimitAllowed(env, "login", "single-admin", {
      now: "2025-01-01T00:00:00.000Z",
      limit: 2,
      windowSeconds: 60,
    }),
    null,
  );
  assert.equal(state.rateLimits.get("login:single-admin").count, 2);
});

test("assertRateLimitAllowed increments from the latest persisted count during update races", async () => {
  const { env, state } = createTestEnv({
    concurrentIncrementKeys: ["login:single-admin"],
  });
  state.rateLimits.set("login:single-admin", {
    id: "existing_limit",
    bucket: "login",
    key: "single-admin",
    count: 1,
    window_started_at: "2025-01-01T00:00:00.000Z",
    expires_at: "2025-01-01T00:01:00.000Z",
  });

  assert.equal(
    await assertRateLimitAllowed(env, "login", "single-admin", {
      now: "2025-01-01T00:00:15.000Z",
      limit: 5,
      windowSeconds: 60,
    }),
    null,
  );
  assert.equal(state.rateLimits.get("login:single-admin").count, 3);
});

test("writeAuditEvent persists audit rows to cms_audit_log", async () => {
  const { env, state } = createTestEnv();

  await writeAuditEvent(env, {
    action: "login_attempt",
    target_type: "admin_session",
    target_id: null,
    metadata: { stage: "attempted" },
  });

  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "login_attempt");
  assert.deepEqual(
    JSON.parse(state.auditLog[0].metadata_json),
    { stage: "attempted" },
  );
});

test("login route records attempted and successful audit outcomes", async () => {
  const { env, state } = createTestEnv();
  const response = await onRequestPost({
    env,
    request: new Request("https://example.com/api/admin/login", {
      method: "POST",
      headers: {
        "cf-access-authenticated-user-email": "admin@example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "test-password" }),
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie")?.startsWith("cms_session="), true);
  assert.equal(state.sessions.size, 1);
  assert.equal(state.auditLog.length, 2);
  assert.equal(state.auditLog[0].action, "login_attempt");
  assert.equal(state.auditLog[1].action, "login_success");
  assert.deepEqual(
    JSON.parse(state.auditLog[0].metadata_json),
    { stage: "attempted" },
  );
  assert.deepEqual(
    JSON.parse(state.auditLog[1].metadata_json),
    { stage: "success" },
  );
  assert.equal(state.rateLimits.get("login:single-admin").count, 1);
});

test("login route does not consume rate-limit quota when audit logging fails", async () => {
  const { env, state } = createTestEnv({ failAuditWrites: true });

  await assert.rejects(
    () => onRequestPost({
      env,
      request: new Request("https://example.com/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-password" }),
      }),
    }),
    /audit write failed/,
  );

  assert.equal(state.rateLimits.size, 0);
});

test("login route records a failed audit outcome for invalid credentials", async () => {
  const { env, state } = createTestEnv();
  const response = await onRequestPost({
    env,
    request: new Request("https://example.com/api/admin/login", {
      method: "POST",
      headers: {
        "cf-access-authenticated-user-email": "admin@example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "wrong-password" }),
    }),
  });

  assert.equal(response.status, 401);
  assert.equal(state.auditLog.length, 2);
  assert.equal(state.auditLog[1].action, "login_failure");
  assert.deepEqual(
    JSON.parse(state.auditLog[1].metadata_json),
    { stage: "failure", reason: "invalid_credentials" },
  );
});

test("login route returns a structured 400 for invalid JSON", async () => {
  const { env, state } = createTestEnv();
  const response = await onRequestPost({
    env,
    request: new Request("https://example.com/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{invalid",
    }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_json" });
  assert.equal(state.rateLimits.size, 0);
});

test("logout route deletes the stored session, logs the event, and clears the cookie", async () => {
  const { env, state } = createTestEnv();
  state.sessions.set("session_123", {
    id: "session_123",
    user_id: "admin@example.com",
    csrf_token: "csrf_123",
    created_at: "2025-01-01T00:00:00.000Z",
    expires_at: "2025-01-01T08:00:00.000Z",
  });

  const response = await onRequestLogoutPost({
    env,
    request: new Request("https://example.com/api/admin/logout", {
      method: "POST",
      headers: {
        cookie: "cms_session=session_123",
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(state.sessions.has("session_123"), false);
  assert.match(response.headers.get("set-cookie") ?? "", /Secure/);
  assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Strict/);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "logout");
  assert.equal(state.auditLog[0].actor_user_id, "admin@example.com");
  assert.deepEqual(
    JSON.parse(state.auditLog[0].metadata_json),
    { sessionId: "session_123" },
  );
});

test("logout route still clears the cookie when audit logging fails", async () => {
  const { env, state } = createTestEnv({ failAuditWrites: true });
  state.sessions.set("session_123", {
    id: "session_123",
    user_id: "admin@example.com",
    csrf_token: "csrf_123",
    created_at: "2025-01-01T00:00:00.000Z",
    expires_at: "2025-01-01T08:00:00.000Z",
  });

  const response = await onRequestLogoutPost({
    env,
    request: new Request("https://example.com/api/admin/logout", {
      method: "POST",
      headers: {
        cookie: "cms_session=session_123",
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(state.sessions.has("session_123"), false);
  assert.match(response.headers.get("set-cookie") ?? "", /^cms_session=/);
});

test("session route disables caching for the response", async () => {
  const response = await onRequestSessionGet({
    request: new Request("https://example.com/api/admin/session"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("session route returns the authenticated user for a valid session cookie", async () => {
  const { env } = createTestEnv();
  env.CMS_DB.prepare("INSERT INTO cms_sessions (id, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(
      "session_123",
      "admin@example.com",
      "csrf_123",
      "2025-01-01T00:00:00.000Z",
      "2999-01-01T08:00:00.000Z",
    )
    .run();

  const response = await onRequestSessionGet({
    env,
    request: new Request("https://example.com/api/admin/session", {
      headers: {
        cookie: "cms_session=session_123",
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: true,
    userId: "admin@example.com",
    csrfToken: "csrf_123",
  });
});

test("session route returns unauthenticated for an expired session", async () => {
  const { env } = createTestEnv();
  env.CMS_DB.prepare("INSERT INTO cms_sessions (id, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(
      "session_123",
      "admin@example.com",
      "csrf_123",
      "2025-01-01T00:00:00.000Z",
      "2000-01-01T08:00:00.000Z",
    )
    .run();

  const response = await onRequestSessionGet({
    env,
    request: new Request("https://example.com/api/admin/session", {
      headers: {
        cookie: "cms_session=session_123",
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});
