"use client";
import { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import {
  calculateFormula,
  nextSimulationValue,
  simulationDefaults,
  type Simulation,
} from "@/lib/artifacts";
const format = (value: number | null) =>
  value === null
    ? "Sin definir"
    : value.toLocaleString("es-CO", Math.abs(value) > 0 && Math.abs(value) < 0.01
        ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: 2 });

export function InteractiveSimulation({
  artifact,
  values,
  onChange,
  onExplain,
  disabled,
}: {
  artifact: Simulation;
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  onExplain: () => void;
  disabled: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [variable, setVariable] = useState(
    artifact.grafica?.entrada || artifact.entradas[0].id,
  );
  const currentValues = useMemo(() => ({ ...simulationDefaults(artifact), ...values }), [artifact, values]);
  const input = artifact.entradas.find((e) => e.id === variable)!;
  useEffect(() => {
    if (disabled) setPlaying(false);
  }, [disabled]);
  useEffect(() => {
    if (!playing || disabled) return;
    const timer = setTimeout(() => {
      const value = currentValues[input.id];
      if (value >= input.max) {
        setPlaying(false);
        return;
      }
      onChange({
        ...currentValues,
        [input.id]: nextSimulationValue(input, value),
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [playing, disabled, input, currentValues, onChange]);
  const graph = artifact.grafica;
  const graphInput = graph
    ? artifact.entradas.find((e) => e.id === graph.entrada)!
    : null;
  const graphOutput = graph
    ? artifact.salidas.find((e) => e.id === graph.salida)!
    : null;
  const samples = useMemo(() =>
    graphInput && graphOutput
      ? Array.from({ length: 51 }, (_, i) => {
          const x =
            graphInput.min + ((graphInput.max - graphInput.min) * i) / 50;
          return {
            x,
            y: calculateFormula(graphOutput.formula, {
              ...currentValues,
              [graphInput.id]: x,
            }),
          };
        })
      : [], [graphInput, graphOutput, currentValues]);
  const valid = samples.filter(
    (p): p is { x: number; y: number } => p.y !== null,
  );
  const minY = Math.min(0, ...valid.map((p) => p.y)),
    maxY = Math.max(1, ...valid.map((p) => p.y));
  const point = (x: number, y: number) =>
    `${55 + ((x - graphInput!.min) / (graphInput!.max - graphInput!.min)) * 480},${190 - ((y - minY) / (maxY - minY)) * 155}`;
  const curve = samples
    .map((p, i) =>
      p.y === null
        ? ""
        : `${i === 0 || samples[i - 1].y === null ? "M" : "L"}${point(p.x, p.y)}`,
    )
    .join(" ");
  const currentY = graphOutput
    ? calculateFormula(graphOutput.formula, currentValues)
    : null;
  return (
    <>
      <div className="eyebrow">EXPERIMENTA CON EL MODELO</div>
      <h1>{artifact.titulo}</h1>
      <p className="subtitle">{artifact.descripcion}</p>
      <div className="simulation-metrics" aria-live="polite">
        {artifact.salidas.map((output) => (
          <div key={output.id}>
            <span>{output.etiqueta}</span>
            <strong>
              {format(calculateFormula(output.formula, currentValues))}
            </strong>
            <small>{output.unidad}</small>
          </div>
        ))}
      </div>
      {graphInput && graphOutput && (
        <figure className="simulation-graph">
          <figcaption>
            {graphOutput.etiqueta} ({graphOutput.unidad})
          </figcaption>
          <svg
            viewBox="0 0 580 230"
            role="img"
            aria-label={`${graphOutput.etiqueta} al variar ${graphInput.etiqueta}. Valor actual: ${format(currentY)} ${graphOutput.unidad}`}
          >
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="55"
                  x2="535"
                  y1={190 - (i * 155) / 3}
                  y2={190 - (i * 155) / 3}
                  stroke="#eeeaf4"
                />
                <text x="46" y={194 - (i * 155) / 3} textAnchor="end">
                  {format(minY + ((maxY - minY) * i) / 3)}
                </text>
              </g>
            ))}
            <path d={curve} fill="none" stroke="#8d78cf" strokeWidth="2.5" />
            {currentY !== null && (
              <circle
                cx={point(currentValues[graphInput.id], currentY).split(",")[0]}
                cy={point(currentValues[graphInput.id], currentY).split(",")[1]}
                r="5"
                fill="#6c58cc"
                stroke="white"
                strokeWidth="2"
              />
            )}
            <text x="55" y="212">
              {format(graphInput.min)}
            </text>
            <text x="535" y="212" textAnchor="end">
              {format(graphInput.max)}
            </text>
          </svg>
          <small>
            {graphInput.etiqueta} ({graphInput.unidad})
          </small>
        </figure>
      )}
      <div className="simulation-inputs">
        {artifact.entradas.map((entry) => (
          <label key={entry.id} htmlFor={`sim-${entry.id}`}>
            <span>
              {entry.etiqueta}
              <b>
                {format(currentValues[entry.id])} {entry.unidad}
              </b>
            </span>
            <input
              id={`sim-${entry.id}`}
              disabled={disabled}
              type="range"
              min={entry.min}
              max={entry.max}
              step={entry.paso}
              value={currentValues[entry.id]}
              onChange={(e) => {
                setPlaying(false);
                onChange({ ...currentValues, [entry.id]: +e.target.value });
              }}
            />
          </label>
        ))}
      </div>
      <div className="simulation-controls">
        <label>
          Variar{" "}
          <select
            aria-label="Variable a simular"
            value={variable}
            disabled={disabled || playing}
            onChange={(e) => setVariable(e.target.value)}
          >
            {artifact.entradas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={disabled}
          className="primary"
          onClick={() => {
            if (!playing && currentValues[input.id] >= input.max)
              onChange({ ...currentValues, [input.id]: input.min });
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
          {playing ? "Pausar" : "Simular"}
        </button>
        <button
          disabled={disabled}
          aria-label="Restablecer simulación"
          onClick={() => {
            setPlaying(false);
            onChange(simulationDefaults(artifact));
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <details className="simulation-assumptions">
        <summary>Supuestos y reglas del modelo</summary>
        <ul>
          {artifact.supuestos.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
      <div className="artifact-actions">
        <span>Los resultados se recalculan al mover los controles.</span>
        <button
          disabled={disabled}
          onClick={() => {
            setPlaying(false);
            onExplain();
          }}
        >
          Explicar estos resultados ✦
        </button>
      </div>
    </>
  );
}
