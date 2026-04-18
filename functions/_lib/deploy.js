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
  const deployHookUrl = env?.PAGES_DEPLOY_HOOK_URL?.trim();
  if (!deployHookUrl) {
    return { ok: false, status: 0 };
  }

  let response;
  try {
    response = await runtime.fetch(deployHookUrl, {
      method: "POST",
      headers: buildDeployHeaders(env),
      body: JSON.stringify({
        event: "cms-publish",
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    return { ok: false, status: 0 };
  }

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  return { ok: true, status: response.status };
}
