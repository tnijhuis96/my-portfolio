import { json } from "../../../../_lib/json.js";

export async function onRequestPost() {
  return json({
    ok: true,
    publishState: "pending_deploy",
  });
}
