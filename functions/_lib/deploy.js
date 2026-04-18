export function buildDeployHeaders(env) {
  return {
    "content-type": "application/json",
    "x-deploy-secret": env.PAGES_DEPLOY_HOOK_SECRET,
  };
}
