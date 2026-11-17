"use client";
import { useId } from "react";
import { Cloud, Network } from "lucide-react";
import type { Diagram } from "@/lib/artifacts";

export function ArchitectureDiagram({
  artifact,
  selected,
  onSelect,
  onExplain,
  disabled,
}: {
  artifact: Diagram;
  selected: string | null;
  onSelect: (id: string) => void;
  onExplain: () => void;
  disabled: boolean;
}) {
  const markerId = `arrow-${useId().replace(/:/g, "")}`;
  const levels = [...new Set(artifact.nodos.map((n) => n.nivel))].sort(
    (a, b) => a - b,
  );
  const rows = Math.max(
    ...levels.map(
      (level) => artifact.nodos.filter((n) => n.nivel === level).length,
    ),
  );
  const width = levels.length * 230;
  const height = Math.max(280, rows * 140 + 50);
  const positions = new Map(
    artifact.nodos.map((node) => {
      const group = artifact.nodos.filter((n) => n.nivel === node.nivel);
      return [
        node.id,
        {
          x: levels.indexOf(node.nivel) * 230 + 25,
          y: (height - group.length * 140) / 2 + group.indexOf(node) * 140 + 20,
        },
      ];
    }),
  );
  const current =
    artifact.nodos.find((n) => n.id === selected) || artifact.nodos[0];
  return (
    <>
      <div className="eyebrow">ARQUITECTURA EXPLORABLE</div>
      <h1>{artifact.titulo}</h1>
      <p className="subtitle">{artifact.descripcion}</p>
      <div className="diagram-scroll">
        <div className="diagram-canvas" style={{ width, height }}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Conexiones de la arquitectura"
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8" fill="#a696c6" />
              </marker>
            </defs>
            {artifact.conexiones.map((edge, i) => {
              const from = positions.get(edge.origen)!;
              const to = positions.get(edge.destino)!;
              const forward = to.x > from.x;
              const x1 = from.x + (forward ? 160 : 80),
                y1 = from.y + (forward ? 44 : 0);
              const x2 = to.x + (forward ? 0 : 80),
                y2 = to.y + (forward ? 44 : 0);
              const path = forward
                ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`
                : `M${x1},${y1} C${x1},${Math.min(y1, y2) - 35} ${x2},${Math.min(y1, y2) - 35} ${x2},${y2}`;
              return (
                <g
                  key={i}
                  className={
                    edge.origen === current.id || edge.destino === current.id
                      ? "edge selected-edge"
                      : "edge"
                  }
                >
                  <title>
                    {edge.origen} → {edge.destino}: {edge.etiqueta}
                  </title>
                  <path
                    d={path}
                    fill="none"
                    strokeWidth="1.5"
                    markerEnd={`url(#${markerId})`}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={forward ? (y1 + y2) / 2 - 12 : Math.min(y1, y2) - 25}
                    textAnchor="middle"
                  >
                    {edge.etiqueta}
                  </text>
                </g>
              );
            })}
          </svg>
          {artifact.nodos.map((node) => {
            const position = positions.get(node.id)!;
            return (
              <button
                key={node.id}
                disabled={disabled}
                aria-pressed={current.id === node.id}
                className={`architecture-node ${current.id === node.id ? "is-selected" : ""}`}
                style={{ left: position.x, top: position.y }}
                onClick={() => onSelect(node.id)}
              >
                <Cloud size={21} />
                <strong>{node.etiqueta}</strong>
              </button>
            );
          })}
        </div>
      </div>
      <div className="diagram-detail">
        <Network size={20} />
        <div>
          <strong>{current.etiqueta}</strong>
          <p>{current.descripcion}</p>
        </div>
      </div>
      <div className="artifact-actions">
        <span>Selecciona un componente para explorarlo.</span>
        <button disabled={disabled} onClick={onExplain}>
          Explicar este componente ✦
        </button>
      </div>
    </>
  );
}
