export function normalizePostRecord(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
  };
}

export async function runOne(env, query, ...bindings) {
  return env.CMS_DB.prepare(query).bind(...bindings).first();
}

export async function runAll(env, query, ...bindings) {
  const result = await env.CMS_DB.prepare(query).bind(...bindings).all();
  return result.results;
}
