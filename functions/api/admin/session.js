import { json } from "../../_lib/json.js";

export async function onRequestGet(_context) {
  return json({ authenticated: false }, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
