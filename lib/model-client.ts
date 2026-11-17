import type { Provider } from "./provider";

export type Message = { role: string; content: string };
export type ModelStage = "alcance" | "generacion" | "validacion" | "diseno";

/** Llamadas JSON al proveedor; el diseño puede usar un despliegue más capaz. */
export function modelClient(provider: Provider, signal: AbortSignal) {
  const label = { azure: "Azure", openai: "El proveedor", gemini: "Gemini" }[provider.name];
  async function complete(messages: Message[], stage: ModelStage) {
    const reasoning = stage === "diseno" ? provider.reasoning?.artifact : provider.reasoning?.teacher;
    const response = await fetch(provider.url, {
      method: "POST",
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(stage === "diseno" ? 240000 : stage === "generacion" ? 120000 : 60000),
      ]),
      headers: provider.headers,
      body: JSON.stringify({
        model: stage === "diseno" ? provider.artifactModel : provider.model,
        ...(reasoning && { reasoning_effort: reasoning }),
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!response.ok) {
      const messages: Record<ModelStage, string> = {
        alcance: `${label} respondió ${response.status} al comprobar el tema. Puedes reintentar.`,
        diseno: `${label} respondió ${response.status} al diseñar la visualización. Puedes pedirla de nuevo.`,
        validacion: `${label} respondió ${response.status} al verificar la narración. Puedes reintentar.`,
        generacion: `${label} respondió ${response.status}. Revisa la clave, el modelo y el endpoint en .env.`,
      };
      console.error(`[modelo] ${provider.name} ${stage}: HTTP ${response.status}`, (await response.text()).slice(0, 500));
      throw new Error(messages[stage]);
    }
    const data = await response.json();
    return String(data.choices?.[0]?.message?.content || "{}");
  }
  return { complete };
}

export function parseModelJson(content: string): unknown {
  // Algunos modelos (p. ej. Gemini) envuelven el JSON en un bloque ```json.
  const text = content.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
