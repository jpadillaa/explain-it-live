import { lessonSchema } from "./lesson";

// next.config.ts sustituye esta expresión por el JSON de la lección elegida en
// LESSON_FILE (cliente y servidor). Las pruebas la definen con lib/test-lesson.ts.
// Debe leerse literalmente como process.env.TUTOR_LESSON_JSON para que se inyecte.
const raw = process.env.TUTOR_LESSON_JSON;
if (!raw)
  throw new Error(
    "No hay lección cargada. Define LESSON_FILE en .env (por defecto lessons/nube-nist.md) y reinicia el servidor.",
  );

export const lesson = lessonSchema.parse(JSON.parse(raw));

export const course = {
  title: lesson.leccion,
  source: lesson.fuente?.url ?? null,
  welcome: lesson.bienvenida,
  actions: lesson.acciones,
  objectives: lesson.objetivos.map((o) => o.objetivo),
  slides: lesson.ejes.map((axis) => ({
    title: axis.titulo,
    body: axis.cuerpo,
    points: axis.puntos,
  })),
  quizzes: lesson.objetivos.map((o) => ({
    question: o.pregunta,
    choices: o.opciones,
    answer: o.respuesta,
  })),
  related: lesson.temasAfines,
};

// La demo local y el tutor conectado siguen el mismo recorrido.
export const lessonUnits = lesson.ejes.map((axis) =>
  axis.conceptos.map((c) => ({ id: c.id, text: c.texto })),
);

export const lessonClosings = lesson.ejes.map((axis) => axis.cierre);

export const lessonSummary = lesson.resumen;
