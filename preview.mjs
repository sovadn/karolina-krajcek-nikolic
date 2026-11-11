import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const { pathname } = new URL(request.url, "http://localhost");
    const route = pathname === "/" ? "/index.html" : pathname.replace(/\/$/, "");
    const asset = resolve(root, `.${extname(route) ? route : `${route}.html`}`);
    if (!asset.startsWith(root + sep)) throw new Error("Pogrešna putanja.");
    const body = await readFile(asset);
    response.writeHead(200, { "Content-Type": types[extname(asset)] || "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Stranica nije pronađena.");
  }
}).listen(port, host, () => console.log(`Lokalni pregled na portu ${port}`));
