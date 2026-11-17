import { z } from "zod";
import { course, lesson, lessonClosings, lessonUnits, lessonSummary } from "./course";
import {
  commissionSchema,
  diagramSchema,
  htmlArtifactSchema,
  mermaidArtifactSchema,
  richFormats,
  simulationSchema,
  svgArtifactSchema,
  vegaliteArtifactSchema,
} from "./artifacts";
const textLimit = 3000;
const historyLimit = 20;
const summaryLimit = 900;
// A JSON escape takes up to six bytes per UTF-16 code unit. Reserve space for
// all supported history entries, the next message, class state and JSON keys.
const artifactByteLimit = 1024 * 1024;
export const tutorRequestByteLimit =
  artifactByteLimit +
  6 * ((historyLimit + 1) * textLimit + summaryLimit) +
  8192;
const short = z.string().min(1).max(textLimit);
const slidesSchema = z.object({
      tipo: z.literal("slides"),
      titulo: short,
      slides: z
        .array(
          z.object({
            title: short,
            body: short,
            points: z.array(short).max(5),
          }),
        )
        .min(1)
        .max(8),
    });
const comparisonSchema = z
      .object({
        tipo: z.literal("comparacion"),
        titulo: short,
        columnas: z.array(short).min(2).max(4),
        filas: z.array(z.array(short).min(2).max(4)).min(1).max(6),
      })
      .refine(
        (a) => a.filas.every((row) => row.length === a.columnas.length),
        "Cada fila debe coincidir con las columnas",
      );
const withinBudget = <T extends z.ZodType>(schema: T) =>
  schema.refine(
    (artifact) =>
      new TextEncoder().encode(JSON.stringify(artifact)).byteLength <=
      artifactByteLimit,
    "El artefacto supera el tamaño permitido para el siguiente turno",
  );
/** Artefacto visible: el que se muestra y viaja en el contexto del siguiente turno. */
export const artifactSchema = withinBudget(
  z.discriminatedUnion("tipo", [
    diagramSchema,
    simulationSchema,
    slidesSchema,
    comparisonSchema,
    htmlArtifactSchema,
    svgArtifactSchema,
    mermaidArtifactSchema,
    vegaliteArtifactSchema,
  ]),
);
/** Lo que puede proponer el profesor: un artefacto simple o un encargo al diseñador. */
export const draftArtifactSchema = z.discriminatedUnion("tipo", [
  diagramSchema,
  simulationSchema,
  slidesSchema,
  comparisonSchema,
  commissionSchema,
]);
const pendingArtifactSchema = z.object({
  formato: z.enum(richFormats),
  titulo: short,
});

