import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { lessonSchema, type Lesson } from "./lesson";

/**
 * Lectura del archivo de lección. Solo se ejecuta en Node (next.config.ts y
 * pruebas); la aplicación recibe el resultado ya validado como JSON.
 */
const defaultLessonFile = "lessons/nube-nist.md";
const lessonEnvKey = "TUTOR_LESSON_JSON";

type Section = { heading: string; lines: string[]; children: Section[] };

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

/** «Título {#id}» → título e id explícito, o un id derivado del título. */
function heading(raw: string) {
  const match = raw.match(/^(.*?)\s*\{#([^}]+)\}\s*$/);
  const title = (match ? match[1] : raw).trim();
  return { title, id: match ? match[2].trim() : slug(title) };
}

/** El texto se muestra sin marcas: negritas, código y enlaces quedan como texto plano. */
function inline(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Separa párrafos, viñetas, citas («> Ejemplo…», «> Cierre…») y la línea «Claves:». */
function content(lines: string[]) {
  const paragraphs: string[] = [];
  const points: string[] = [];
  const quotes: string[] = [];
  let keys: string[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (paragraph.length) paragraphs.push(inline(paragraph.join(" ")));
    if (quote.length) quotes.push(inline(quote.join(" ")));
    paragraph = [];
    quote = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("<!--")) {
      flush();
      continue;
    }
    if (trimmed.startsWith(">")) {
      if (paragraph.length) flush();
      quote.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    if (quote.length) flush();
    const item = trimmed.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      flush();
      points.push(inline(item[1]));
      continue;
    }
    const keyLine = trimmed.match(/^claves:\s*(.*)$/i);
    if (keyLine) {
      flush();
      keys = keyLine[1].split(",").map((k) => normalize(k)).filter(Boolean);
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return { text: paragraphs.join(" "), paragraphs, points, quotes, keys };
}

function sections(body: string) {
  const root: Section[] = [];
  let current: Section | null = null;
  let child: Section | null = null;
  let fence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const match = fence ? null : line.match(/^(#{1,3})\s+(.*?)\s*#*\s*$/);
    if (match && match[1].length === 1) continue; // Título del documento, solo informativo.
    if (match && match[1].length === 2) {
      current = { heading: match[2], lines: [], children: [] };
      child = null;
      root.push(current);
    } else if (match && match[1].length === 3 && current) {
      child = { heading: match[2], lines: [], children: [] };
      current.children.push(child);
    } else (child ?? current)?.lines.push(line);
  }
  return root;
}

function splitFrontMatter(source: string) {
  const match = source.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("La lección debe empezar con un front matter YAML entre líneas ---");
  return { data: parseYaml(match[1]) ?? {}, body: match[2] };
}

export function parseLessonMarkdown(source: string): Lesson {
  const { data, body } = splitFrontMatter(source);
  const lesson: Record<string, unknown> = { ...data, ejes: [], temasAfines: [] };
  const axes = lesson.ejes as unknown[];
  const related = lesson.temasAfines as unknown[];
  for (const section of sections(body)) {
    const name = normalize(section.heading);
    const own = content(section.lines);
    if (name === "bienvenida") lesson.bienvenida = own.text;
    else if (name === "resumen") lesson.resumen = own.text;
    else if (name.startsWith("notas")) {
      const raw = [section.lines, ...section.children.map((c) => [`### ${c.heading}`, ...c.lines])].flat();
      lesson.notas = raw.join("\n").trim();
    } else if (name.startsWith("tema afin:")) {
      const { title, id } = heading(section.heading.replace(/^[^:]*:/, ""));
      related.push({ id, titulo: title, texto: own.text, puntos: own.points });
    } else if (name.startsWith("eje:")) {
      const quotes = [...own.quotes, ...section.children.flatMap((c) => content(c.lines).quotes)];
      const find = (prefix: string) => quotes.find((q) => normalize(q).startsWith(prefix));
      const example = find("ejemplo");
      const exampleMatch = example?.match(/^[^[:]*(?:\[([^\]]*)\])?\s*:\s*([\s\S]*)$/);
      axes.push({
        titulo: section.heading.replace(/^[^:]*:/, "").trim(),
        cuerpo: own.text,
        puntos: own.points,
        claves: own.keys,
        conceptos: section.children.map((c) => {
          const { title, id } = heading(c.heading);
          return { id, titulo: title, texto: content(c.lines).text };
        }),
        ejemplo: exampleMatch
          ? {
              texto: exampleMatch[2].trim(),
              conceptos: (exampleMatch[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean),
            }
          : null,
        cierre: find("cierre")?.replace(/^[^:]*:\s*/, "") ?? "",
      });
    } else
      throw new Error(
        `Sección desconocida «## ${section.heading}». Usa Bienvenida, Eje:, Resumen, Tema afín: o Notas para el profesor.`,
      );
  }
  const checked = lessonSchema.safeParse(lesson);
  if (!checked.success)
    throw new Error(
      "La lección no es válida:\n" +
        checked.error.issues.map((i) => `- ${i.path.join(".") || "(lección)"}: ${i.message}`).join("\n"),
    );
  return checked.data;
}

export function loadLessonFile(file = process.env.LESSON_FILE || defaultLessonFile): Lesson {
  const resolved = path.resolve(process.cwd(), file);
  try {
    return parseLessonMarkdown(readFileSync(resolved, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo cargar la lección ${resolved}: ${reason}`);
  }
}

/** Variables que next.config.ts inyecta en el cliente y el servidor. */
export function lessonEnv(file?: string) {
  return { [lessonEnvKey]: JSON.stringify(loadLessonFile(file)) };
}
