import { json } from "../../../_lib/json.js";

export async function onRequestGet() {
  return json({ posts: [] });
}

export async function onRequestPost() {
  return json({ ok: true });
}
