CREATE TABLE cms_rate_limits (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  window_started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX cms_rate_limits_bucket_key_idx
ON cms_rate_limits(bucket, key);
