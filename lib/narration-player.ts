/** One continuous MP3 stream, appended as bytes arrive rather than as separate clips. */
export async function playStreamedNarration(text: string, parentSignal: AbortSignal, onStart: () => void, onActivity?: (active: boolean) => void) {
  const playback = new AbortController();
  const signal = AbortSignal.any([parentSignal, playback.signal]);
  const streaming = typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");
  const audio = new Audio();
  audio.preload = "auto";
  let url: string | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let started = false;
  const abort = () => {
    onActivity?.(false);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    void reader?.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const ended = new Promise<void>((resolve, reject) => {
    audio.onended = () => { onActivity?.(false); resolve(); };
    audio.onerror = () => playback.abort(new Error("La narración se interrumpió. Vuelve a escuchar la explicación."));
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  // Register a handler immediately, including while waiting for the first bytes.
  void ended.catch(() => {});
  audio.onwaiting = audio.onpause = () => onActivity?.(false);
  audio.onplaying = () => { onActivity?.(true); if (!started) { started = true; onStart(); } };
  try {
    signal.throwIfAborted();
    const response = await fetch("/api/speech", {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, stream: true }),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "No se pudo generar la narración.");
    }
    if (!streaming || !response.body) {
      url = URL.createObjectURL(await response.blob());
      audio.src = url;
      await audio.play();
    } else {
      const source = new MediaSource();
      url = URL.createObjectURL(source);
      audio.src = url;
      await new Promise<void>((resolve, reject) => {
        source.addEventListener("sourceopen", () => resolve(), { once: true });
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      signal.throwIfAborted();
      const buffer = source.addSourceBuffer("audio/mpeg");
      reader = response.body.getReader();
      let playing: Promise<void> | undefined;
      for (;;) {
        const { done, value } = await reader.read();
        signal.throwIfAborted();
        if (done) break;
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            buffer.removeEventListener("updateend", updated);
            buffer.removeEventListener("error", failed);
            signal.removeEventListener("abort", cancelled);
          };
          const updated = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error("No se pudo decodificar el audio.")); };
          const cancelled = () => { cleanup(); reject(new DOMException("Cancelado", "AbortError")); };
          buffer.addEventListener("updateend", updated, { once: true });
          buffer.addEventListener("error", failed, { once: true });
          signal.addEventListener("abort", cancelled, { once: true });
          try { buffer.appendBuffer(new Uint8Array(value)); } catch (error) { cleanup(); reject(error); }
        });
        // Start as soon as the first decodable frames are buffered.
        if (!playing && buffer.buffered.length) {
          playing = audio.play();
          // play() may need more frames, so keep feeding MSE while it is pending.
          // A rejection must interrupt a pending read and preserve NotAllowedError.
          void playing.catch(error => playback.abort(error));
        }
      }
      if (source.readyState === "open") source.endOfStream();
      if (!playing) throw new Error("ElevenLabs devolvió un audio vacío.");
      await playing;
    }
    await ended;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    audio.onended = audio.onerror = audio.onplaying = audio.onwaiting = audio.onpause = null;
    abort();
    if (url) URL.revokeObjectURL(url);
  }
}

async function fetchLocalFragment(text: string, signal: AbortSignal) {
  const response = await fetch("/api/speech", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "No se pudo generar la voz del profesor.");
  }
  return response.blob();
}

export async function playLocalNarration(
  parts: string[], signal: AbortSignal,
  onPlaying: (visible: string) => void, onActivity: (active: boolean) => void,
) {
  if (!parts.length) return;
  let pending = fetchLocalFragment(parts[0], signal);
  let visible = "";
  for (const [index, part] of parts.entries()) {
    const blob = await pending;
    signal.throwIfAborted();
    // Prepare the next fragment while the current fragment plays.
    if (index + 1 < parts.length) {
      pending = fetchLocalFragment(parts[index + 1], signal);
      void pending.catch(() => {});
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    visible += (visible ? " " : "") + part;
    let onAbort: (() => void) | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        audio.onplaying = () => onPlaying(visible);
        audio.onwaiting = audio.onpause = () => onActivity(false);
        audio.onended = () => { onActivity(false); resolve(); };
        audio.onerror = () => reject(new Error("La reproducción de voz se interrumpió."));
        audio.play().catch(reject);
      });
    } finally {
      if (onAbort) signal.removeEventListener("abort", onAbort);
      audio.onended = audio.onerror = audio.onplaying = audio.onwaiting = audio.onpause = null;
      audio.pause();
      URL.revokeObjectURL(url);
    }
  }
}
