export function requireCmsEnv(env) {
  const required = [
    "CMS_SESSION_SECRET",
    "CMS_PASSWORD_HASH",
    "PAGES_DEPLOY_HOOK_URL",
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required CMS env: ${key}`);
    }
  }

  return {
    sessionSecret: env.CMS_SESSION_SECRET,
    passwordHash: env.CMS_PASSWORD_HASH,
    deployHookUrl: env.PAGES_DEPLOY_HOOK_URL,
  };
}
