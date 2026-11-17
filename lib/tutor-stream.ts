import { z } from "zod";
import { artifactSchema, replySchema } from "./tutor";
export const stageLabels = {
  contexto: "Recibiendo tu pregunta",
  alcance: "Comprobando el tema",
  generacion: "Generando la explicación",
  validacion: "Validando el contenido",
  correccion: "Ajustando el contenido",
  diseno: "Diseñando la visualización",
} as const;
export type Stage = keyof typeof stageLabels;
const resultSchema = replySchema.extend({
  mode: z.enum(["local", "connected"]),
  errorArtefacto: z.string().optional(),
});
export type TutorResult = z.infer<typeof resultSchema>;
const tutorEventSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("estado"),
    etapa: z.enum([
      "contexto",
      "alcance",
      "generacion",
      "validacion",
      "correccion",
      "diseno",
    ]),
  }),
  z.object({ tipo: z.literal("resultado"), respuesta: resultSchema }),
  // Segunda fase: el artefacto diseñado llega después de la narración.
  z.object({ tipo: z.literal("artefacto"), artefacto: artifactSchema }),
  z.object({ tipo: z.literal("artefacto_error"), error: z.string() }),
  z.object({ tipo: z.literal("error"), error: z.string() }),
]);
export type TutorEvent = z.infer<typeof tutorEventSchema>;
type Artifact = z.infer<typeof artifactSchema>;

type TutorHandlers = {
  /** La narración está lista; el artefacto puede seguir en diseño (artefactoPendiente). */
  onResult?: (result: TutorResult) => void;
  onArtifact?: (artifact: Artifact) => void;
  onArtifactError?: (error: string) => void;
};

export async function readTutorResponse(
  response: Response,
  onStage: (stage: Stage) => void,
  handlers: TutorHandlers = {},
) {
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "No se pudo conversar con el tutor.");
  }
  if (!response.headers.get("Content-Type")?.includes("application/x-ndjson")) {
    const result = resultSchema.parse(await response.json());
    handlers.onResult?.(result);
    if (result.errorArtefacto) handlers.onArtifactError?.(result.errorArtefacto);
    return result;
  }
  if (!response.body) throw new Error("La conexión no devolvió una respuesta.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: TutorResult | undefined;
  function processLine(line: string) {
    if (!line.trim()) return;
    const event = tutorEventSchema.parse(JSON.parse(line));
    if (event.tipo === "error") throw new Error(event.error);
    if (event.tipo === "estado") onStage(event.etapa);
    if (event.tipo === "resultado") {
      result = event.respuesta;
      handlers.onResult?.(result);
    }
    if (event.tipo === "artefacto" && result) {
      result = { ...result, artefacto: event.artefacto, artefactoPendiente: null };
      handlers.onArtifact?.(event.artefacto);
    }
    if (event.tipo === "artefacto_error" && result) {
      result = { ...result, artefactoPendiente: null, errorArtefacto: event.error };
      handlers.onArtifactError?.(event.error);
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        processLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (done) break;
    }
    processLine(buffer);
    if (!result)
      throw new Error(
        "La conexión se interrumpió. Puedes reintentar tu pregunta.",
      );
    if (result.artefactoPendiente) {
      // La narración llegó, pero el diseño se cortó antes de terminar.
      handlers.onArtifactError?.("Se interrumpió el diseño de la visualización. Puedes pedirla de nuevo.");
      result = { ...result, artefactoPendiente: null };
    }
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
