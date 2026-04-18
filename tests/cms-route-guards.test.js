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

        throw new Error(`Unsupported run() query: ${query}`);
      },
    };
  }

  return {
    env: {
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

test("login route records a neutral attempt audit payload", async () => {
  const { env, state } = createTestEnv();
  const response = await onRequestPost({
    env,
    request: new Request("https://example.com/api/admin/login", {
      method: "POST",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(state.auditLog.length, 1);
  assert.deepEqual(
    JSON.parse(state.auditLog[0].metadata_json),
    { stage: "attempted" },
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
      }),
    }),
    /audit write failed/,
  );

  assert.equal(state.rateLimits.size, 0);
});

test("logout route disables caching for the response", async () => {
  const { env } = createTestEnv();
  const response = await onRequestLogoutPost({
    env,
    request: new Request("https://example.com/api/admin/logout", {
      method: "POST",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("session route disables caching for the response", async () => {
  const response = await onRequestSessionGet({
    request: new Request("https://example.com/api/admin/session"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
