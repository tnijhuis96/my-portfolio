export function buildDeployHeaders(env) {
  const headers = {
    "content-type": "application/json",
  };

  const primaryDeploySecret = env?.PAGES_DEPLOY_HOOK_SECRET?.trim();
  const deploySecret = primaryDeploySecret || env?.DEPLOY_WEBHOOK_SECRET?.trim();

  if (deploySecret) {
    headers["x-deploy-secret"] = deploySecret;
  }

  return headers;
}

export async function triggerDeploy(env, runtime = globalThis) {
  const response = await runtime.fetch(env.PAGES_DEPLOY_HOOK_URL, {
    method: "POST",
    headers: buildDeployHeaders(env),
    body: JSON.stringify({
      event: "cms-publish",
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  return { ok: true, status: response.status };
}
