import { z } from "zod";

const label = z.string().min(1).max(180);
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/);
const operations = [
  "+",
  "-",
  "*",
  "/",
  "^",
  "min",
  "max",
  "ceil",
  "floor",
] as const;

export function calculateFormula(
  formula: (number | string)[],
  values: Record<string, number>,
): number | null {
  const stack: number[] = [];
  for (const token of formula) {
    if (typeof token === "number") {
      stack.push(token);
      continue;
    }
    if (Object.hasOwn(values, token)) {
      stack.push(values[token]);
      continue;
    }
    const right = stack.pop();
    if (right === undefined) return null;
    if (token === "ceil" || token === "floor") {
      stack.push(token === "ceil" ? Math.ceil(right) : Math.floor(right));
      continue;
    }
    const left = stack.pop();
    if (left === undefined) return null;
    switch (token) {
      case "+":
        stack.push(left + right);
        break;
      case "-":
        stack.push(left - right);
        break;
      case "*":
        stack.push(left * right);
        break;
      case "/":
        stack.push(left / right);
        break;
      case "^":
        stack.push(left ** right);
        break;
      case "min":
        stack.push(Math.min(left, right));
        break;
      case "max":
        stack.push(Math.max(left, right));
        break;
      default:
        return null;
    }
  }
  return stack.length === 1 &&
    Number.isFinite(stack[0]) &&
    Math.abs(stack[0]) <= 1e12
    ? stack[0]
    : null;
}

export const diagramSchema = z
  .object({
    tipo: z.literal("diagrama"),
    titulo: label,
    descripcion: z.string().min(1).max(700),
    nodos: z
      .array(
        z.object({
          id,
          etiqueta: label.max(60),
          descripcion: z.string().min(1).max(500),
          nivel: z.number().int().min(0).max(4),
        }),
      )
      .min(2)
      .max(12),
    conexiones: z
      .array(z.object({ origen: id, destino: id, etiqueta: label.max(60) }))
      .min(1)
      .max(20),
  })
  .refine((a) => {
    const ids = new Set(a.nodos.map((n) => n.id));
    return (
      ids.size === a.nodos.length &&
      a.conexiones.every(
        (e) =>
          ids.has(e.origen) && ids.has(e.destino) && e.origen !== e.destino,
      )
    );
  }, "Los nodos deben ser únicos y las conexiones deben apuntar a nodos existentes");

export const simulationSchema = z
  .object({
    tipo: z.literal("simulacion"),
    titulo: label,
    descripcion: z.string().min(1).max(700),
    supuestos: z.array(z.string().min(1).max(400)).min(1).max(4),
    entradas: z
      .array(
        z.object({
          id,
          etiqueta: label,
          unidad: z.string().max(40),
          min: z.number().min(-1000000).max(1000000),
          max: z.number().min(-1000000).max(1000000),
          paso: z.number().positive(),
          valor: z.number().finite(),
        }),
      )
      .min(1)
      .max(5),
    salidas: z
      .array(
        z.object({
          id,
          etiqueta: label,
          unidad: z.string().max(40),
          formula: z
            .array(z.union([z.number().finite(), z.string().min(1).max(40)]))
            .min(1)
            .max(50),
        }),
      )
      .min(1)
      .max(4),
    grafica: z.object({ entrada: id, salida: id }).nullable(),
  })
  .superRefine((a, context) => {
    const ids = a.entradas.map((e) => e.id);
    const outputIds = a.salidas.map((e) => e.id);
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    if (new Set([...ids, ...outputIds]).size !== ids.length + outputIds.length)
      issue(
        ["entradas"],
        "Todos los ids de entradas y salidas deben ser distintos",
      );
    a.entradas.forEach((entry, i) => {
      if (operations.includes(entry.id as (typeof operations)[number]))
        issue(["entradas", i, "id"], "El id no puede ser un operador");
      if (!(
        entry.min < entry.max &&
        entry.valor >= entry.min &&
        entry.valor <= entry.max &&
        entry.paso <= entry.max - entry.min &&
        (entry.max - entry.min) / entry.paso <= 10000
      ))
        issue(
          ["entradas", i],
          "min debe ser menor que max, valor dentro del rango y paso entre (max-min)/10000 y max-min",
        );
    });
    const values = Object.fromEntries(a.entradas.map((e) => [e.id, e.valor]));
    a.salidas.forEach((output, i) => {
      if (
        !output.formula.every(
          (t) =>
            typeof t === "number" ||
            ids.includes(t) ||
            operations.includes(t as (typeof operations)[number]),
        )
      )
        issue(
          ["salidas", i, "formula"],
          "Usa solo ids de entradas, números y operadores posfijos. No uses ids de salidas",
        );
      if (calculateFormula(output.formula, values) === null)
        issue(
          ["salidas", i, "formula"],
          "La fórmula debe dejar exactamente un resultado finito al evaluar con los valores iniciales",
        );
    });
    if (
      a.grafica &&
      !(ids.includes(a.grafica.entrada) && outputIds.includes(a.grafica.salida))
    )
      issue(["grafica"], "entrada y salida deben referenciar ids existentes");
  });

export type Diagram = z.infer<typeof diagramSchema>;
export type Simulation = z.infer<typeof simulationSchema>;
export function simulationDefaults(artifact: Simulation) {
  return Object.fromEntries(artifact.entradas.map((e) => [e.id, e.valor]));
}

