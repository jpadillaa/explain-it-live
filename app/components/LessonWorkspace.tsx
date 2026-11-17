import { memo, useCallback, useEffect, useState } from "react";
import {
  ChartLine,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  LoaderCircle,
  Network,
  Presentation,
  RotateCcw,
  Shapes,
  SlidersHorizontal,
  TriangleAlert,
  Workflow,
  X,
} from "lucide-react";
import { course, lesson } from "@/lib/course";
import { LessonIcon } from "./LessonIcon";
import type { Context } from "@/lib/tutor";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { InteractiveSimulation } from "./InteractiveSimulation";
import { RichArtifactView } from "./RichArtifactView";

const formatNames = {
  html: "laboratorio interactivo",
  svg: "esquema",
  mermaid: "diagrama",
  vegalite: "gráfico",
} as const;

type WorkspaceProps = {
  context: Context;
  disabled: boolean;
  artifactVersion: number;
  artifactUpdate: number;
  patch: (values: Partial<Context>) => void;
  onAsk: (text: string) => void;
  /** Artefacto que el diseñador está construyendo; la vista actual se mantiene mientras tanto. */
  pending: { formato: keyof typeof formatNames; titulo: string } | null;
  artifactError: string;
  onDismissError: () => void;
};

export const LessonWorkspace = memo(function LessonWorkspace({
  context,
  disabled,
  artifactVersion,
  artifactUpdate,
  patch,
  onAsk,
  pending,
  artifactError,
  onDismissError,
}: WorkspaceProps) {
  const changeArtifactState = useCallback(
    (estado: Context["estado"]) => patch({ estado }),
    [patch],
  );
  const a = context.artefacto;
  const slide =
    a.tipo === "slides"
      ? a.slides[Math.min(context.slide, a.slides.length - 1)]
      : null;
  const changeSimulationValues = useCallback(
    (valores: Context["valores"]) => patch({ valores }),
    [patch],
  );
  const [showArtifactUpdate, setShowArtifactUpdate] = useState(false);
  useEffect(() => {
    if (!artifactUpdate) return;
    setShowArtifactUpdate(true);
    const timer = setTimeout(() => setShowArtifactUpdate(false), 3500);
    return () => clearTimeout(timer);
  }, [artifactUpdate]);
  return (
    <section className="workspace">
      <div className="workspace-header">
        <span>
          {a.tipo === "diagrama" ? (
            <Network size={16} />
          ) : a.tipo === "simulacion" ? (
            <SlidersHorizontal size={16} />
          ) : a.tipo === "html" ? (
            <FlaskConical size={16} />
          ) : a.tipo === "svg" ? (
            <Shapes size={16} />
          ) : a.tipo === "mermaid" ? (
            <Workflow size={16} />
          ) : a.tipo === "vegalite" ? (
            <ChartLine size={16} />
          ) : (
            <Presentation size={16} />
          )}
          {
            {
              slides: "LECCIÓN INTERACTIVA",
              comparacion: "COMPARACIÓN",
              diagrama: "ARQUITECTURA",
              simulacion: "SIMULACIÓN INTERACTIVA",
              html: "LABORATORIO",
              svg: "ESQUEMA",
              mermaid: "DIAGRAMA",
              vegalite: "GRÁFICO",
            }[a.tipo]
          }
        </span>
        <span
          className="live-label artifact-update-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {showArtifactUpdate ? (
            <span className="artifact-update-badge" key={artifactUpdate}>
              <span aria-hidden="true">✦</span> Contenido actualizado
            </span>
          ) : (
            `${lesson.agenda?.[context.clase.paso] ?? course.slides[context.clase.paso].title} · ${String(context.clase.paso + 1).padStart(2, "0")}`
          )}
        </span>
      </div>
      <div className="artifact-area">
        {pending && (
          <div className="artifact-banner designing" role="status">
            <LoaderCircle size={16} className="activity-spinner" />
            <span>
              Diseñando {formatNames[pending.formato]}: <b>{pending.titulo}</b>
            </span>
          </div>
        )}
        {artifactError && !pending && (
          <div className="artifact-banner failed" role="alert">
            <TriangleAlert size={16} />
            <span>{artifactError}</span>
            <button disabled={disabled} onClick={() => onAsk("Vuelve a intentar la visualización que me ibas a mostrar.")}>
              <RotateCcw size={14} /> Reintentar
            </button>
            <button className="icon" aria-label="Cerrar aviso" onClick={onDismissError}>
              <X size={14} />
            </button>
          </div>
        )}
        <div className={`artifact ${a.tipo}${pending ? " is-pending" : ""}`}>
          {artifactUpdate > 0 && (
            <div
              key={`reveal-${artifactUpdate}`}
              className="artifact-card-reveal"
              aria-hidden="true"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    animationDelay: `${(Math.floor(index / 4) + (index % 4)) * 95}ms`,
                  }}
                />
              ))}
            </div>
          )}
          {a.tipo === "diagrama" && (
            <ArchitectureDiagram
              key={`${a.tipo}-${artifactVersion}`}
              artifact={a}
              selected={context.nodo}
              disabled={disabled}
              onSelect={(nodo) => patch({ nodo })}
              onExplain={() =>
                onAsk(
                  "Explícame el componente seleccionado del diagrama y cómo se conecta con los demás.",
                )
              }
            />
          )}
          {a.tipo === "simulacion" && (
            <InteractiveSimulation
              key={`${a.tipo}-${artifactVersion}`}
              artifact={a}
              values={context.valores}
              disabled={disabled}
              onChange={changeSimulationValues}
              onExplain={() =>
                onAsk(
                  "Interpreta los resultados de la simulación con los valores actuales de los controles.",
                )
              }
            />
          )}
          {(a.tipo === "html" || a.tipo === "svg" || a.tipo === "mermaid" || a.tipo === "vegalite") && (
            <RichArtifactView
              key={`${a.tipo}-${artifactVersion}`}
              artifact={a}
              disabled={disabled}
              onAsk={onAsk}
              onState={changeArtifactState}
            />
          )}
          {a.tipo === "slides" && slide && (
            <>
              <div className="slide-number">
                {context.slide + 1} / {a.slides.length}
              </div>
              <div className="slide-content">
                <div className="eyebrow">{lesson.fuente?.nombre ?? lesson.curso}</div>
                <h1>{slide.title}</h1>
                <p className="lead">{slide.body}</p>
                <div className="slide-points">
                  {slide.points.map((p, i) => (
                    <div key={p}>
                      <span>{i + 1}</span>
                      {p}
                    </div>
                  ))}
                </div>
                <div className="cloud-decoration">
                  <LessonIcon size={96} strokeWidth={1} />
                  <span>
                    {(lesson.agenda ?? course.slides.map((s) => s.title)).join(" · ")}
                  </span>
                </div>
              </div>
            </>
          )}
          {a.tipo === "comparacion" && (
            <>
              <div className="eyebrow">COMPARA LOS CONCEPTOS</div>
              <h1>{a.titulo}</h1>
              <div className="comparison-scroll">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      {a.columnas.map((x, i) => (
                        <th key={i} scope="col">
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.filas.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => onAsk("Explícame esta comparación")}>
                Explicar la comparación ✦
              </button>
            </>
          )}
        </div>
        {a.tipo === "slides" && (
          <div className="slide-nav">
            <button
              disabled={context.slide === 0}
              aria-label="Diapositiva anterior"
              onClick={() => patch({ slide: context.slide - 1 })}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onAsk("Explícame la diapositiva que estoy viendo")}
            >
              Explicar esta idea ✦
            </button>
            <button
              disabled={context.slide >= a.slides.length - 1}
              onClick={() => patch({ slide: context.slide + 1 })}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      <footer className="workspace-footer">
        <span>Aprende haciendo. Pregunta cuando quieras.</span>
        {lesson.fuente && (
          <a href={lesson.fuente.url} target="_blank" rel="noreferrer">
            Fuente · {lesson.fuente.nombre}
          </a>
        )}
      </footer>
    </section>
  );
});
