const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const bcrypt = require("bcryptjs");

const rootDir = path.resolve(__dirname, "..");
const hashScript = path.join(rootDir, "scripts", "hash-cms-password.js");
const migrationsDir = path.join(rootDir, "migrations");

test("hash helper reads password from stdin instead of argv", async () => {
  const password = "s3cure-passphrase";
  const result = spawnSync(process.execPath, [hashScript], {
    cwd: rootDir,
    input: [password, ""].join("\n"),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(result.stdout.trim(), "");
  assert.equal(await bcrypt.compare(password, result.stdout.trim()), true);
});

test("hash helper rejects password arguments to avoid leaking secrets", () => {
  const result = spawnSync(process.execPath, [hashScript, "unsafe-argument"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /stdin/i);
});

test("cms:migrate has a migrations directory with at least one sql file", () => {
  assert.equal(fs.existsSync(migrationsDir), true);

  const sqlFiles = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"));

  assert.ok(sqlFiles.length > 0, "expected at least one .sql migration");
});
