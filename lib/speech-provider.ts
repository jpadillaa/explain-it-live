import { narrationText } from "./professor-text";

type Environment = Record<string, string | undefined>;
export class SpeechError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
type SpeechConfig =
  | { provider: "elevenlabs"; key: string; voice: string; model: string }
  | { provider: "kokoro-api"; url: string; voice: string; speed: number };
const providers = ["elevenlabs", "kokoro-api", "local"] as const;

/**
 * SPEECH_PROVIDER elige la voz sin borrar credenciales: elevenlabs, kokoro-api
 * (Kokoro-FastAPI, p. ej. en Docker) o local (Kokoro en proceso). Sin valor se
 * conserva el comportamiento anterior: ElevenLabs si está configurado, si no local.
 */
export function speechConfig(env: Environment = process.env): SpeechConfig | null {
  const choice = env.SPEECH_PROVIDER?.trim().toLowerCase();
  if (choice && !providers.includes(choice as (typeof providers)[number]))
    throw new SpeechError("SPEECH_PROVIDER debe ser elevenlabs, kokoro-api o local.");
  if (choice === "local") return null;
  if (choice === "kokoro-api") return kokoroApiConfig(env);
  const key = env.ELEVENLABS_API_KEY?.trim();
  const voice = env.ELEVENLABS_VOICE_ID?.trim();
  if (!key && !voice && choice !== "elevenlabs") return null;
  if (!key || !voice) throw new SpeechError("Completa ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID en .env y reinicia la aplicación.");
  if (!/^[a-zA-Z0-9_-]+$/.test(voice)) throw new SpeechError("ELEVENLABS_VOICE_ID debe contener el identificador de tu voz, sin URL ni espacios.");
  return { provider: "elevenlabs", key, voice, model: env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2" };
}

function kokoroApiConfig(env: Environment): SpeechConfig {
  const raw = env.KOKORO_API_URL?.trim() || "http://127.0.0.1:8880";
  let url: URL;
  try {
    url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch {
    throw new SpeechError("KOKORO_API_URL debe ser la URL base del servicio, por ejemplo http://127.0.0.1:8880.");
  }
  const voice = env.KOKORO_API_VOICE?.trim() || "ef_dora";
  // Admite combinaciones de Kokoro-FastAPI como «ef_dora+em_alex(0.5)».
  if (!/^[a-z]{2}_[a-z0-9_]+(?:\([0-9.]+\))?(?:[+-][a-z]{2}_[a-z0-9_]+(?:\([0-9.]+\))?)*$/.test(voice))
    throw new SpeechError("KOKORO_API_VOICE debe ser una voz de Kokoro, por ejemplo ef_dora o em_alex.");
  const speed = Number(env.KOKORO_API_SPEED?.trim() || "1");
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2)
    throw new SpeechError("KOKORO_API_SPEED debe estar entre 0.5 y 2.");
  return { provider: "kokoro-api", url: url.origin + url.pathname.replace(/\/+$/, ""), voice, speed };
}

async function kokoroApiResponse(
  config: Extract<SpeechConfig, { provider: "kokoro-api" }>,
  text: string,
  signal: AbortSignal | undefined,
  request: typeof fetch,
  stream: boolean,
) {
  let response: Response;
  try {
    response = await request(`${config.url}/v1/audio/speech`, {
      method: "POST",
      signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(90000)]),
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        model: "kokoro",
        voice: config.voice,
        input: narrationText(text),
        response_format: "mp3",
        speed: config.speed,
        stream,
      }),
    });
  } catch {
    signal?.throwIfAborted();
    throw new SpeechError(`No se pudo conectar con Kokoro en ${config.url}. Comprueba que el contenedor está en marcha.`);
  }
  if (!response.ok)
    throw new SpeechError(
      response.status === 400 || response.status === 422
        ? `Kokoro rechazó la petición. Revisa KOKORO_API_VOICE (${config.voice}).`
        : `Kokoro respondió ${response.status} al generar la narración.`,
    );
  if (!response.headers.get("content-type")?.startsWith("audio/")) throw new SpeechError("Kokoro no devolvió un audio válido.");
  return response;
}

export async function professorSpeechResponse(
  text: string,
  signal?: AbortSignal,
  env: Environment = process.env,
  request: typeof fetch = fetch,
  stream = false,
): Promise<Response> {
  const config = speechConfig(env);
  if (config?.provider === "kokoro-api") return kokoroApiResponse(config, text, signal, request, stream);
  if (!config) {
    // The local model is loaded only when ElevenLabs is not configured.
    const { synthesizeProfessor } = await import("./professor-voice");
    const audio = await synthesizeProfessor(text, signal);
    return new Response(audio, { headers: { "Content-Type": audio.type } });
  }
  let response: Response;
  try {
    response = await request(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voice)}${stream ? "/stream" : ""}?output_format=mp3_44100_128`, {
      method: "POST",
      signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(45000)]),
      headers: { "xi-api-key": config.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: narrationText(text), model_id: config.model }),
    });
  } catch {
    signal?.throwIfAborted();
    throw new SpeechError("No se pudo conectar con ElevenLabs. Vuelve a intentar la narración.");
  }
  if (!response.ok) {
    // Do not relay provider bodies: they may include account or request details.
    const messages: Record<number, string> = {
      401: "ElevenLabs rechazó la clave. Revisa ELEVENLABS_API_KEY y sus permisos de texto a voz.",
      403: "Tu cuenta de ElevenLabs no tiene permiso para usar esta voz o modelo.",
      404: "ElevenLabs no encontró la voz o el modelo. Revisa sus identificadores.",
      422: "ElevenLabs rechazó la configuración de voz. Revisa el modelo seleccionado.",
      429: "ElevenLabs alcanzó un límite de solicitudes o créditos. Revisa tu cuenta e inténtalo de nuevo.",
    };
    throw new SpeechError(messages[response.status] || "ElevenLabs no pudo generar la narración. Inténtalo de nuevo.", response.status === 429 ? 429 : 503);
  }
  if (!response.headers.get("content-type")?.startsWith("audio/")) throw new SpeechError("ElevenLabs no devolvió un audio válido.");
  return response;
}

export async function professorSpeech(text: string, signal?: AbortSignal, env: Environment = process.env, request: typeof fetch = fetch): Promise<Blob> {
  const response = await professorSpeechResponse(text, signal, env, request);
  const audio = await response.blob();
  if (!audio.size) throw new SpeechError("El servicio de voz devolvió un audio vacío.");
  return audio;
}
