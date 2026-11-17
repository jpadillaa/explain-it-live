export const AUDIO_SAMPLE_RATE = 16000;
export const MAX_AUDIO_SECONDS = 60;
export const MAX_AUDIO_BYTES = AUDIO_SAMPLE_RATE * MAX_AUDIO_SECONDS * 2 + 4096;

export function encodeAudioWav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, AUDIO_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 32768 : sample * 32767,
      true,
    );
  }
  return buffer;
}

export function decodeAudioWav(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength < 44 || buffer.byteLength > MAX_AUDIO_BYTES)
    throw new Error("La grabación debe durar entre un instante y 60 segundos.");
  const view = new DataView(buffer);
  const text = (offset: number, size: number) =>
    String.fromCharCode(...new Uint8Array(buffer, offset, size));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE")
    throw new Error(
      "Formato de audio inválido. Vuelve a grabar tu intervención.",
    );
  let validFormat = false,
    samples: Float32Array | undefined;
  for (let offset = 12; offset + 8 <= buffer.byteLength;) {
    const type = text(offset, 4),
      length = view.getUint32(offset + 4, true),
      start = offset + 8;
    if (start + length > buffer.byteLength)
      throw new Error("La grabación está incompleta. Vuelve a intentarlo.");
    if (type === "fmt ") {
      validFormat =
        length >= 16 &&
        view.getUint16(start, true) === 1 &&
        view.getUint16(start + 2, true) === 1 &&
        view.getUint32(start + 4, true) === AUDIO_SAMPLE_RATE &&
        view.getUint16(start + 14, true) === 16;
    }
    if (type === "data") {
      if (length % 2 || length / 2 > AUDIO_SAMPLE_RATE * MAX_AUDIO_SECONDS)
        throw new Error("La grabación es demasiado larga o está dañada.");
      samples = new Float32Array(length / 2);
      for (let i = 0; i < samples.length; i++)
        samples[i] = view.getInt16(start + i * 2, true) / 32768;
    }
    offset = start + length + (length % 2);
  }
  if (!validFormat || !samples || samples.length < AUDIO_SAMPLE_RATE * 0.25)
    throw new Error(
      "No se recibió una grabación de voz válida. Vuelve a hablar.",
    );
  return samples;
}
export function audioRms(samples: Float32Array) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / Math.max(1, samples.length));
}