const conceptIds = lessonUnits.flat().map((unit) => unit.id);
const conceptSchema = z.enum(conceptIds as [string, ...string[]]);
const lastStep = lessonUnits.length - 1;
const lastObjective = course.objectives.length - 1;
const taughtConceptsSchema = z.array(conceptSchema).max(conceptIds.length);
export const lessonStateSchema = z.object({
  conceptos: taughtConceptsSchema,
  paso: z.number().int().min(0).max(lastStep),
  resumen: z.string().max(summaryLimit),
});
export type LessonState = z.infer<typeof lessonStateSchema>;
// El saludo presenta la agenda y desarrolla el primer concepto del primer eje.
const firstConcept = lesson.ejes[0].conceptos[0];
const initialLesson: LessonState = {
  conceptos: [firstConcept.id],
  paso: 0,
  resumen: `Se presentó la agenda y se introdujo: ${firstConcept.titulo}.`,
};
export const replySchema = z.object({
  clase: lessonStateSchema.optional(),
  mensaje: short,
  artefacto: artifactSchema.nullable(),
  // El artefacto rico llega después en el stream; mientras tanto se anuncia aquí.
  artefactoPendiente: pendingArtifactSchema.nullable().optional(),
  acciones: z.array(short).max(3),
});
export type Artifact = z.infer<typeof artifactSchema>;
export const contextSchema = z.object({
  clase: lessonStateSchema.default(initialLesson),
  slide: z.number().int().min(0).max(7),
  artefacto: artifactSchema,
  valores: z
    .record(z.string().max(40), z.number().finite())
    .refine((values) => Object.keys(values).length <= 5)
    .default({}),
  nodo: z.string().max(40).nullable().default(null),
  // Estado que un artefacto HTML/SVG comunica con tutor.estado({...}).
  estado: z
    .record(z.string().max(40), z.union([z.string().max(200), z.number().finite(), z.boolean()]))
    .refine((values) => Object.keys(values).length <= 20)
    .default({}),
  completados: z.array(z.number().int().min(0).max(lastObjective)).max(lastObjective + 1),
});
export type Context = z.infer<typeof contextSchema>;
export const requestSchema = z.object({
  mensaje: short,
  historial: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: short }))
    .max(historyLimit),
  contexto: contextSchema,
});
export type TutorRequest = z.infer<typeof requestSchema>;
const initialArtifact: Artifact = {
  tipo: "slides",
  titulo: course.title,
  slides: course.slides,
};
export const initialContext: Context = {
  clase: initialLesson,
  slide: 0,
  valores: {},
  nodo: null,
  estado: {},
  artefacto: initialArtifact,
  completados: [],
};
export function buildParticipationRequest(
  mensaje: string,
  explicacion: string,
  contexto: Context,
): TutorRequest {
  return {
    mensaje,
    historial: [{ role: "assistant", content: explicacion }],
    contexto,
  };
}
export function pendingUnits(state: LessonState, step: number) {
  return lessonUnits[step].filter((unit) => !state.conceptos.includes(unit.id));
}

export function nextLessonStep(state: LessonState): number | null {
  // Finish the active topic first, then resume any topics left by an explicit detour.
  for (let offset = 0; offset < lessonUnits.length; offset++) {
    const step = (state.paso + offset) % lessonUnits.length;
    if (pendingUnits(state, step).length) return step;
  }
  return null;
}

function normalizeCommand(mensaje: string) {
  return mensaje
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[.!?¿¡]+$/g, "");
}

export function lessonControl(
  mensaje: string,
  current: LessonState,
): LessonState | null {
  const text = normalizeCommand(mensaje);
  if (
    [
      "continuar clase",
      "continua",
      "continuar",
      "continua con la clase",
      "sigamos",
      "continuemos",
      "sigue",
      "adelante",
    ].includes(text)
  )
    return { ...current, paso: nextLessonStep(current) ?? current.paso };
  if (text === "repasar la clase") return { ...current, paso: 0 };
  return null;
}
export function withLessonState(
  reply: z.infer<typeof replySchema>,
  input: TutorRequest,
): z.infer<typeof replySchema> {
  const control = lessonControl(input.mensaje, input.contexto.clase);
  const clase: LessonState = {
    paso: reply.clase?.paso ?? control?.paso ?? input.contexto.clase.paso,
    resumen: reply.clase?.resumen ?? input.contexto.clase.resumen,
    conceptos: Array.from(
      new Set([
        ...input.contexto.clase.conceptos,
        ...(reply.clase?.conceptos ?? []),
      ]),
    ),
  };
  const slide = course.slides[clase.paso];
  const artefacto =
    reply.artefacto ??
    (clase.paso !== input.contexto.clase.paso
      ? { tipo: "slides" as const, titulo: slide.title, slides: [slide] }
      : null);
  // Announce an axis exactly when its last outstanding concept has been taught.
  const closings = lessonClosings.filter((_, step) =>
    pendingUnits(input.contexto.clase, step).length > 0 && !pendingUnits(clase, step).length,
  );
  return {
    ...reply,
    mensaje: [reply.mensaje, ...closings.filter(Boolean)].join(" "),
    clase,
    artefacto,
  };
}
export const offTopicReply: z.infer<typeof replySchema> = {
  mensaje: lesson.alcance.redireccion,
  artefacto: null,
  acciones: course.actions,
};