/** Advance on the input's grid, including decimal steps and off-grid starting values. */
export function nextSimulationValue(input: Simulation["entradas"][number], value: number) {
  // Some adjacent ticks can round to the same floating point value. Find the
  // first representable tick above the current value, or finish at the maximum.
  let low = 1;
  const last = Math.ceil((input.max - input.min) / input.paso);
  let high = last;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (input.min + middle * input.paso > value) high = middle;
    else low = middle + 1;
  }
  return low === last ? input.max : Math.min(input.max, input.min + low * input.paso);
}

// ---------------------------------------------------------------------------
// Artefactos ricos: el modelo diseñador escribe HTML/CSS/JS, SVG, Mermaid o
// Vega-Lite. HTML y SVG se muestran en un iframe aislado sin acceso a la app ni
// a la red (ver app/components/HtmlArtifact.tsx). Mermaid y Vega-Lite se
// validan en el servidor (lib/artifact-check.ts) y se dibujan con sus librerías.
// ---------------------------------------------------------------------------
export const richFormats = ["html", "svg", "mermaid", "vegalite"] as const;
export type RichFormat = (typeof richFormats)[number];
const richCodeLimit = 150_000;

const richBase = {
  titulo: label,
  descripcion: z.string().min(1).max(700),
  guia: z.array(z.string().min(1).max(240)).max(4).default([]),
};

/** Patrones que no funcionarían dentro del iframe aislado; el diseñador debe evitarlos. */
const sandboxRules: [RegExp, string][] = [
  [/<(?:iframe|object|embed|base|link|frame|frameset|form)\b/i, "No uses <iframe>, <object>, <embed>, <base>, <link> ni <form>"],
  [/\b(?:src|href|xlink:href|action|poster|srcset)\s*=\s*["']?\s*(?:https?:)?\/\//i, "No cargues recursos externos: todo debe estar en línea"],
  [/url\(\s*["']?\s*(?:https?:)?\/\//i, "No uses url() con recursos externos"],
  [/@import\b/i, "No uses @import"],
  [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(|navigator\.sendBeacon|new\s+(?:XMLHttpRequest|WebSocket|EventSource|Worker)\b/, "No hagas peticiones de red ni crees workers"],
  [/\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/, "No uses almacenamiento del navegador: guarda el estado en variables"],
  [/\b(?:alert|confirm|prompt)\s*\(/, "No uses alert, confirm ni prompt: muestra los mensajes en la página"],
  [/\bimport\s*\(|<script[^>]*\btype\s*=\s*["']?module/i, "No uses módulos ni import dinámico: usa un <script> clásico"],
  [/\b(?:window\.)?(?:top|parent|opener)\s*\.\s*(?:location|document|postMessage)/, "No accedas a la ventana principal: usa tutor.preguntar y tutor.estado"],
];

function sandboxIssues(code: string) {
  return sandboxRules.filter(([pattern]) => pattern.test(code)).map(([, message]) => message);
}

const code = (max: number) => z.string().min(1).max(max);

export const htmlArtifactSchema = z
  .object({ tipo: z.literal("html"), ...richBase, html: code(richCodeLimit) })
  .superRefine((a, ctx) => {
    for (const message of sandboxIssues(a.html)) ctx.addIssue({ code: "custom", path: ["html"], message });
  });

export const svgArtifactSchema = z
  .object({ tipo: z.literal("svg"), ...richBase, svg: code(richCodeLimit) })
  .superRefine((a, ctx) => {
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b[\s\S]*<\/svg>\s*$/i.test(a.svg))
      ctx.addIssue({ code: "custom", path: ["svg"], message: "Devuelve un único elemento <svg>…</svg> con viewBox" });
    for (const message of sandboxIssues(a.svg)) ctx.addIssue({ code: "custom", path: ["svg"], message });
  });

export const mermaidArtifactSchema = z.object({
  tipo: z.literal("mermaid"),
  ...richBase,
  codigo: code(20_000),
});

export const vegaliteArtifactSchema = z
  .object({
    tipo: z.literal("vegalite"),
    ...richBase,
    spec: z.record(z.string(), z.unknown()),
  })
  .superRefine((a, ctx) => {
    const bytes = new TextEncoder().encode(JSON.stringify(a.spec)).byteLength;
    if (bytes > richCodeLimit)
      ctx.addIssue({ code: "custom", path: ["spec"], message: "La especificación es demasiado grande; resume los datos" });
    const external = (value: unknown): boolean =>
      Array.isArray(value)
        ? value.some(external)
        : !!value && typeof value === "object" &&
          Object.entries(value).some(([key, v]) => key === "url" || external(v));
    if (external(a.spec))
      ctx.addIssue({ code: "custom", path: ["spec"], message: "Incluye los datos en data.values; no uses url" });
  });

/** Lo que el profesor pide al diseñador. Nunca se muestra: se sustituye por el artefacto final. */
export const commissionSchema = z.object({
  tipo: z.literal("encargo"),
  formato: z.enum(richFormats),
  titulo: label,
  objetivo: z.string().min(1).max(600),
  contenido: z.string().min(1).max(2400),
});

export type RichArtifact =
  | z.infer<typeof htmlArtifactSchema>
  | z.infer<typeof svgArtifactSchema>
  | z.infer<typeof mermaidArtifactSchema>
  | z.infer<typeof vegaliteArtifactSchema>;
export type Commission = z.infer<typeof commissionSchema>;
