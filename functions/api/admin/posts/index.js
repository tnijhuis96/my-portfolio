import { json } from "../../../_lib/json.js";
import {
  createPost,
  isDuplicateSlugConstraint,
  isPostValidationError,
} from "../../../_lib/content.js";
import { runAll } from "../../../_lib/db.js";

export async function onRequestGet(context) {
  const posts = await runAll(
    context.env,
    "SELECT id, slug, title, summary, status, published_at, deleted_at, updated_at FROM cms_posts WHERE deleted_at IS NULL ORDER BY updated_at DESC",
  );
  return json({ posts });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    const post = await createPost(context.env, body);
    return json({ ok: true, post }, { status: 201 });
  } catch (error) {
    if (isPostValidationError(error)) {
      return json({ ok: false, error: error.code, fields: error.fields }, { status: error.status });
    }

    if (isDuplicateSlugConstraint(error)) {
      return json({ ok: false, error: "duplicate_slug" }, { status: 409 });
    }

    throw error;
  }
}
