import type { Provider } from "./provider";

export type Message = { role: string; content: string };
export type ModelStage = "alcance" | "generacion" | "validacion" | "diseno";

/** Llamadas JSON al proveedor; el diseño puede usar un despliegue más capaz. */
export function modelClient(provider: Provider, signal: AbortSignal) {
  const artifactModel =
    process.env.AZURE_OPENAI_DEPLOYMENT_ARTIFACTS?.trim() ||
    process.env.TUTOR_ARTIFACT_MODEL?.trim() ||
    provider.model;
  async function complete(messages: Message[], stage: ModelStage) {
    const response = await fetch(provider.url, {
      method: "POST",
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(stage === "diseno" ? 180000 : stage === "generacion" ? 60000 : 30000),
      ]),
      headers: provider.headers,
      body: JSON.stringify({
        model: stage === "diseno" ? artifactModel : provider.model,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!response.ok) {
      const messages: Record<ModelStage, string> = {
        alcance: `Azure respondió ${response.status} al comprobar el tema. Puedes reintentar.`,
        diseno: `El proveedor respondió ${response.status} al diseñar la visualización. Puedes pedirla de nuevo.`,
        validacion: `El proveedor respondió ${response.status} al verificar la narración. Puedes reintentar.`,
        generacion: `El proveedor respondió ${response.status}. Revisa la clave, el despliegue y el endpoint en .env.`,
      };
      throw new Error(messages[stage]);
    }
    const data = await response.json();
    return String(data.choices?.[0]?.message?.content || "{}");
  }
  return { complete };
}

export function parseModelJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
