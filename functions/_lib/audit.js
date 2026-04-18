function normalizeTimestamp(value = new Date()) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function requireDatabase(env) {
  if (!env?.CMS_DB || typeof env.CMS_DB.prepare !== "function") {
    throw new Error("Missing CMS_DB binding");
  }

  return env.CMS_DB;
}

export async function writeAuditEvent(env, event) {
  const db = requireDatabase(env);

  const record = {
    id: crypto.randomUUID(),
    actorUserId: event.actor_user_id ?? event.actorUserId ?? null,
    action: event.action,
    targetType: event.target_type ?? event.targetType,
    targetId: event.target_id ?? event.targetId ?? null,
    metadataJson: JSON.stringify(event.metadata ?? {}),
    createdAt: normalizeTimestamp(event.created_at ?? event.createdAt),
  };

  await db
    .prepare(
      "INSERT INTO cms_audit_log (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      record.id,
      record.actorUserId,
      record.action,
      record.targetType,
      record.targetId,
      record.metadataJson,
      record.createdAt,
    )
    .run();

  return record;
}
