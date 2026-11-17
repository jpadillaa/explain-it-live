type Environment = Record<string, string | undefined>;

export type ModelProviderName = "azure" | "openai" | "gemini";
export type Provider = {
  name: ModelProviderName;
  url: string;
  /** Modelo del profesor (alcance, generación y validación). */
  model: string;
  /** Modelo del diseñador de artefactos; por defecto, el del profesor. */
  artifactModel: string;
  headers: Record<string, string>;
  /** reasoning_effort por fase, para modelos que razonan (Gemini, serie o de OpenAI…). */
  reasoning?: { teacher?: string; artifact?: string };
};

/** Endpoint de Google compatible con Chat Completions de OpenAI. */
export const geminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

const names: ModelProviderName[] = ["azure", "openai", "gemini"];
const trimmed = (value: string | undefined) => value?.trim() || undefined;
const efforts = new Set(["none", "minimal", "low", "medium", "high"]);
function effort(value: string | undefined, fallback?: string) {
  const chosen = trimmed(value)?.toLowerCase() ?? fallback;
  return chosen && efforts.has(chosen) ? chosen : undefined;
}

function azure(env: Environment): Provider | { error: string } {
  const endpoint = trimmed(env.AZURE_OPENAI_ENDPOINT);
  const key = trimmed(env.AZURE_OPENAI_API_KEY);
  if (!endpoint || !key) return { error: "Completa AZURE_OPENAI_ENDPOINT y AZURE_OPENAI_API_KEY en .env." };
  const deployment = trimmed(env.AZURE_OPENAI_DEPLOYMENT_1);
  if (!deployment) return { error: "Completa AZURE_OPENAI_DEPLOYMENT_1 en .env." };
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) throw new Error();
    const path = url.pathname.replace(/\/+$/, "");
    if (path !== "" && path !== "/openai/v1") throw new Error();
    return {
      name: "azure",
      url: `${url.origin}/openai/v1/chat/completions`,
      model: deployment,
      artifactModel: trimmed(env.AZURE_OPENAI_DEPLOYMENT_ARTIFACTS) ?? deployment,
      headers: { "api-key": key, "Content-Type": "application/json" },
    };
  } catch {
    return { error: "AZURE_OPENAI_ENDPOINT debe ser la URL HTTPS del recurso o su base /openai/v1/." };
  }
}

function gemini(env: Environment): Provider | { error: string } {
  const key = trimmed(env.GEMINI_API_KEY);
  if (!key) return { error: "Completa GEMINI_API_KEY en .env (clave de Google AI Studio)." };
  const model = trimmed(env.GEMINI_MODEL) ?? "gemini-4-hydrogen";
  return {
    name: "gemini",
    url: `${geminiBaseUrl}/chat/completions`,
    model,
    artifactModel: trimmed(env.GEMINI_ARTIFACT_MODEL) ?? model,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // Gemini razona por defecto y tarda; el profesor necesita respuestas ágiles.
    reasoning: {
      teacher: effort(env.GEMINI_REASONING_EFFORT, "low"),
      artifact: effort(env.GEMINI_ARTIFACT_REASONING_EFFORT, "medium"),
    },
  };
}

function openai(env: Environment): Provider | { error: string } {
  const key = trimmed(env.TUTOR_API_KEY);
  if (!key) return { error: "Completa TUTOR_API_KEY en .env." };
  const model = trimmed(env.TUTOR_MODEL) ?? "gpt-4.1-mini";
  return {
    name: "openai",
    url: `${(trimmed(env.TUTOR_BASE_URL) ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
    model,
    artifactModel: trimmed(env.TUTOR_ARTIFACT_MODEL) ?? model,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    reasoning: {
      teacher: effort(env.TUTOR_REASONING_EFFORT),
      artifact: effort(env.TUTOR_ARTIFACT_REASONING_EFFORT),
    },
  };
}

/**
 * MODEL_PROVIDER (azure | openai | gemini) elige el proveedor sin borrar las
 * credenciales de los demás. Sin valor: Azure si está configurado, luego
 * Gemini y luego el proveedor compatible TUTOR_*; sin ninguno, demo local.
 */
export function getProvider(env: Environment = process.env): Provider | { error: string } | null {
  const chosen = trimmed(env.MODEL_PROVIDER)?.toLowerCase();
  if (chosen) {
    if (chosen === "azure") return azure(env);
    if (chosen === "gemini") return gemini(env);
    if (chosen === "openai") return openai(env);
    return { error: `MODEL_PROVIDER debe ser ${names.join(", ")}.` };
  }
  if (trimmed(env.AZURE_OPENAI_ENDPOINT) || trimmed(env.AZURE_OPENAI_API_KEY)) return azure(env);
  if (trimmed(env.GEMINI_API_KEY)) return gemini(env);
  if (trimmed(env.TUTOR_API_KEY)) return openai(env);
  return null;
}
