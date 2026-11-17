import { lesson } from "./course";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// «pronunciacion» del front matter: siglas en mayúsculas distinguen mayúsculas;
// las claves en minúsculas se reemplazan sin importar su capitalización.
const pronunciations = Object.entries(lesson.pronunciacion).map(([word, spoken]) => ({
  pattern: new RegExp(
    `(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`,
    word === word.toLowerCase() ? "giu" : "gu",
  ),
  spoken,
}));

/** Pronunciation is separate from the original text shown to the student. */
export function narrationText(text: string) {
  let spoken = text.replace(/[*#`]/g, "");
  for (const { pattern, spoken: replacement } of pronunciations)
    spoken = spoken.replace(pattern, () => replacement);
  return spoken.replace(/\s+/g, " ").trim();
}

export function narrationChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    let part = "";
    for (const word of words) {
      if ((part + " " + word).length > 230) {
        chunks.push(part);
        part = "";
      }
      part += (part ? " " : "") + word;
    }
    if (part) chunks.push(part);
  }
  return chunks.filter(Boolean);
}
