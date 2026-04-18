import { json } from "../../../../_lib/json.js";

export async function onRequestPost() {
  return json(
    {
      ok: false,
      error: "not_implemented",
      message: "Post publish is not implemented yet.",
      publishState: "pending_deploy",
    },
    { status: 501 },
  );
}
