export function buildDeployHeaders(env) {
  const headers = {
    "content-type": "application/json",
  };

  const primaryDeploySecret = env?.PAGES_DEPLOY_HOOK_SECRET;
  const deploySecret =
    primaryDeploySecret === "" || primaryDeploySecret == null
      ? env?.DEPLOY_WEBHOOK_SECRET
      : primaryDeploySecret;

  if (deploySecret) {
    headers["x-deploy-secret"] = deploySecret;
  }

  return headers;
}
