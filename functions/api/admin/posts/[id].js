import { json } from "../../../_lib/json.js";

export async function onRequestGet() {
  return json({ post: null });
}

export async function onRequestPut() {
  return json({ ok: true });
}

export async function onRequestDelete() {
  return json({ ok: true, deleted: true });
}
