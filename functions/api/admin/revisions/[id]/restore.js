import { json } from "../../../../_lib/json.js";

export async function onRequestPost() {
  return json({ ok: true, restored: true });
}
