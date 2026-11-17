import { NextResponse } from "next/server";
import { decodeAudioWav, MAX_AUDIO_BYTES } from "@/lib/audio";
import { prepareVoiceModel, transcribeAudio } from "@/lib/transcription";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    await prepareVoiceModel();
    return NextResponse.json({ ready: true, engine: "local-whisper" });
  } catch {
    return NextResponse.json(
      {
        ready: false,
        error:
          "No se pudo cargar el reconocimiento local. Ejecuta npm run voice:prepare y reinicia el servidor.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("audio/wav"))
    return NextResponse.json(
      { error: "Se requiere una grabación WAV." },
      { status: 415 },
    );
  if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES)
    return NextResponse.json(
      { error: "La intervención puede durar hasta 60 segundos." },
      { status: 413 },
    );
  let samples: Float32Array;
  try {
    samples = decodeAudioWav(await request.arrayBuffer());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audio inválido." },
      { status: 400 },
    );
  }
  try {
    const text = await transcribeAudio(samples, request.signal);
    if (!text)
      return NextResponse.json(
        {
          error:
            "No detecté palabras en la grabación. Acércate al micrófono y vuelve a hablar.",
        },
        { status: 422 },
      );
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo transcribir tu intervención. Puedes reintentar la grabación.",
      },
      { status: 503 },
    );
  }
}
