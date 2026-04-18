export function buildDeployHeaders(env) {
  const headers = {
    "content-type": "application/json",
  };

  const deploySecret =
    env?.PAGES_DEPLOY_HOOK_SECRET ?? env?.DEPLOY_WEBHOOK_SECRET;

  if (deploySecret) {
    headers["x-deploy-secret"] = deploySecret;
  }

  return headers;
}
