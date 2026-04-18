import { json } from "../../_lib/json.js";

export async function onRequestPost(context) {
  return json({ ok: true, stage: "replace-with-real-login" });
}
