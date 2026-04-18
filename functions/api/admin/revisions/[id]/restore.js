import { json } from "../../../../_lib/json.js";

export async function onRequestPost() {
  return json(
    {
      ok: false,
      error: "not_implemented",
      message: "Revision restore is not implemented in Task 5.",
    },
    { status: 501 },
  );
}
