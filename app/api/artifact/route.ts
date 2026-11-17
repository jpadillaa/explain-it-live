import { z } from "zod";
import { readJsonPost } from "@/lib/json-post";
import { getProvider } from "@/lib/provider";
import { modelClient } from "@/lib/model-client";
import { repairLayout } from "@/lib/artifact-designer";
import { artifactSchema } from "@/lib/tutor";

export const runtime = "nodejs";

// El navegador dibuja el artefacto, mide sus problemas visuales y pide aquí la corrección.
const requestSchema = z.object({
  artefacto: artifactSchema,
  problemas: z.array(z.string().min(1).max(400)).min(1).max(12),
});

export async function POST(request: Request) {
  const body = await readJsonPost(request, 1024 * 1024);
  if (!body.ok) return body.response;
  const parsed = requestSchema.safeParse(body.data);
  if (!parsed.success || !["html", "svg"].includes(parsed.data.artefacto.tipo))
    return Response.json({ error: "Envía un artefacto HTML o SVG y sus problemas." }, { status: 400 });
  const provider = getProvider();
  if (!provider || "error" in provider)
    return Response.json({ error: "No hay un modelo configurado para corregir la visualización." }, { status: 503 });
  try {
    const { complete } = modelClient(provider, request.signal);
    const repair = repairLayout(
      complete,
      parsed.data.artefacto as Parameters<typeof repairLayout>[1],
      parsed.data.problemas,
    );
    let step = await repair.next();
    while (!step.done) step = await repair.next();
    return step.value
      ? Response.json({ artefacto: step.value })
      : Response.json({ error: "La corrección no superó la validación." }, { status: 422 });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo corregir la visualización." },
      { status: 502 },
    );
  }
}
