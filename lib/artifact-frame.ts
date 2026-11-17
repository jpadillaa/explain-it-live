import type { RichArtifact } from "./artifacts";
import { artifactKit, artifactKitStyles } from "./artifact-kit";
import { artifactTheme } from "./artifact-prompt";

export type FramedArtifact = Extract<RichArtifact, { tipo: "html" | "svg" }>;

// Sin red: solo scripts y estilos en línea, imágenes data:/blob:.
const csp =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'";

const baseStyles = `:root{${Object.entries(artifactTheme)
  .map(([key, value]) => `${key}:${value}`)
  .join(";")}}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:var(--tutor-ink);font-family:var(--tutor-font);font-size:15px;line-height:1.5}
body{padding:4px 2px 12px}
svg{max-width:100%}
button{font:inherit;cursor:pointer;border:1px solid var(--tutor-line);background:#fff;color:var(--tutor-ink);border-radius:8px;padding:8px 14px;transition:background .15s,border-color .15s}
button:hover{background:var(--tutor-purple-soft);border-color:var(--tutor-purple)}
button:disabled{opacity:.5;cursor:default}
button.primario{background:var(--tutor-purple);border-color:var(--tutor-purple);color:#fff}
button.primario:hover{filter:brightness(1.08)}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--tutor-purple);outline-offset:2px}
input[type=range]{accent-color:var(--tutor-purple);width:100%}
select{font:inherit;border:1px solid var(--tutor-line);border-radius:8px;padding:6px 10px;background:#fff}
.tarjeta{border:1px solid var(--tutor-line);border-radius:12px;padding:14px 16px;background:var(--tutor-surface)}
.fila{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.etiqueta{font-size:12px;color:var(--tutor-muted)}
@media (prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
${artifactKitStyles}`;

/** Librerías locales disponibles en el iframe; se incrustan solo si el código las usa. */
const vendors = {
  anime: /\banime\s*[.(]/,
  d3: /\bd3\s*\./,
} as const;
const vendorCache = new Map<string, Promise<string>>();
function vendor(name: keyof typeof vendors) {
  if (!vendorCache.has(name))
    vendorCache.set(
      name,
      fetch(`/api/vendor?lib=${name}`).then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar ${name}`);
        return r.text();
      }),
    );
  const pending = vendorCache.get(name)!;
  pending.catch(() => vendorCache.delete(name));
  return pending;
}

/** Si el modelo devuelve un documento completo, conserva estilos de <head> y el cuerpo. */
function bodyFragment(html: string) {
  if (!/<(?:html|head|body)\b/i.test(html)) return html;
  const styles = html.match(/<style[\s\S]*?<\/style>/gi)?.join("\n") ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1];
  const rest = body ?? html.replace(/<!doctype[^>]*>|<\/?html[^>]*>|<head[\s\S]*?<\/head>|<\/?body[^>]*>/gi, "");
  return body ? `${styles}\n${rest}` : rest;
}

// Un </script> literal dentro de una librería cerraría la etiqueta antes de tiempo.
const inlineScript = (code: string) => `<script>${code.replace(/<\/script/gi, "<\\/script")}</script>`;

export async function frameDocument(artifact: FramedArtifact, options: { revision?: boolean } = {}) {
  const source = artifact.tipo === "html" ? artifact.html : artifact.svg;
  const names = (Object.keys(vendors) as (keyof typeof vendors)[]).filter((name) =>
    vendors[name].test(source),
  );
  const libraries = await Promise.all(names.map(vendor));
  const content =
    artifact.tipo === "svg"
      ? `<div style="display:flex;justify-content:center">${artifact.svg}</div>`
      : bodyFragment(artifact.html);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseStyles}</style>${libraries.map(inlineScript).join("")}${options.revision ? inlineScript("window.TUTOR_REVISION=true;") : ""}${inlineScript(artifactKit)}</head><body>${content}</body></html>`;
}

/** Mensajes que el iframe envía al marco de la app. */
export type FrameMessage =
  | { tipo: "altura"; altura: number }
  | { tipo: "estado"; estado: unknown }
  | { tipo: "error"; mensaje: string }
  | { tipo: "preguntar"; texto: string }
  | { tipo: "revision"; problemas: string[] };

export function frameMessage(event: MessageEvent, frame: HTMLIFrameElement | null): FrameMessage | null {
  if (!frame || event.source !== frame.contentWindow) return null;
  const data = event.data;
  if (!data || typeof data !== "object" || data.canal !== "tutor-artefacto") return null;
  if (data.tipo === "revision")
    return {
      tipo: "revision",
      problemas: Array.isArray(data.problemas)
        ? data.problemas.filter((p: unknown) => typeof p === "string").slice(0, 12).map((p: string) => p.slice(0, 400))
        : [],
    };
  return data as FrameMessage;
}
