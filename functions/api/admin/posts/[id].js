import { json } from "../../../_lib/json.js";

export async function onRequestGet() {
  return json({ post: null });
}

export async function onRequestPut() {
  return json(
    {
      ok: false,
      error: "not_implemented",
      message: "Post updates are not implemented in Task 5.",
    },
    { status: 501 },
  );
}

export async function onRequestDelete() {
  return json(
    {
      ok: false,
      error: "not_implemented",
      message: "Post deletion is not implemented in Task 5.",
    },
    { status: 501 },
  );
}
