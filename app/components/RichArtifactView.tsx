"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MessageCircleQuestion, RotateCcw, TriangleAlert } from "lucide-react";
import type { RichArtifact } from "@/lib/artifacts";
import { artifactTheme } from "@/lib/artifact-prompt";
import { frameDocument, frameMessage, type FramedArtifact } from "@/lib/artifact-frame";
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
/** Documento del iframe (incrusta el kit y las librerías que use el artefacto). */
function useFrameDocument(artifact: FramedArtifact, onProblem?: (p: string) => void, revision = false) {
  const [doc, setDoc] = useState<{ for: FramedArtifact; html: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    frameDocument(artifact, { revision })
      .then((html) => !cancelled && setDoc({ for: artifact, html }))
      .catch((error) => !cancelled && onProblem?.(error instanceof Error ? error.message : "no se pudo preparar"));
    return () => {
      cancelled = true;
    };
  }, [artifact, onProblem, revision]);
  return doc?.for === artifact ? doc.html : null;
}

/**
 * Dibuja el artefacto fuera de pantalla, con el ancho del panel y altura amplia,
 * y devuelve los problemas visuales que detecta el kit (o [] si no responde a tiempo).
 */
export function ArtifactReviewer({
  artifact,
  width,
  onResult,
}: {
  artifact: FramedArtifact;
  width: number;
  onResult: (problemas: string[]) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const done = useRef(false);
  const report = useRef(onResult);
  report.current = onResult;
  const [reportProblem] = useState(() => (problem: string) => finish([`No se pudo preparar: ${problem}`]));
  const srcDoc = useFrameDocument(artifact, reportProblem, true);
  function finish(problemas: string[]) {
    if (done.current) return;
    done.current = true;
    report.current(problemas);
  }
  useEffect(() => {
    function receive(event: MessageEvent) {
      const data = frameMessage(event, frame.current);
      if (data?.tipo === "revision") finish(data.problemas);
    }
    window.addEventListener("message", receive);
    // Si el artefacto no termina de cargar, se muestra igualmente.
    const timer = setTimeout(() => finish([]), 6000);
    return () => {
      window.removeEventListener("message", receive);
      clearTimeout(timer);
    };
  }, []);
  if (srcDoc === null) return null;
  return (
    <iframe
      ref={frame}
      aria-hidden="true"
      tabIndex={-1}
      title="Revisión de la visualización"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      style={{ position: "fixed", left: -10000, top: 0, width, height: 1400, border: 0, opacity: 0, pointerEvents: "none" }}
    />
  );
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
}: Props & { artifact: FramedArtifact; onProblem: (p: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  const lastAsk = useRef(0);
  const srcDoc = useFrameDocument(artifact, onProblem);
  const latest = useRef({ disabled, onAsk, onState, onProblem });
  latest.current = { disabled, onAsk, onState, onProblem };
  useEffect(() => {
    function receive(event: MessageEvent) {
      const data = frameMessage(event, frame.current);
      if (!data) return;
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
  if (srcDoc === null) return <div className="rich-loading">Preparando la visualización…</div>;
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
