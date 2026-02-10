import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

Deno.serve((req: Request) => {
  return serveDir(req, {
    fsRoot: "dist",
    quiet: true,
    headers: [
      "Access-Control-Allow-Origin: *",
      "Cache-Control: public, max-age=31536000, immutable",
    ],
  }).then((response) => {
    if (response.status === 404) {
      return serveDir(
        new Request(new URL("/index.html", req.url), req),
        { fsRoot: "dist", quiet: true }
      );
    }
    return response;
  });
});
