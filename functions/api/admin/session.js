import { json } from "../../_lib/json.js";
import { readSession } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await readSession(context.env, context.request);

  return json(
    session
      ? { authenticated: true, userId: session.user_id, csrfToken: session.csrf_token }
      : { authenticated: false },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
