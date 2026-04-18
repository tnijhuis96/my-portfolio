import { json } from "../../../_lib/json.js";

export async function onRequestGet() {
  return json({ posts: [] });
}

export async function onRequestPost() {
  return json(
    {
      ok: false,
      error: "not_implemented",
      message: "Post creation is not implemented in Task 5.",
    },
    { status: 501 },
  );
}
