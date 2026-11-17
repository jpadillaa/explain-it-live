import { z } from "zod";

/**
 * Contrato de una lección cargada desde Markdown (ver lessons/README.md).
 * Este módulo no usa fs: se comparte entre el navegador, las rutas y las pruebas.
 */
const text = z.string().trim().min(1).max(3000);
const label = z.string().trim().min(1).max(120);
const conceptId = z
  .string()
  .regex(/^[a-z0-9_]{1,40}$/, "Usa minúsculas, números y guion bajo (máx. 40)");

const conceptSchema = z.object({ id: conceptId, titulo: label, texto: text });

const axisSchema = z.object({
  titulo: label,
  cuerpo: text,
  puntos: z.array(text).max(5),
  claves: z.array(z.string().trim().min(1)).default([]),
  conceptos: z.array(conceptSchema).min(1).max(12),
  ejemplo: z
    .object({ texto: text, conceptos: z.array(conceptId).default([]) })
    .nullable()
    .default(null),
  cierre: z.string().trim().max(3000).default(""),
});

const relatedSchema = z.object({
  id: conceptId,
  titulo: label,
  texto: text,
  puntos: z.array(text).max(5).default([]),
});

const objectiveSchema = z.object({
  objetivo: label,
  pregunta: text,
  opciones: z.array(label).min(2).max(5),
  respuesta: z.number().int().min(0),
});

const lessonIcons = ["cloud", "cpu", "zap", "book"] as const;

export const lessonSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    curso: label,
    leccion: label,
    descripcion: text,
    marca: z.string().trim().min(1).max(30),
    profesor: label,
    etiqueta: label.optional(),
    icono: z.enum(lessonIcons).default("book"),
    tema: label,
    fuente: z.object({ nombre: label, url: z.url() }).nullable().default(null),
    agenda: z.array(label).max(8).optional(),
    acciones: z.array(label).min(1).max(3),
    pronunciacion: z.record(z.string().min(1), z.string()).default({}),
    alcance: z.object({
      afines: z.array(label).default([]),
      criterios: z.string().trim().max(4000).default(""),
      redireccion: text,
    }),
    objetivos: z.array(objectiveSchema).min(1).max(8),
    bienvenida: text,
    ejes: z.array(axisSchema).min(1).max(8),
    resumen: text,
    temasAfines: z.array(relatedSchema).default([]),
    notas: z.string().trim().max(8000).default(""),
  })
  .superRefine((lesson, ctx) => {
    const ids = lesson.ejes.flatMap((axis) => axis.conceptos.map((c) => c.id));
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id))
        ctx.addIssue({ code: "custom", message: `Concepto duplicado: ${id}` });
      seen.add(id);
    }
    lesson.ejes.forEach((axis, i) => {
      for (const id of axis.ejemplo?.conceptos ?? [])
        if (!axis.conceptos.some((c) => c.id === id))
          ctx.addIssue({
            code: "custom",
            path: ["ejes", i, "ejemplo"],
            message: `El ejemplo cita «${id}», que no es un concepto de este eje`,
          });
    });
    lesson.objetivos.forEach((objective, i) => {
      if (objective.respuesta >= objective.opciones.length)
        ctx.addIssue({
          code: "custom",
          path: ["objetivos", i, "respuesta"],
          message: "La respuesta debe ser el índice (desde 0) de una opción",
        });
    });
  });

export type Lesson = z.infer<typeof lessonSchema>;
