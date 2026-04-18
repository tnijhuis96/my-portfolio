export async function onRequestGet() {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>CMS Admin</title></head>
  <body>
    <main>
      <h1>CMS Admin</h1>
      <p>This route is intentionally protected by Cloudflare Access and app auth.</p>
    </main>
  </body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
