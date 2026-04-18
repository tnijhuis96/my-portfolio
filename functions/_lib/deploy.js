export function buildDeployHeaders(env) {
  const headers = {
    "content-type": "application/json",
  };

  if (env.PAGES_DEPLOY_HOOK_SECRET) {
    headers["x-deploy-secret"] = env.PAGES_DEPLOY_HOOK_SECRET;
  }

  return headers;
}