// Palabras que dirigen la demo local a un eje: «Claves:» del Markdown, ids y títulos de conceptos.
const axisKeys = lesson.ejes.map((axis) =>
  [...axis.claves, ...axis.conceptos.flatMap((c) => [c.id, normalizeCommand(c.titulo)])]
    .map((key) => key.replace(/_/g, " "))
    .filter((key) => key.length >= 3),
);
function matchesAny(text: string, keys: string[]) {
  return keys.some((key) => text.includes(key));
}
export function localReply({
  mensaje,
  contexto,
}: TutorRequest): z.infer<typeof replySchema> {
  const t = normalizeCommand(mensaje);
  if (/diagram|simula/.test(t))
    return {
      mensaje:
        `Para generar diagramas y simulaciones adaptados a tu pregunta, configura la conexión al modelo. En esta demo local podemos repasar ${lesson.ejes.map((axis) => axis.titulo).join(", ")}.`,
      artefacto: null,
      acciones: course.actions,
    };
  const related = course.related.find((topic) =>
    matchesAny(t, [topic.id.replace(/_/g, " "), normalizeCommand(topic.titulo)]),
  );
  if (related)
    return {
      mensaje: related.texto,
      artefacto: {
        tipo: "slides",
        titulo: related.titulo,
        slides: [{ title: related.titulo, body: related.texto, points: related.puntos }],
      },
      acciones: course.actions,
    };
  if (/diapositiva|esta idea|explica esto/.test(t)) {
    const a = contexto.artefacto;
    const slide =
      a.tipo === "slides"
        ? a.slides[Math.min(contexto.slide, a.slides.length - 1)]
        : null;
    const explanation = slide
      ? `${slide.title} ${slide.body} ${slide.points.join(" ")}`
      : `${a.titulo}. ${a.tipo === "comparacion" ? a.filas.map((row) => row.join(". ")).join(" ") : ""}`;
    return {
      mensaje:
        explanation.length > textLimit
          ? explanation.slice(0, textLimit - 1) + "…"
          : explanation,
      artefacto: null,
      acciones: course.actions,
    };
  }
  const control = lessonControl(mensaje, contexto.clase);
  const review = t === "repasar la clase";
  if (
    t === "resumir la clase" ||
    (control && !review && nextLessonStep(contexto.clase) === null)
  )
    return {
      mensaje: lessonSummary,
      clase: contexto.clase,
      artefacto: initialArtifact,
      acciones: ["Repasar la clase"],
    };
  // El primer eje se consulta al final: sus claves suelen ser las más generales.
  const axisOrder = [...lessonUnits.keys()].slice(1);
  const index = control
    ? control.paso
    : (axisOrder.find((step) => matchesAny(t, axisKeys[step])) ??
      (/ejemplo|otra forma|entiend|entend|explica|resum|idea/.test(t)
        ? contexto.clase.paso
        : matchesAny(t, axisKeys[0]) || /empez|hola/.test(t)
          ? 0
          : -1));
  if (index === -1)
    return {
      ...offTopicReply,
      mensaje: `En el modo local puedo explicar ${[
        ...lesson.ejes.map((axis) => axis.titulo),
        ...course.related.map((topic) => topic.titulo),
      ].join(", ")}. Para otras preguntas afines, activa la conexión al modelo.`,
    };
  const slide = course.slides[index];
  const axisExample = lesson.ejes[index].ejemplo;
  const example = /ejemplo/.test(t) && axisExample !== null;
  const units =
    control && !review
      ? pendingUnits(contexto.clase, index)
      : lessonUnits[index];
  const narrative =
    example && axisExample
      ? axisExample.texto
      : units.map((unit) => unit.text).join(" ");
  const taught =
    example && axisExample
      ? axisExample.conceptos
      : units.map((unit) => unit.id);
  return {
    mensaje: `${narrative} Puedes compartir cómo lo entiendes o pedirme una aclaración antes de continuar.`,
    clase: {
      paso: index,
      resumen: narrative.slice(0, summaryLimit),
      conceptos: [...new Set([...contexto.clase.conceptos, ...taught])],
    },
    artefacto: { tipo: "slides", titulo: slide.title, slides: [slide] },
    acciones: course.actions,
  };
}
