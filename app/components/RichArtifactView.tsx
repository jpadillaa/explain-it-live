"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MessageCircleQuestion, RotateCcw, TriangleAlert } from "lucide-react";
import type { RichArtifact } from "@/lib/artifacts";
import { artifactTheme } from "@/lib/artifact-prompt";
import type { Context } from "@/lib/tutor";

type Props = {
  artifact: RichArtifact;
  disabled: boolean;
  onAsk: (text: string) => void;
  onState: (estado: Context["estado"]) => void;
};

const eyebrows: Record<RichArtifact["tipo"], string> = {
  html: "LABORATORIO INTERACTIVO",
  svg: "ESQUEMA",
  mermaid: "DIAGRAMA",
  vegalite: "GRÁFICO INTERACTIVO",
};

export function RichArtifactView({ artifact, disabled, onAsk, onState }: Props) {
  const [problem, setProblem] = useState("");
  return (
    <>
      <div className="eyebrow">{eyebrows[artifact.tipo]}</div>
      <h1>{artifact.titulo}</h1>
      <p className="subtitle">{artifact.descripcion}</p>
      {artifact.guia.length > 0 && (
        <ol className="rich-guide">
          {artifact.guia.map((step, index) => (
            <li key={`guia-${index}`}>{step}</li>
          ))}
        </ol>
      )}
      <div className="rich-stage">
        {artifact.tipo === "html" || artifact.tipo === "svg" ? (
          <SandboxFrame
            artifact={artifact}
            disabled={disabled}
            onAsk={onAsk}
            onState={onState}
            onProblem={setProblem}
          />
        ) : artifact.tipo === "mermaid" ? (
          <MermaidView code={artifact.codigo} onProblem={setProblem} />
        ) : (
          <VegaView spec={artifact.spec} onProblem={setProblem} />
        )}
      </div>
      {problem && (
        <div className="rich-problem" role="alert">
          <TriangleAlert size={16} />
          <span>La visualización tuvo un problema: {problem}</span>
          <button
            disabled={disabled}
            onClick={() =>
              onAsk(
                `La visualización «${artifact.titulo}» muestra este error: ${problem}. Corrígela manteniendo la idea.`,
              )
            }
          >
            <RotateCcw size={14} /> Pedir corrección
          </button>
        </div>
      )}
      <div className="rich-actions">
        <button
          disabled={disabled}
          onClick={() =>
            onAsk(`Explícame lo que muestra «${artifact.titulo}» y qué debería observar.`)
          }
        >
          <MessageCircleQuestion size={15} /> Explícame esta visualización ✦
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// HTML y SVG: iframe con sandbox="allow-scripts" (origen opaco: sin acceso a la
// app, cookies ni almacenamiento) y una CSP que bloquea toda la red.
// ---------------------------------------------------------------------------
const csp =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'";

const frameStyles = `:root{${Object.entries(artifactTheme)
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
@media (prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}`;

const bridge = `(function(){
var send=function(m){m.canal="tutor-artefacto";parent.postMessage(m,"*")};
window.tutor={
preguntar:function(t){send({tipo:"preguntar",texto:String(t||"").slice(0,500)})},
estado:function(o){try{send({tipo:"estado",estado:JSON.parse(JSON.stringify(o||{}))})}catch(e){}}
};
window.addEventListener("error",function(e){send({tipo:"error",mensaje:String(e.message||"error").slice(0,300)})});
var measure=function(){send({tipo:"altura",altura:Math.ceil(document.documentElement.scrollHeight)})};
window.addEventListener("load",measure);
new ResizeObserver(measure).observe(document.documentElement);
})();`;

/** Si el modelo devuelve un documento completo, conserva estilos de <head> y el cuerpo. */
function bodyFragment(html: string) {
  if (!/<(?:html|head|body)\b/i.test(html)) return html;
  const styles = html.match(/<style[\s\S]*?<\/style>/gi)?.join("\n") ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1];
  const rest = body ?? html.replace(/<!doctype[^>]*>|<\/?html[^>]*>|<head[\s\S]*?<\/head>|<\/?body[^>]*>/gi, "");
  return body ? `${styles}\n${rest}` : rest;
}

function documentFor(artifact: Extract<RichArtifact, { tipo: "html" | "svg" }>) {
  const content =
    artifact.tipo === "svg"
      ? `<div style="display:flex;justify-content:center">${artifact.svg}</div>`
      : bodyFragment(artifact.html);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${frameStyles}</style><script>${bridge}</script></head><body>${content}</body></html>`;
}

function cleanState(value: unknown): Context["estado"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
    .filter(([, v]) => typeof v !== "number" || Number.isFinite(v))
    .slice(0, 20)
    .map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 200) : v]);
  return Object.fromEntries(entries);
}

function SandboxFrame({
  artifact,
  disabled,
  onAsk,
  onState,
  onProblem,
}: Props & { artifact: Extract<RichArtifact, { tipo: "html" | "svg" }>; onProblem: (p: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  const lastAsk = useRef(0);
  const srcDoc = useMemo(() => documentFor(artifact), [artifact]);
  const latest = useRef({ disabled, onAsk, onState, onProblem });
  latest.current = { disabled, onAsk, onState, onProblem };
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.canal !== "tutor-artefacto") return;
      const { disabled, onAsk, onState, onProblem } = latest.current;
      if (data.tipo === "altura" && Number.isFinite(data.altura))
        setHeight(Math.min(1400, Math.max(240, data.altura)));
      else if (data.tipo === "estado") onState(cleanState(data.estado));
      else if (data.tipo === "error") onProblem(String(data.mensaje).slice(0, 300));
      else if (data.tipo === "preguntar" && typeof data.texto === "string" && data.texto.trim()) {
        // Limita preguntas automáticas: una cada 2 s y nunca mientras el tutor responde.
        if (disabled || Date.now() - lastAsk.current < 2000) return;
        lastAsk.current = Date.now();
        onAsk(data.texto.trim().slice(0, 500));
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return (
    <iframe
      ref={frame}
      className="rich-frame"
      title={artifact.titulo}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      style={{ height }}
    />
  );
}

// ---------------------------------------------------------------------------
// Mermaid: securityLevel "strict" sanea el SVG resultante.
// ---------------------------------------------------------------------------
function MermaidView({ code, onProblem }: { code: string; onProblem: (p: string) => void }) {
  const id = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: artifactTheme["--tutor-font"],
        themeVariables: {
          primaryColor: "#ece8fa",
          primaryBorderColor: "#6c58cc",
          primaryTextColor: "#28283c",
          lineColor: "#6c58cc",
          secondaryColor: "#fdf1e4",
          tertiaryColor: "#f7f5fc",
          fontSize: "15px",
        },
      });
      const rendered = await mermaid.render(id, code);
      if (!cancelled) setSvg(rendered.svg);
    })().catch((error) => {
      if (!cancelled) onProblem(error instanceof Error ? error.message.slice(0, 300) : "no se pudo dibujar");
    });
    return () => {
      cancelled = true;
    };
  }, [code, id, onProblem]);
  return svg ? (
    <div className="mermaid-view" dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className="rich-loading">Dibujando el diagrama…</div>
  );
}

// ---------------------------------------------------------------------------
// Vega-Lite: sin acciones de exportación y con un cargador que bloquea la red.
// ---------------------------------------------------------------------------
function VegaView({ spec, onProblem }: { spec: Record<string, unknown>; onProblem: (p: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let finalize: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const [{ default: embed }, vega] = await Promise.all([import("vega-embed"), import("vega")]);
      if (cancelled || !container.current) return;
      const blocked = () => Promise.reject(new Error("Los recursos externos están deshabilitados"));
      const loader = { ...vega.loader(), load: blocked, sanitize: blocked, http: blocked, file: blocked };
      const result = await embed(
        container.current,
        { ...(spec as any), $schema: undefined },
        {
          actions: false,
          renderer: "svg",
          loader: loader as any,
          config: {
            font: "DM Sans, system-ui, sans-serif",
            background: "white",
            range: { category: ["#6c58cc", "#e8913a", "#2f9e6e", "#d4543f", "#3b82c4", "#a395e6"] },
            axis: { labelColor: "#6f6d85", titleColor: "#28283c", gridColor: "#eeebf5", labelFontSize: 12, titleFontSize: 13 },
            legend: { labelColor: "#28283c", titleColor: "#28283c" },
            title: { color: "#28283c", fontSize: 16 },
            mark: { color: "#6c58cc" },
          },
        },
      );
      if (cancelled) result.finalize();
      else finalize = () => result.finalize();
    })().catch((error) => {
      if (!cancelled) onProblem(error instanceof Error ? error.message.slice(0, 300) : "no se pudo dibujar");
    });
    return () => {
      cancelled = true;
      finalize?.();
    };
  }, [spec, onProblem]);
  return <div className="vega-view" ref={container} />;
}
