import test from "node:test";
import assert from "node:assert/strict";
import { json } from "../functions/_lib/json.js";

test("json preserves headers passed as Headers instances", async () => {
  const response = json(
    { ok: true },
    { headers: new Headers({ "x-cms-test": "present" }) },
  );

  assert.equal(response.headers.get("x-cms-test"), "present");
  assert.equal(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.deepEqual(await response.json(), { ok: true });
});
