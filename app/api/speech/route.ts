import {
  professorSpeechResponse,
  speechConfig,
  SpeechError,
} from "../../../lib/speech-provider";
import { readJsonPost } from "@/lib/json-post";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(
      { provider: speechConfig()?.provider ?? "local" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof SpeechError
            ? error.message
            : "Configuración de voz inválida.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const result = await readJsonPost(request, 6000 * 6 + 1024);
  if (!result.ok) return result.response;
  const body = result.data;
  if (!body || typeof body !== "object" || !("text" in body))
    return Response.json(
      { error: "Falta el texto de la narración." },
      { status: 400 },
    );
  const stream = "stream" in body && body.stream === true;
  const limit = stream ? 6000 : 350;
  if (
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.length > limit
  )
    return Response.json(
      { error: `Envía texto de hasta ${limit} caracteres.` },
      { status: 400 },
    );
  try {
    const audio = await professorSpeechResponse(
      body.text,
      request.signal,
      process.env,
      fetch,
      stream,
    );
    return new Response(audio.body, {
      headers: {
        "Content-Type": audio.headers.get("Content-Type") || "audio/wav",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error(
      "Síntesis del profesor:",
      error instanceof Error ? error.message : "error",
    );
    return Response.json(
      {
        error:
          error instanceof SpeechError
            ? error.message
            : "No se pudo preparar la voz local del profesor. Ejecuta npm run professor:prepare y vuelve a intentarlo.",
      },
      { status: error instanceof SpeechError ? error.status : 503 },
    );
  }
}
