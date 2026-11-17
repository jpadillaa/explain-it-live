import type { RichArtifact } from "./artifacts";

/**
 * En Node no hay DOM y DOMPurify queda inactivo (sin addHook/sanitize), lo que
 * rompe mermaid.parse con etiquetas entre comillas. Aquí solo se valida la
 * sintaxis: el dibujo y el saneamiento reales ocurren en el navegador.
 */
async function loadMermaidForParsing() {
  const purify = (await import("dompurify")).default as unknown as Record<string, unknown>;
  if (typeof purify.addHook !== "function")
    Object.assign(purify, {
      addHook() {},
      removeHook() {},
      removeHooks() {},
      removeAllHooks() {},
      sanitize: (value: unknown) => String(value),
    });
  return (await import("mermaid")).default;
}

/**
 * Validación semántica en el servidor, posterior a Zod: Mermaid debe poder
 * analizarse y Vega-Lite debe compilar a Vega. Devuelve mensajes para que el
 * diseñador corrija su salida.
 */
export async function richArtifactIssues(artifact: RichArtifact): Promise<string[]> {
  if (artifact.tipo === "mermaid") {
    try {
      const mermaid = await loadMermaidForParsing();
      await mermaid.parse(artifact.codigo);
      if (/%%\{\s*init|click\s+\w+\s+(?:call|href)/i.test(artifact.codigo))
        return ["No incluyas bloques %%{init}%% ni acciones click: la aplicación aplica el tema"];
      return [];
    } catch (error) {
      return [`Mermaid no puede analizar el diagrama: ${message(error)}`];
    }
  }
  if (artifact.tipo === "vegalite") {
    try {
      const [{ compile }, { parse }] = await Promise.all([import("vega-lite"), import("vega")]);
      // Vega-Lite descarta en silencio lo que no entiende (p. ej. un canal sin campo)
      // y solo lo advierte: esas advertencias también exigen corrección.
      const warnings: string[] = [];
      const capture = (...parts: unknown[]) => {
        warnings.push(parts.map(String).join(" ").slice(0, 400));
        return logger;
      };
      const logger = {
        level: () => logger,
        error: capture,
        warn: capture,
        info: () => logger,
        debug: () => logger,
      };
      const compiled = compile(artifact.spec as any, { logger: logger as any }).spec;
      parse(compiled);
      return [...new Set(warnings)].slice(0, 5).map((w) => `Vega-Lite advierte: ${w}`);
    } catch (error) {
      return [`Vega-Lite no puede compilar la especificación: ${message(error)}`];
    }
  }
  return [];
}

function message(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 600);
}
