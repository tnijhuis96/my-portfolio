import test from "node:test";
import assert from "node:assert/strict";
import { requireCmsEnv } from "../functions/_lib/env.js";
import { shouldProtectAdminPath } from "../functions/_middleware.js";

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
