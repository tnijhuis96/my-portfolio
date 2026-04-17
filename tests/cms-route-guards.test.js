import test from "node:test";
import assert from "node:assert/strict";
import { requireCmsEnv } from "../functions/_lib/env.js";

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
