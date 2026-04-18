const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_LIMIT = 5;

function requireDatabase(env) {
  if (!env?.CMS_DB || typeof env.CMS_DB.prepare !== "function") {
    throw new Error("Missing CMS_DB binding");
  }

  return env.CMS_DB;
}

function normalizeTimestamp(value = new Date()) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addSeconds(timestamp, seconds) {
  return new Date(Date.parse(timestamp) + (seconds * 1000)).toISOString();
}

function buildRateLimitResponse(expiresAt, now) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((Date.parse(expiresAt) - Date.parse(now)) / 1000),
  );

  return new Response("Too many requests", {
    status: 429,
    headers: {
      "retry-after": String(retryAfterSeconds),
    },
  });
}

export async function assertRateLimitAllowed(env, bucket, key, options = {}) {
  const db = requireDatabase(env);

  const now = normalizeTimestamp(options.now);
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const expiresAt = addSeconds(now, windowSeconds);
  const existing = await db
    .prepare(
      "SELECT id, bucket, key, count, window_started_at, expires_at FROM cms_rate_limits WHERE bucket = ? AND key = ?",
    )
    .bind(bucket, key)
    .first();

  if (!existing) {
    await db
      .prepare(
        "INSERT INTO cms_rate_limits (id, bucket, key, count, window_started_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(crypto.randomUUID(), bucket, key, 1, now, expiresAt)
      .run();
    return null;
  }

  if (existing.expires_at <= now) {
    await db
      .prepare(
        "UPDATE cms_rate_limits SET count = ?, window_started_at = ?, expires_at = ? WHERE id = ?",
      )
      .bind(1, now, expiresAt, existing.id)
      .run();
    return null;
  }

  if (existing.count >= limit) {
    return buildRateLimitResponse(existing.expires_at, now);
  }

  await db
    .prepare(
      "UPDATE cms_rate_limits SET count = ?, window_started_at = ?, expires_at = ? WHERE id = ?",
    )
    .bind(existing.count + 1, existing.window_started_at, existing.expires_at, existing.id)
    .run();

  return null;
}
