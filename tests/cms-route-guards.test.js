import test from "node:test";
import assert from "node:assert/strict";
import { requireCmsEnv } from "../functions/_lib/env.js";
import { writeAuditEvent } from "../functions/_lib/audit.js";
import { assertRateLimitAllowed } from "../functions/_lib/rate-limit.js";
import { onRequest, shouldProtectAdminPath } from "../functions/_middleware.js";
import { onRequestPost } from "../functions/api/admin/login.js";

function createTestEnv() {
  const state = {
    rateLimits: new Map(),
    auditLog: [],
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
          state.rateLimits.set(`${bucket}:${key}`, {
            id,
            bucket,
            key,
            count,
            window_started_at: windowStartedAt,
            expires_at: expiresAt,
          });
          return { success: true };
        }

        if (query.startsWith("UPDATE cms_rate_limits")) {
          const [count, windowStartedAt, expiresAt, id] = bindings;
          const existing = [...state.rateLimits.values()].find((entry) => entry.id === id);
          if (!existing) {
            throw new Error(`Missing rate limit row for ${id}`);
          }

          state.rateLimits.set(`${existing.bucket}:${existing.key}`, {
            ...existing,
            count,
            window_started_at: windowStartedAt,
            expires_at: expiresAt,
          });
          return { success: true };
        }

        if (query.startsWith("INSERT INTO cms_audit_log")) {
          const [id, actorUserId, action, targetType, targetId, metadataJson, createdAt] = bindings;
          state.auditLog.push({
            id,
            actor_user_id: actorUserId,
            action,
            target_type: targetType,
            target_id: targetId,
            metadata_json: metadataJson,
            created_at: createdAt,
          });
          return { success: true };
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
    { stage: "attempted", authenticated: false },
  );
  assert.equal(state.rateLimits.get("login:single-admin").count, 1);
});
