import {
  AUDIO_SAMPLE_RATE,
  MAX_AUDIO_SECONDS,
  audioRms,
  encodeAudioWav,
} from "./audio";
export type VoiceCapture = { stop: () => void; cancel: () => void };
export type VoicePhase = "permission" | "recording" | "transcribing";

export class VoiceActivityDetector {
  private loudFrames = 0;
  private lastSpeech = 0;
  private heardSpeech = false;
  constructor(private startedAt: number) {}
  update(rms: number, now: number): "continue" | "stop" | "silence" {
    if (rms > 0.009) {
      this.loudFrames++;
      if (this.loudFrames >= 3) this.heardSpeech = true;
      this.lastSpeech = now;
    } else if (!this.heardSpeech) this.loudFrames = 0;
    if (now - this.startedAt >= MAX_AUDIO_SECONDS * 1000)
      return this.heardSpeech ? "stop" : "silence";
    if (this.heardSpeech && now - this.lastSpeech >= 1500) return "stop";
    if (!this.heardSpeech && now - this.startedAt >= 8000) return "silence";
    return "continue";
  }
}

async function submitVoiceAudio(
  audio: ArrayBuffer,
  signal: AbortSignal,
) {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: audio,
    signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "No se pudo transcribir tu voz. Vuelve a intentarlo.",
    );
  if (typeof data.text !== "string" || !data.text.trim())
    throw new Error(
      "No reconocí palabras. Acércate al micrófono y vuelve a hablar.",
    );
  return data.text.trim().slice(0, 3000);
}

export async function startVoiceCapture(options: {
  signal: AbortSignal;
  onPhase: (phase: VoicePhase) => void;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  onLevel?: (rms: number) => void;
}): Promise<VoiceCapture> {
  const { signal } = options;
  signal.throwIfAborted();
  options.onPhase("permission");
  const context = new AudioContext();
  void context.resume().catch(() => {});
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (error) {
    await context.close();
    throw error;
  }
  if (signal.aborted) {
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    signal.throwIfAborted();
  }
  let source: MediaStreamAudioSourceNode | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let recorder: MediaRecorder | undefined;
  let cancelled = false,
    stopping = false,
    completed = false,
    released = false;
  const chunks: Blob[] = [];
  function release() {
    if (released) return;
    released = true;
    if (timer) clearInterval(timer);
    options.onLevel?.(0);
    source?.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    if (context.state !== "closed") void context.close().catch(() => {});
  }
  function cancel() {
    cancelled = true;
    release();
    if (recorder?.state === "recording") recorder.stop();
    signal.removeEventListener("abort", cancel);
  }
  function fail(message: string) {
    if (cancelled || completed) return;
    completed = true;
    cancel();
    options.onError(message);
  }
  function stop() {
    if (cancelled || stopping || completed) return;
    stopping = true;
    if (recorder?.state === "recording") recorder.stop();
    release();
  }
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const recordingType = recorder.mimeType;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () =>
      fail("No se pudo grabar el micrófono. Vuelve a intentarlo.");
    recorder.onstop = async () => {
      if (cancelled || completed) return;
      try {
        options.onPhase("transcribing");
        const offline = new OfflineAudioContext(1, 1, AUDIO_SAMPLE_RATE);
        const decoded = await offline.decodeAudioData(
          await new Blob(chunks, { type: recordingType }).arrayBuffer(),
        );
        if (cancelled) return;
        const samples = new Float32Array(Math.min(decoded.length, AUDIO_SAMPLE_RATE * MAX_AUDIO_SECONDS));
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          const values = decoded.getChannelData(channel);
          for (let i = 0; i < samples.length; i++)
            samples[i] += values[i] / decoded.numberOfChannels;
        }
        if (audioRms(samples) < 0.002) {
          fail("No detecté voz. Acércate al micrófono y vuelve a hablar.");
          return;
        }
        const transcript = await submitVoiceAudio(
          encodeAudioWav(samples),
          signal,
        );
        if (cancelled || completed) return;
        completed = true;
        signal.removeEventListener("abort", cancel);
        options.onTranscript(transcript);
      } catch (error) {
        if (!cancelled)
          fail(
            error instanceof Error
              ? error.message
              : "No se pudo interpretar la grabación. Vuelve a hablar.",
          );
      }
    };
    source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const detector = new VoiceActivityDetector(performance.now());
    recorder.start();
    options.onPhase("recording");
    timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const rms = audioRms(samples);
      options.onLevel?.(rms);
      const action = detector.update(rms, performance.now());
      if (action === "stop") stop();
      if (action === "silence")
        fail(
          "No detecté voz. Comprueba el micrófono seleccionado y vuelve a hablar.",
        );
    }, 100);
    return { stop, cancel };
  } catch (error) {
    cancel();
    throw error;
  }
}
