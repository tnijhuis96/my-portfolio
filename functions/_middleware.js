const ACCESS_IDENTITY_HEADERS = [
  "cf-access-authenticated-user-email",
  "cf-access-jwt-assertion",
];

export function shouldProtectAdminPath(pathname) {
  return pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");
}

function hasCloudflareAccessIdentity(request) {
  return ACCESS_IDENTITY_HEADERS.some((header) => {
    const value = request.headers.get(header);
    return typeof value === "string" && value.trim().length > 0;
  });
}

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;

  if (!shouldProtectAdminPath(pathname)) {
    return context.next();
  }

  if (!hasCloudflareAccessIdentity(context.request)) {
    return new Response("Cloudflare Access identity required", { status: 401 });
  }

  return context.next();
}
