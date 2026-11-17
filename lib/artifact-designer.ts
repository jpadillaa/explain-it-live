import { z } from "zod";
import {
  htmlArtifactSchema,
  mermaidArtifactSchema,
  svgArtifactSchema,
  vegaliteArtifactSchema,
  type Commission,
  type RichArtifact,
  type RichFormat,
} from "./artifacts";
import { richArtifactIssues } from "./artifact-check";
import { designerPrompt } from "./artifact-prompt";
import { artifactSchema } from "./tutor";
import { parseModelJson, type Message, type ModelStage } from "./model-client";

type Complete = (messages: Message[], stage: ModelStage) => Promise<string>;
type Checked = { artifact: RichArtifact } | { issues: string[] };

const richArtifactSchema = z.discriminatedUnion("tipo", [
  htmlArtifactSchema,
  svgArtifactSchema,
  mermaidArtifactSchema,
  vegaliteArtifactSchema,
]);

/** Estructura (Zod), presupuesto de tamaño y semántica de Mermaid/Vega-Lite. */
async function checkDesign(content: string, format: RichFormat): Promise<Checked> {
  const parsed = richArtifactSchema.safeParse(parseModelJson(content));
  if (!parsed.success)
    return { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  if (parsed.data.tipo !== format) return { issues: [`tipo debe ser "${format}"`] };
  const budget = artifactSchema.safeParse(parsed.data);
  if (!budget.success) return { issues: budget.error.issues.map((i) => i.message) };
  const issues = await richArtifactIssues(parsed.data);
  return issues.length ? { issues } : { artifact: parsed.data };
}

/** Pide, valida y, si hace falta, corrige una vez. Emite «correccion» al corregir. */
async function* generate(
  complete: Complete,
  format: RichFormat,
  messages: Message[],
): AsyncGenerator<{ tipo: "estado"; etapa: "correccion" }, RichArtifact | null> {
  const first = await complete(messages, "diseno");
  let result = await checkDesign(first, format);
  if ("issues" in result) {
    yield { tipo: "estado", etapa: "correccion" };
    messages.push(
      { role: "assistant", content: first },
      {
        role: "user",
        content: `Corrige el artefacto y devuelve el objeto JSON completo. Problemas detectados: ${JSON.stringify(result.issues)}. Conserva el diseño y la intención pedagógica.`,
      },
    );
    result = await checkDesign(await complete(messages, "diseno"), format);
  }
  return "issues" in result ? null : result.artifact;
}

export function designArtifact(
  complete: Complete,
  input: {
    order: Commission;
    lesson: { curso: string; leccion: string; tema: string };
    narration: string;
    participation: string;
    previous: unknown;
    previousState: unknown;
  },
) {
  return generate(complete, input.order.formato, [
    { role: "system", content: designerPrompt(input.order.formato) },
    {
      role: "user",
      content: JSON.stringify({
        encargo: input.order,
        leccion: input.lesson,
        narracionDelProfesor: input.narration,
        participacionDelEstudiante: input.participation,
        artefactoAnterior: input.previous,
        estadoDelArtefactoAnterior: input.previousState,
      }),
    },
  ]);
}

/** Segunda vuelta tras dibujar: corrige la maquetación con los problemas medidos en el navegador. */
export function repairLayout(complete: Complete, artifact: RichArtifact, problems: string[]) {
  return generate(complete, artifact.tipo, [
    { role: "system", content: designerPrompt(artifact.tipo) },
    {
      role: "user",
      content: JSON.stringify({
        artefactoActual: artifact,
        problemasMedidosAlDibujarlo: problems,
        instruccion:
          "El artefacto ya se dibujó en el navegador y se midieron estos problemas visuales. Corrige la maquetación para eliminarlos todos sin perder contenido ni interactividad: reorganiza con CSS grid/flex, deja que el texto ajuste líneas, separa etiquetas, usa tutor.conectar para flechas entre cajas y ajusta el viewBox. Devuelve el objeto JSON completo del mismo tipo.",
      }),
    },
  ]);
}
