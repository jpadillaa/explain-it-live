import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Librerías que el iframe de los artefactos puede usar sin red. El cliente las
// descarga de aquí una vez y las incrusta en el documento aislado.
const libraries: Record<string, string> = {
  anime: "animejs/lib/anime.min.js",
  d3: "d3/dist/d3.min.js",
};
const cache = new Map<string, Promise<string>>();

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("lib") ?? "";
  const file = Object.hasOwn(libraries, name) ? libraries[name] : null;
  if (!file) return Response.json({ error: "Librería no disponible." }, { status: 404 });
  if (!cache.has(name))
    cache.set(name, readFile(path.join(process.cwd(), "node_modules", file), "utf8"));
  try {
    return new Response(await cache.get(name)!, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    cache.delete(name);
    return Response.json({ error: "No se pudo leer la librería." }, { status: 500 });
  }
}
