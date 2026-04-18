import { json } from "../../_lib/json.js";

export async function onRequestGet() {
  return json({ authenticated: false });
}
