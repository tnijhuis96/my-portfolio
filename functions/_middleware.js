export function shouldProtectAdminPath(pathname) {
  return pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");
}
