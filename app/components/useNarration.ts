import { useEffect, useRef, useState } from "react";
import {
  playLocalNarration,
  playStreamedNarration,
} from "@/lib/narration-player";
import { narrationChunks } from "@/lib/professor-text";

// elevenlabs y kokoro-api entregan MP3 en streaming; local, WAV por fragmentos.
type Provider = "elevenlabs" | "kokoro-api" | "local";
type Playback = {
  phase: "idle" | "preparing" | "playing" | "waiting";
  target: string;
  visible: string;
};
const idle: Playback = { phase: "idle", target: "", visible: "" };

export function useNarration(
  beforeSpeak: () => void,
  reportError: (message: string) => void,
) {
  // La voz empieza silenciada: no se consulta /api/speech (ni ElevenLabs) hasta
  // que el estudiante activa al profesor con el botón de altavoz.
  const [enabled, setEnabled] = useState(false);
  const [playback, setPlayback] = useState(idle);
  const active = useRef<AbortController | null>(null);
  const provider = useRef<Provider | null>(null);

  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  function stop() {
    active.current?.abort();
    active.current = null;
    setPlayback(idle);
  }

  async function start(text: string) {
    stop();
    beforeSpeak();
    const controller = new AbortController();
    const { signal } = controller;
    active.current = controller;
    reportError("");
    setPlayback({ phase: "preparing", target: text, visible: "" });
    function playing(visible: string) {
      if (!signal.aborted)
        setPlayback({ phase: "playing", target: text, visible });
    }
    function activity(isPlaying: boolean) {
      if (!signal.aborted)
        setPlayback((previous) => ({
          ...previous,
          phase: isPlaying ? "playing" : "waiting",
        }));
    }
    try {
      if (!provider.current) {
        const response = await fetch("/api/speech", { signal });
        const config = await response.json();
        signal.throwIfAborted();
        if (!response.ok || !["local", "elevenlabs", "kokoro-api"].includes(config.provider))
          throw new Error(config.error || "Configuración de voz inválida.");
        provider.current = config.provider;
      }
      if (provider.current !== "local")
        await playStreamedNarration(
          text,
          signal,
          () => playing(text),
          activity,
        );
      else
        await playLocalNarration(
          narrationChunks(text),
          signal,
          playing,
          activity,
        );
    } catch (error) {
      if (!signal.aborted)
        reportError(
          error instanceof Error && error.name === "NotAllowedError"
            ? "Pulsa Escuchar explicación para habilitar el audio."
            : error instanceof Error
              ? error.message
              : "No se pudo reproducir la voz.",
        );
    } finally {
      if (active.current === controller) stop();
    }
  }

  // A turn may complete after the listener changed the mute setting.
  const enabledRef = useRef(false);
  function speak(text: string) {
    if (enabledRef.current) void start(text);
  }
  function toggle(text: string) {
    enabledRef.current = !enabledRef.current;
    setEnabled(enabledRef.current);
    if (enabledRef.current) void start(text);
    else stop();
  }
  return { enabled, playback, speak, stop, toggle };
}
