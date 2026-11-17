/** Stop reading as soon as the byte budget is exceeded, including chunked requests. */
export async function readJsonPost(request: Request, maxBytes: number) {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  // Next can use its bind address in request.url. Host is the authority the
  // browser actually contacted (e.g. localhost versus 127.0.0.1).
  const authority = request.headers.get("Host") ?? url.host;
  if (origin !== null && origin !== `${url.protocol}//${authority}`)
    return {
      ok: false,
      response: Response.json(
        { error: "Origen no permitido." },
        { status: 403 },
      ),
    } as const;
  const mediaType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json")
    return {
      ok: false,
      response: Response.json(
        { error: "Se requiere application/json." },
        { status: 415 },
      ),
    } as const;
  const tooLarge = () =>
    Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  if (Number(request.headers.get("Content-Length")) > maxBytes)
    return { ok: false, response: tooLarge() } as const;

  const reader = request.body?.getReader();
  try {
    if (!reader) throw new SyntaxError();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, response: tooLarge() } as const;
      }
      text += decoder.decode(value, { stream: true });
    }
    const data: unknown = JSON.parse(text + decoder.decode());
    return { ok: true, data } as const;
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "Solicitud JSON inválida." },
        { status: 400 },
      ),
    } as const;
  } finally {
    reader?.releaseLock();
  }
}
