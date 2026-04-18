export function assertCsrf(request, session) {
  const header = request.headers.get("x-csrf-token");
  if (!session || !header || header !== session.csrf_token) {
    throw new Error("Invalid CSRF token.");
  }
}
