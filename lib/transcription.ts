import path from "node:path";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { audioRms } from "./audio";

const MODEL = "Xenova/whisper-base";
const CACHE = path.join(process.cwd(), ".cache", "whisper");
type VoiceRuntime = {
  pipeline: Promise<AutomaticSpeechRecognitionPipeline> | null;
  queue: Promise<void>;
};
const host = globalThis as typeof globalThis & {
  nubeVoiceRuntime?: VoiceRuntime;
};
const state = (host.nubeVoiceRuntime ??= {
  pipeline: null,
  queue: Promise.resolve(),
});

export function prepareVoiceModel(download = false) {
  if (!state.pipeline) {
    state.pipeline = import("@huggingface/transformers")
      .then(({ pipeline }) =>
        pipeline("automatic-speech-recognition", MODEL, {
          device: "cpu",
          dtype: "q8",
          cache_dir: CACHE,
          local_files_only: !download,
          session_options: { intraOpNumThreads: 4, interOpNumThreads: 1 },
        }),
      )
      .catch((error) => {
        state.pipeline = null;
        throw error;
      });
  }
  return state.pipeline;
}

export function transcribeAudio(
  samples: Float32Array,
  signal?: AbortSignal,
): Promise<string> {
  const job = state.queue.then(async () => {
    signal?.throwIfAborted();
    if (audioRms(samples) < 0.002) return "";
    const transcriber = await prepareVoiceModel();
    signal?.throwIfAborted();
    const output = await transcriber(samples, {
      language: "spanish",
      task: "transcribe",
      chunk_length_s: 25,
      stride_length_s: 4,
    });
    signal?.throwIfAborted();
    return (
      Array.isArray(output)
        ? output.map((part) => part.text).join(" ")
        : output.text
    )
      .trim()
      .slice(0, 3000);
  });
  // Serialize access to the cached model, including after a failed transcription.
  state.queue = job.then(
    () => {},
    () => {},
  );
  return job;
}
