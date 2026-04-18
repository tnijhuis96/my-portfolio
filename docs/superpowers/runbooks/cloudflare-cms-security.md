# Cloudflare CMS Security Runbook

## Cloudflare Access
- Protect `/admin` and `/api/admin/*`
- Allow only Thomas's identity

## Required secrets
- `CMS_SESSION_SECRET`
- `CMS_PASSWORD_HASH`
- `PAGES_DEPLOY_HOOK_URL`
- `PAGES_DEPLOY_HOOK_SECRET`

## Verification
- anonymous request to `/admin` is blocked
- anonymous request to `/api/admin/session` is blocked
- authenticated Access user still needs app login
- publish path writes audit log and returns deploy state
