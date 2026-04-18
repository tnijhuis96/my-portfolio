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

async function readRateLimitEntry(db, bucket, key) {
  return db
    .prepare(
      "SELECT id, bucket, key, count, window_started_at, expires_at FROM cms_rate_limits WHERE bucket = ? AND key = ?",
    )
    .bind(bucket, key)
    .first();
}

function getMutationChanges(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

export async function assertRateLimitAllowed(env, bucket, key, options = {}) {
  const db = requireDatabase(env);

  const now = normalizeTimestamp(options.now);
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const expiresAt = addSeconds(now, windowSeconds);

  const insertResult = await db
    .prepare(
      "INSERT INTO cms_rate_limits (id, bucket, key, count, window_started_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(bucket, key) DO NOTHING",
    )
    .bind(crypto.randomUUID(), bucket, key, 1, now, expiresAt)
    .run();

  if (getMutationChanges(insertResult) > 0) {
    return null;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await readRateLimitEntry(db, bucket, key);
    if (!existing) {
      throw new Error(`Failed to read rate limit row for ${bucket}:${key}`);
    }

    if (existing.expires_at <= now) {
      const resetResult = await db
        .prepare(
          "UPDATE cms_rate_limits SET count = ?, window_started_at = ?, expires_at = ? WHERE bucket = ? AND key = ? AND expires_at <= ?",
        )
        .bind(1, now, expiresAt, bucket, key, now)
        .run();

      if (getMutationChanges(resetResult) > 0) {
        return null;
      }

      continue;
    }

    if (existing.count >= limit) {
      return buildRateLimitResponse(existing.expires_at, now);
    }

    const incrementResult = await db
      .prepare(
        "UPDATE cms_rate_limits SET count = count + 1 WHERE bucket = ? AND key = ? AND expires_at > ? AND count < ?",
      )
      .bind(bucket, key, now, limit)
      .run();

    if (getMutationChanges(incrementResult) > 0) {
      return null;
    }
  }

  const latest = await readRateLimitEntry(db, bucket, key);
  if (!latest) {
    throw new Error(`Failed to finalize rate limit row for ${bucket}:${key}`);
  }

  if (latest.expires_at <= now) {
    const resetResult = await db
      .prepare(
        "UPDATE cms_rate_limits SET count = ?, window_started_at = ?, expires_at = ? WHERE bucket = ? AND key = ? AND expires_at <= ?",
      )
      .bind(1, now, expiresAt, bucket, key, now)
      .run();

    if (getMutationChanges(resetResult) > 0) {
      return null;
    }
  }

  if (latest.count >= limit) {
    return buildRateLimitResponse(latest.expires_at, now);
  }

  const incrementResult = await db
    .prepare(
      "UPDATE cms_rate_limits SET count = count + 1 WHERE bucket = ? AND key = ? AND expires_at > ? AND count < ?",
    )
    .bind(bucket, key, now, limit)
    .run();

  if (getMutationChanges(incrementResult) > 0) {
    return null;
  }

  return buildRateLimitResponse(latest.expires_at, now);
}
