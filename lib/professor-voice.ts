import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { narrationText } from "./professor-text";
import { AutoTokenizer, StyleTextToSpeech2Model, Tensor, RawAudio } from "@huggingface/transformers";
import { spawn } from "node:child_process";

function spanishPhonemes(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("espeak-ng", ["-q", "--ipa", "-v", "es", "--stdin"], { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    let detail = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { detail += chunk; });
    child.on("error", () => reject(new Error("Instala espeak-ng para preparar la pronunciación española.")));
    child.on("close", code => code === 0 ? resolve(output.trim().replace(/\n+/g, " ")) : reject(new Error(detail || "Error de fonetización española.")));
    child.stdin.on("error", reject);
    child.stdin.end(text);
  });
}
const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const CACHE = path.join(process.cwd(), ".cache", "professor-voice");
async function load(download: boolean) {
  const options = { cache_dir: CACHE, local_files_only: !download };
  const [model, tokenizer] = await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(MODEL, { ...options, device: "cpu", dtype: "q8", session_options: { intraOpNumThreads: 4, interOpNumThreads: 1 } }),
    AutoTokenizer.from_pretrained(MODEL, options),
  ]);
  const voicePath = path.join(CACHE, "em_alex.bin");
  if (download) {
    const response = await fetch(`https://huggingface.co/${MODEL}/resolve/main/voices/em_alex.bin`);
    if (!response.ok) throw new Error("No se pudo descargar la voz española.");
    await mkdir(CACHE, { recursive: true });
    await writeFile(voicePath, Buffer.from(await response.arrayBuffer()));
  }
  const data = await readFile(voicePath);
  const voice = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  return { model, tokenizer, voice };
}
type Runtime = { ready?: ReturnType<typeof load>; queue: Promise<void> };
const host = globalThis as typeof globalThis & { professorVoice?: Runtime };
const state = host.professorVoice ??= { queue: Promise.resolve() };
export function prepareProfessorVoice(download = false) {
  return state.ready ??= load(download).catch(error => { state.ready = undefined; throw error; });
}
export function synthesizeProfessor(text: string, signal?: AbortSignal) {
  const job = state.queue.then(async () => {
    signal?.throwIfAborted();
    const { model, tokenizer, voice } = await prepareProfessorVoice();
    const phones = await spanishPhonemes(narrationText(text));
    const { input_ids } = tokenizer(phones);
    const tokens = input_ids.dims.at(-1)! - 2;
    if (tokens > 509) throw new Error("Fragmento de voz demasiado largo.");
    signal?.throwIfAborted();
    const offset = Math.max(0, tokens) * 256;
    const { waveform } = await model({ input_ids, style: new Tensor("float32", voice.slice(offset, offset + 256), [1, 256]), speed: new Tensor("float32", [0.98], [1]) });
    signal?.throwIfAborted();
    return new RawAudio(waveform.data, 24000).toBlob();
  });
  state.queue = job.then(() => {}, () => {});
  return job;
}
