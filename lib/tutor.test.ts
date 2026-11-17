import "./test-lesson";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  initialContext,
  localReply,
  replySchema,
  artifactSchema,
} from "./tutor";
import { course, lessonClosings, lessonUnits } from "./course";

function installGlobal(t: TestContext, name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  });
}

function setTestEnv(t: TestContext, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

test("el saludo presenta los tres temas y la lección contiene los cuatro despliegues", () => {
  assert.match(course.welcome, /Hola/);
  assert.match(course.welcome, /NIST/);
  assert.match(course.welcome, /IaaS, PaaS y SaaS/);
  assert.equal(course.slides.length, 3);
  assert.match(course.slides[2].points.join(" "), /Comunitaria/);
});
test("multicloud se admite como concepto afín y una duda usa la lámina visible", () => {
  const reply = localReply({
    mensaje: "¿Qué es multicloud?",
    historial: [],
    contexto: initialContext,
  });
  replySchema.parse(reply);
  assert.match(reply.mensaje, /varios proveedores/);
  const followup = localReply({
    mensaje: "Explica esta idea",
    historial: [],
    contexto: { ...initialContext, slide: 1 },
  });
  assert.match(followup.mensaje, /PaaS/);
  assert.equal(followup.artefacto, null);
});
test("las tablas requieren filas consistentes y el esquema excluye el antiguo ejercicio", () => {
  assert.equal(
    artifactSchema.safeParse({
      tipo: "comparacion",
      titulo: "Modelos",
      columnas: ["Modelo", "Control"],
      filas: [["SaaS", "Aplicación del proveedor"]],
    }).success,
    true,
  );
  assert.equal(
    artifactSchema.safeParse({
      tipo: "comparacion",
      titulo: "Modelos",
      columnas: ["Modelo", "Control"],
      filas: [["SaaS", "Aplicación", "Extra"]],
    }).success,
    false,
  );
  assert.equal(
    artifactSchema.safeParse({ tipo: "codigo", titulo: "Costo" }).success,
    false,
  );
});

test("Azure usa API v1 y el despliegue configurado", async () => {
  const { getProvider } = await import("./provider");
  for (const endpoint of [
    "https://example.openai.azure.com/",
    "https://example.openai.azure.com/openai/v1/",
  ]) {
    const config = getProvider({
      AZURE_OPENAI_ENDPOINT: endpoint,
      AZURE_OPENAI_API_KEY: "test-key",
      AZURE_OPENAI_DEPLOYMENT_1: "gpt-5.4-mini",
    });
    assert.ok(config && !("error" in config));
    assert.equal(
      config.url,
      "https://example.openai.azure.com/openai/v1/chat/completions",
    );
    assert.equal(config.model, "gpt-5.4-mini");
    assert.equal(config.headers["api-key"], "test-key");
  }
  assert.ok(
    "error" in
      getProvider({
        AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
      })!,
  );
  assert.equal(
    getProvider({ AZURE_OPENAI_DEPLOYMENT_1: "gpt-5.4-mini" }),
    null,
  );
});

test("los diagramas validan ids únicos y conexiones existentes", () => {
  const a = {
    tipo: "diagrama",
    titulo: "Nube híbrida",
    descripcion: "Conexión entre dos entornos cloud.",
    nodos: [
      {
        id: "privada",
        etiqueta: "Nube privada",
        descripcion: "Uso exclusivo.",
        nivel: 0,
      },
      {
        id: "publica",
        etiqueta: "Nube pública",
        descripcion: "Uso público.",
        nivel: 1,
      },
    ],
    conexiones: [
      { origen: "privada", destino: "publica", etiqueta: "Portabilidad" },
    ],
  };
  assert.equal(artifactSchema.safeParse(a).success, true);
  assert.equal(
    artifactSchema.safeParse({
      ...a,
      conexiones: [
        { origen: "privada", destino: "inexistente", etiqueta: "Error" },
      ],
    }).success,
    false,
  );
  assert.equal(
    artifactSchema.safeParse({ ...a, nodos: [a.nodos[0], a.nodos[0]] }).success,
    false,
  );
});

test("las simulaciones calculan nuevas entradas y rechazan fórmulas inválidas", async () => {
  const { calculateFormula, simulationSchema, simulationDefaults } =
    await import("./artifacts");
  const artifact = {
    tipo: "simulacion",
    titulo: "Capacidad cloud",
    descripcion: "Explora el margen.",
    supuestos: ["Cada instancia atiende 100 solicitudes/s."],
    entradas: [
      {
        id: "instancias",
        etiqueta: "Instancias",
        unidad: "",
        min: 1,
        max: 5,
        paso: 1,
        valor: 2,
      },
      {
        id: "demanda",
        etiqueta: "Demanda",
        unidad: "solicitudes/s",
        min: 10,
        max: 500,
        paso: 10,
        valor: 180,
      },
    ],
    salidas: [
      {
        id: "margen",
        etiqueta: "Margen",
        unidad: "solicitudes/s",
        formula: ["instancias", 100, "*", "demanda", "-"],
      },
    ],
    grafica: { entrada: "demanda", salida: "margen" },
  };
  const validated = simulationSchema.parse(artifact);
  assert.equal(
    calculateFormula(
      validated.salidas[0].formula,
      simulationDefaults(validated),
    ),
    20,
  );
  assert.equal(
    calculateFormula(validated.salidas[0].formula, {
      instancias: 3,
      demanda: 180,
    }),
    120,
  );
  assert.equal(calculateFormula([2, 5, "*", 0.1, "*"], {}), 1);
  assert.equal(calculateFormula([180, 100, "/", "ceil"], {}), 2);
  assert.equal(calculateFormula([1, 0, "/"], {}), null);
  assert.equal(calculateFormula([1, 2], {}), null);
  assert.equal(
    simulationSchema.safeParse({
      ...artifact,
      salidas: [{ ...artifact.salidas[0], formula: ["process.exit()"] }],
    }).success,
    false,
  );
  assert.equal(
    simulationSchema.safeParse({
      ...artifact,
      entradas: [{ ...artifact.entradas[0], min: 5, max: 1 }],
    }).success,
    false,
  );
});

test("el progreso incremental admite fragmentos de red y errores intermedios", async () => {
  const { readTutorResponse } = await import("./tutor-stream");
  const answer = {
    mensaje: "Aquí está la comparación.",
    artefacto: null,
    acciones: [],
    mode: "connected",
  };
  const data = [
    { tipo: "estado", etapa: "alcance" },
    { tipo: "estado", etapa: "generacion" },
    { tipo: "estado", etapa: "validacion" },
    { tipo: "resultado", respuesta: answer },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n");
  const bytes = new TextEncoder().encode(data);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7)
        controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  });
  const stages: string[] = [];
  const result = await readTutorResponse(
    new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    }),
    (s) => stages.push(s),
  );
  assert.deepEqual(stages, ["alcance", "generacion", "validacion"]);
  assert.deepEqual(result, answer);
  await assert.rejects(
    readTutorResponse(
      new Response('{"tipo":"error","error":"Azure no disponible"}\n', {
        headers: { "Content-Type": "application/x-ndjson" },
      }),
      () => {},
    ),
    /Azure no disponible/,
  );
  await assert.rejects(
    readTutorResponse(
      new Response('{"tipo":"estado","etapa":"alcance"}\n', {
        headers: { "Content-Type": "application/x-ndjson" },
      }),
      () => {},
    ),
    /interrumpió/,
  );
});

test("el servidor comunica la corrección y conserva el contrato JSON", async (t) => {
  const { POST } = await import("../app/api/tutor/route");
  const { readTutorResponse } = await import("./tutor-stream");
  const keys = [
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT_1",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com/";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT_1 = "test-deployment";
  const answer = {
    mensaje: [{ texto: "Aquí tienes la comparación.", concepto: null }],
    clase: { paso: 0, resumen: initialContext.clase.resumen },
    artefacto: null,
    acciones: [],
  };
  const upstream: unknown[] = [
    { permitido: true },
    { ...answer, artefacto: { tipo: "desconocido" } },
    answer,
    { anuncios: [] },
  ];
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(upstream.shift()) } }],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  );
  try {
    const request = (stream: boolean) =>
      new Request("http://localhost/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: stream ? "application/x-ndjson" : "application/json",
        },
        body: JSON.stringify({
          mensaje: "Compara IaaS y PaaS",
          historial: [],
          contexto: initialContext,
        }),
      });
    const stages: string[] = [];
    const response = await POST(request(true));
    const result = await readTutorResponse(response, (stage) =>
      stages.push(stage),
    );
    assert.equal(result.mensaje, answer.mensaje[0].texto);
    assert.deepEqual(stages, [
      "contexto",
      "alcance",
      "generacion",
      "validacion",
      "correccion",
      "validacion",
    ]);
    assert.equal(fetchMock.mock.callCount(), 4);
    upstream.push({ permitido: true }, answer, { anuncios: [] });
    const jsonResponse = await POST(request(false));
    assert.equal(jsonResponse.headers.get("content-type"), "application/json");
    assert.equal((await jsonResponse.json()).mensaje, answer.mensaje[0].texto);
  } finally {
    fetchMock.mock.restore();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("cada participación conserva solo la explicación actual y el contexto breve de la clase", async () => {
  const { buildParticipationRequest, lessonControl, withLessonState } =
    await import("./tutor");
  const first = buildParticipationRequest(
    "Ver modelos de servicio",
    course.welcome,
    initialContext,
  );
  assert.equal(first.historial.length, 1);
  const next = withLessonState(
    {
      mensaje: "Ahora veremos IaaS y PaaS.",
      artefacto: null,
      acciones: [],
      clase: {
        paso: 1,
        resumen: "Definición explicada. Se inicia servicios.",
        conceptos: ["definicion", "iaas", "paas"],
      },
    },
    first,
  );
  assert.equal(next.clase?.paso, 1);
  assert.equal(next.artefacto?.titulo, course.slides[1].title);
  assert.ok(next.clase?.conceptos.includes("definicion"));
  const context = { ...initialContext, clase: next.clase! };
  const second = buildParticipationRequest(
    "No entiendo la diferencia",
    next.mensaje,
    context,
  );
  assert.deepEqual(second.historial, [
    { role: "assistant", content: next.mensaje },
  ]);
  assert.equal(
    second.contexto.clase.resumen,
    "Definición explicada. Se inicia servicios.",
  );
  assert.equal(lessonControl(second.mensaje, context.clase), null);
  assert.equal(lessonControl("Continúa.", context.clase)?.paso, 1);
  assert.equal(
    lessonControl("Continuar clase", { paso: 2, resumen: "", conceptos: [] })
      ?.paso,
    2,
  );
  const local = localReply(second);
  assert.equal(local.clase?.paso, 1);
});

test("continuar desde el saludo enseña las características, completa servicios y solo resume al cerrar los tres ejes", async () => {
  const { buildParticipationRequest, withLessonState, nextLessonStep } = await import("./tutor");
  let context = initialContext;
  let explanation = course.welcome;
  function turn(message: string) {
    const request = buildParticipationRequest(message, explanation, context);
    const reply = withLessonState(localReply(request), request);
    context = { ...context, clase: reply.clase!, artefacto: reply.artefacto ?? context.artefacto };
    explanation = reply.mensaje;
    return reply;
  }
  turn("Dame un ejemplo");
  const first = turn("Continuar clase");
  assert.equal(first.clase?.paso, 0);
  assert.match(first.mensaje, /servicio medido/i);
  assert.match(first.mensaje, /elasticidad/i);
  assert.ok(first.mensaje.endsWith(lessonClosings[0]));
  assert.equal(turn("Continuar clase").clase?.paso, 1);
  context = { ...context, clase: { ...context.clase, conceptos: context.clase.conceptos.filter(c => c !== "saas") } };
  const partial = turn("Continúa.");
  assert.equal(partial.clase?.paso, 1);
  assert.match(partial.mensaje, /SaaS/);
  assert.ok(partial.mensaje.endsWith(lessonClosings[1]));
  assert.equal(turn("Continuar clase").clase?.paso, 2);
  assert.equal(nextLessonStep(context.clase), null);
  const summary = turn("Resumir la clase").mensaje;
  for (const concept of [/demanda/i, /PaaS/i, /híbrida/i]) assert.match(summary, concept);
  assert.ok(lessonClosings.every(closing => !summary.includes(closing)));
  assert.deepEqual(context.completados, []);
  const detour = { ...context.clase, conceptos: context.clase.conceptos.filter(c => c !== "paas") };
  assert.equal(nextLessonStep(detour), 1);
});

test("una presentación aceptada admite el siguiente turno con la explicación y la participación máximas", async t => {
  setTestEnv(t, { AZURE_OPENAI_API_KEY: "", AZURE_OPENAI_ENDPOINT: "", TUTOR_API_KEY: "" });
  const { POST } = await import("../app/api/tutor/route");
  const { buildParticipationRequest } = await import("./tutor");
  const field = '\u0000'.repeat(3000); // Six UTF-8 bytes per code unit after JSON escaping.
  const slide = { title: field, body: field, points: Array(5).fill(field) };
  const accepted = replySchema.parse({
    mensaje: field,
    acciones: [],
    artefacto: { tipo: "slides", titulo: field, slides: Array(8).fill(slide) },
  });
  const body = JSON.stringify(buildParticipationRequest(field, accepted.mensaje, {
    ...initialContext, artefacto: accepted.artefacto!,
  }));
  assert.ok(Buffer.byteLength(body) > 100000);
  const response = await POST(new Request("http://localhost/api/tutor", {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  }));
  assert.equal(response.status, 200);
  assert.ok(replySchema.safeParse(await response.json()).success);
});

test("un modelo que salta de eje debe corregir la narración y el estado antes de que se publiquen", async t => {
  const { POST } = await import("../app/api/tutor/route");
  const { readTutorResponse } = await import("./tutor-stream");
  setTestEnv(t, { AZURE_OPENAI_ENDPOINT: "https://example.invalid", AZURE_OPENAI_API_KEY: "test", AZURE_OPENAI_DEPLOYMENT_1: "test" });
  const skipped = { mensaje: [{ concepto: null, texto: "Pasemos a IaaS." }], acciones: [], artefacto: null, clase: { paso: 1, resumen: "Modelos." } };
  const corrected = { ...skipped, mensaje: [{ concepto: "autoservicio", texto: "El autoservicio permite solicitar recursos sin un operador." }], clase: { paso: 0, resumen: "Autoservicio." } };
  const replies = [skipped, corrected, { anuncios: [] }];
  const calls = t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, options?: RequestInit) => {
    if (replies.length === 3) {
        const messages = JSON.parse(String(options?.body)).messages;
      const guidance = JSON.parse(messages.at(-1).content);
      assert.equal(guidance.proximoTemaDelPrograma, 0);
      assert.deepEqual(guidance.porDesarrollarEnEsteTurno, ["autoservicio"]);
    }
    return Response.json({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }] });
  });
  const res = await POST(new Request("http://localhost/api/tutor", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify({ mensaje: "Continuar clase", historial: [], contexto: initialContext }),
  }));
  const stages: string[] = [];
  const result = await readTutorResponse(res, s => stages.push(s));
  assert.equal(calls.mock.callCount(), 3);
  assert.ok(stages.includes("correccion"));
  assert.equal(result.mensaje, corrected.mensaje[0].texto);
  assert.deepEqual(result.clase?.conceptos, ["definicion", "autoservicio"]);
});

test("una aclaración sobre autoservicio no da por enseñadas las características que solo aparecen en la lámina", async t => {
  const { POST } = await import("../app/api/tutor/route");
  const { buildParticipationRequest, nextLessonStep } = await import("./tutor");
  setTestEnv(t, { AZURE_OPENAI_ENDPOINT: "https://example.invalid", AZURE_OPENAI_API_KEY: "test", AZURE_OPENAI_DEPLOYMENT_1: "test" });
  const question = "¿El proveedor tiene que aprobar cada solicitud de almacenamiento?";
  const explanation = "El autoservicio bajo demanda te permite solicitar recursos sin esperar la aprobación manual del proveedor.";
  const segue = "Podemos volver a la lámina para continuar.";
  const inflated = {
    mensaje: [{ concepto: "autoservicio", texto: explanation }, { concepto: "servicio_medido", texto: segue }],
    acciones: [], artefacto: null,
    clase: {
      paso: 0, resumen: "Se aclaró el autoservicio.",
      conceptos: ["definicion", "autoservicio", "acceso_red", "agrupacion", "elasticidad", "servicio_medido"],
    },
  };
  const upstream = [{ permitido: true, foco: "autoservicio" }, inflated, { anuncios: [] }];
  const calls = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ choices: [{ message: { content: JSON.stringify(upstream.shift()) } }] })
  );
  const res = await POST(new Request("http://localhost/api/tutor", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildParticipationRequest(question, course.welcome, initialContext)),
  }));
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(result.mensaje, explanation + " " + segue);
  assert.deepEqual(result.clase.conceptos, ["definicion", "autoservicio"]);
  assert.equal(nextLessonStep(result.clase), 0);
  assert.match(result.clase.resumen, /Por retomar: acceso_red/);
  assert.equal(calls.mock.callCount(), 3);
});

test("se recupera el concepto focal cuando Azure omite la etiqueta en una aclaración", async t => {
  const { POST } = await import("../app/api/tutor/route");
  const { buildParticipationRequest } = await import("./tutor");
  setTestEnv(t, { AZURE_OPENAI_ENDPOINT: "https://example.invalid", AZURE_OPENAI_API_KEY: "test", AZURE_OPENAI_DEPLOYMENT_1: "test" });
  const mensaje = "Puedes aprovisionar el almacenamiento directamente sin esperar que el proveedor apruebe cada solicitud.";
  const partial = { mensaje: [{ texto: mensaje, concepto: null }], artefacto: null, acciones: [], clase: { paso: 0, resumen: mensaje } };
  const corrected = { ...partial, mensaje: [{ texto: mensaje, concepto: "autoservicio" }] };
  const replies = [{ permitido: true, foco: "autoservicio" }, partial, corrected, { anuncios: [] }];
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }] })
  );
  const result = await POST(new Request("http://localhost/api/tutor", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildParticipationRequest("¿Quién aprueba el autoservicio?", course.welcome, initialContext)),
  }));
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).clase.conceptos, ["definicion", "autoservicio"]);
  assert.equal(replies.length, 0);
});

for (const [paso, eje] of [
  "características",
  "modelos de servicio",
  "modelos de despliegue",
].entries()) {
  test(`el profesor solo cierra el eje de ${eje} después de su último concepto`, async (t) => {
    const { POST } = await import("../app/api/tutor/route");
    const { buildParticipationRequest } = await import("./tutor");
    const { readTutorResponse } = await import("./tutor-stream");
    setTestEnv(t, {
      AZURE_OPENAI_ENDPOINT: "https://example.invalid",
      AZURE_OPENAI_API_KEY: "test",
      AZURE_OPENAI_DEPLOYMENT_1: "test",
    });
    const units = lessonUnits[paso];
    const penultimate = units.at(-2)!;
    const last = units.at(-1)!;
    const conceptos = units.slice(0, -2).map((unit) => unit.id);
    let contexto = {
      ...initialContext,
      clase: { ...initialContext.clase, paso, conceptos },
    };
    const cierre = {
      texto:
        paso === 2
          ? "Con esto cerramos los modelos de despliegue básicos."
          : `Así completamos el eje de ${eje}.`,
      concepto: null,
    };

    const parts = (unit: typeof penultimate) => ({ texto: unit.text, concepto: unit.id });
    const answer = (...mensaje: { texto: string; concepto: string | null }[]) => ({
      clase: { paso },
      mensaje,
      artefacto: null,
      acciones: [],
    });
    const replies = [answer(parts(penultimate), cierre), answer(parts(last))];
    const calls = t.mock.method(
      globalThis,
      "fetch",
      async (_url: RequestInfo | URL, options?: RequestInit) => {
        const messages = JSON.parse(String(options?.body)).messages;
        const input = JSON.parse(messages.at(-1).content);
        let response: unknown;
        if (input.frases) {
          // Azure JSON mode requires an explicit JSON instruction in the messages.
          assert.match(messages[0].content, /JSON/i);
          const announcements = input.frases.filter(
            (part: { texto: string }) => part.texto === cierre.texto,
          );
          response = {
            anuncios: announcements.map((part: { frase: number }) => ({
              frase: part.frase,
              eje: paso,
            })),
          };
        } else {
          if (replies.length === 2) {
            assert.deepEqual(input.pendientesPorEje[paso], [penultimate.id, last.id]);
            assert.deepEqual(input.pendientesDespuesDelConcepto, [last.id]);
          }
          response = replies.shift();
        }
        return Response.json({
          choices: [{ message: { content: JSON.stringify(response) } }],
        });
      },
    );
    const next = async (previous: string, stages: string[]) =>
      readTutorResponse(
        await POST(
          new Request("http://localhost/api/tutor", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/x-ndjson",
            },
            body: JSON.stringify(
              buildParticipationRequest("Continuar clase", previous, contexto),
            ),
          }),
        ),
        (stage) => stages.push(stage),
      );
    const stages: string[] = [];
    const open = await next(course.welcome, stages);
    assert.ok(!stages.includes("correccion"));
    assert.equal(open.mensaje, penultimate.text);
    assert.deepEqual(open.clase!.conceptos, [...conceptos, penultimate.id]);
    contexto = { ...contexto, clase: open.clase! };
    const finalStages: string[] = [];
    const closed = await next(open.mensaje, finalStages);
    assert.ok(!finalStages.includes("correccion"));
    assert.equal(closed.mensaje, last.text + " " + lessonClosings[paso]);
    assert.deepEqual(
      closed.clase!.conceptos,
      units.map((unit) => unit.id),
    );
    assert.equal(calls.mock.callCount(), 4);
  });
}

test("una duda que enseña el último concepto no autoriza un cierre anterior a su explicación ni el de otro eje pendiente", async (t) => {
  const { POST } = await import("../app/api/tutor/route");
  setTestEnv(t, {
    AZURE_OPENAI_ENDPOINT: "https://example.invalid",
    AZURE_OPENAI_API_KEY: "test",
    AZURE_OPENAI_DEPLOYMENT_1: "test",
  });
  const explanation =
    "Una nube híbrida conecta nubes distintas para mover datos o aplicaciones entre ellas.";
  const example =
    "Una empresa puede mantener datos en su nube privada y mover una carga a la pública.";
  const upstream = [
    { permitido: true, foco: "hibrida" },
    {
      clase: { paso: 2 },
      mensaje: [
        { texto: "Ya terminamos los despliegues. " + explanation, concepto: "hibrida" },
        { texto: example + " Así completamos toda la clase.", concepto: null },
      ],
      acciones: [],
      artefacto: null,
    },
    {
      anuncios: [
        { frase: 0, eje: 2 },
        { frase: 3, eje: "clase" },
      ],
    },
  ];
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [{ message: { content: JSON.stringify(upstream.shift()) } }],
    }),
  );
  const response = await POST(
    new Request("http://localhost/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({
        mensaje: "¿Cómo se conecta una nube híbrida?",
        historial: [],
        contexto: {
          ...initialContext,
          clase: {
            paso: 2,
            conceptos: ["definicion", "privada", "comunitaria", "publica"],
            resumen: "",
          },
        },
      }),
    }),
  );
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((row) => JSON.parse(row));
  const reply = events.at(-1).respuesta;
  assert.equal(reply.mensaje, [explanation, example, lessonClosings[2]].join(" "));
  assert.deepEqual(reply.clase.conceptos, [
    "definicion",
    "privada",
    "comunitaria",
    "publica",
    "hibrida",
  ]);
  assert.equal(upstream.length, 0);
});

test("un anuncio etiquetado como el último concepto no basta para completar el eje", async t => {
  const { POST } = await import("../app/api/tutor/route");
  setTestEnv(t, { AZURE_OPENAI_ENDPOINT: "https://example.invalid", AZURE_OPENAI_API_KEY: "test", AZURE_OPENAI_DEPLOYMENT_1: "test" });
  const draft = {
    mensaje: [{ texto: "Ya cubrimos los cuatro despliegues.", concepto: "hibrida" }],
    clase: { paso: 2 }, acciones: [], artefacto: null,
  };
  const review = { anuncios: [{ frase: 0, eje: 2 }] };
  const upstream = [draft, review, draft, review];
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ choices: [{ message: { content: JSON.stringify(upstream.shift()) } }] }),
  );
  const response = await POST(new Request("http://localhost/api/tutor", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify({
      mensaje: "Continuar clase", historial: [], contexto: { ...initialContext,
        clase: { paso: 2, conceptos: ["privada", "comunitaria", "publica"], resumen: "" },
      },
    }),
  }));
  const events = (await response.text()).trim().split("\n").map(row => JSON.parse(row));
  assert.ok(events.some(event => event.etapa === "correccion"));
  assert.equal(events.at(-1).tipo, "error");
  assert.ok(!events.some(event => event.tipo === "resultado"));
  assert.equal(upstream.length, 0);
});

test("el tutor y la voz rechazan solicitudes de otro origen y tipos simples antes de usar el proveedor", async t => {
  const { POST: tutor } = await import("../app/api/tutor/route");
  const { POST: speech } = await import("../app/api/speech/route");
  const upstream = t.mock.method(globalThis, "fetch", () => { throw new Error("Proveedor inesperado"); });
  for (const handle of [tutor, speech]) {
    for (const [origin, type, status] of [
      ["https://otro.invalid", "application/json", 403],
      ["null", "application/json", 403],
      ["http://localhost", "text/plain", 415],
      ["http://localhost", "application/json; charset=utf-8", 400],
    ] as const) {
      const res = await handle(new Request("http://localhost/api", {
        method: "POST", headers: { Origin: origin, "Content-Type": type }, body: "{}",
      }));
      assert.equal(res.status, status);
    }
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("un cuerpo JSON por encima del presupuesto devuelve 413 también sin Content-Length", async () => {
  const { POST } = await import("../app/api/tutor/route");
  const { tutorRequestByteLimit } = await import("./tutor");
  const res = await POST(new Request("http://localhost/api/tutor", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: "é".repeat(Math.floor(tutorRequestByteLimit / 2) + 1),
  }));
  assert.equal(res.status, 413);
});

test("el barrido recorre pasos pequeños y alcanza el máximo fuera de la cuadrícula", async () => {
  const { nextSimulationValue } = await import("./artifacts");
  const input = { id: "tarifa", etiqueta: "Tarifa", unidad: "USD", min: 0, max: 0.00000105, paso: 1e-7, valor: 0 };
  let value = input.valor;
  for (let step = 0; step < 11; step++) {
    const next = nextSimulationValue(input, value);
    assert.ok(next > value);
    value = next;
  }
  assert.equal(value, input.max);
});

test("el audio del navegador se convierte a PCM sin depender de reconocimiento externo", async () => {
  const { encodeAudioWav, decodeAudioWav } = await import("./audio");
  const samples = Float32Array.from(
    { length: 16000 },
    (_, i) => Math.sin(i / 10) * 0.3,
  );
  const decoded = decodeAudioWav(encodeAudioWav(samples));
  assert.equal(decoded.length, samples.length);
  assert.ok(Math.abs(decoded[123] - samples[123]) < 0.0001);
  assert.throws(() => decodeAudioWav(new ArrayBuffer(4)), /grabación/);
  const invalid = encodeAudioWav(samples);
  new DataView(invalid).setUint32(24, 44100, true);
  assert.throws(() => decodeAudioWav(invalid), /válida/);
});

test("una pausa termina el turno y el silencio no se envía al profesor", async () => {
  const { VoiceActivityDetector } = await import("./voice");
  const detector = new VoiceActivityDetector(0);
  assert.equal(detector.update(0.03, 100), "continue");
  assert.equal(detector.update(0.03, 200), "continue");
  assert.equal(detector.update(0.03, 300), "continue");
  assert.equal(detector.update(0, 1200), "continue");
  assert.equal(detector.update(0, 1800), "stop");
  assert.equal(new VoiceActivityDetector(0).update(0, 8100), "silence");
});

test("la grabación se envía una vez, libera el micrófono y permite cancelar", async (t) => {
  const { startVoiceCapture } = await import("./voice");
  let tracksStopped = 0,
    requests = 0;
  const stream = { getTracks: () => [{ stop: () => tracksStopped++ }] };
  class Context {
    state = "running";
    resume() {
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    createAnalyser() {
      return {
        fftSize: 2048,
        getFloatTimeDomainData(samples: Float32Array) {
          samples.fill(0.1);
        },
      };
    }
  }
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio"]) });
      queueMicrotask(() => this.onstop?.());
    }
  }
  class Offline {
    decodeAudioData() {
      return Promise.resolve({
        length: 960800, // The recording timer fired 50 ms after the limit.
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(960800).fill(0.1),
      });
    }
  }
  installGlobal(t, "navigator", { mediaDevices: { getUserMedia: async () => stream } });
  installGlobal(t, "AudioContext", Context);
  installGlobal(t, "OfflineAudioContext", Offline);
  installGlobal(t, "MediaRecorder", Recorder);
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { decodeAudioWav } = await import("./audio");
    assert.equal(decodeAudioWav(init!.body as ArrayBuffer).length, 960000);
    requests++;
    return new Response(
      JSON.stringify({ text: "Entiendo PaaS y quiero continuar." }),
      { headers: { "Content-Type": "application/json" } },
    );
  });
  t.after(() => fetchMock.mock.restore());
  const phases: string[] = [];
  const transcripts: string[] = [];
  const levels: number[] = [];
  let finished!: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const controller = new AbortController();
  const recording = await startVoiceCapture({
    signal: controller.signal,
    onPhase: (p) => phases.push(p),
    onLevel: (rms) => levels.push(rms),
    onTranscript: (text) => {
      transcripts.push(text);
      finished();
    },
    onError: (message) => assert.fail(message),
  });
  await new Promise((resolve) => setTimeout(resolve, 130));
  recording.stop();
  recording.stop();
  await done;
  assert.deepEqual(transcripts, ["Entiendo PaaS y quiero continuar."]);
  assert.ok(levels.some((level) => level > 0.09));
  assert.equal(levels.at(-1), 0);
  assert.equal(requests, 1);
  assert.equal(tracksStopped, 1);
  assert.deepEqual(phases, ["permission", "recording", "transcribing"]);
  const cancelled = await startVoiceCapture({
    signal: new AbortController().signal,
    onPhase() {},
    onTranscript: () => assert.fail("Se envió una grabación cancelada"),
    onError: (message) => assert.fail(message),
  });
  cancelled.stop();
  cancelled.cancel();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests, 1);
  assert.equal(tracksStopped, 2);
});

test("el servidor rechaza audio inválido y no transcribe el silencio", async () => {
  const { POST } = await import("../app/api/transcribe/route");
  const { encodeAudioWav } = await import("./audio");
  const invalid = await POST(
    new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: new Uint8Array([1, 2, 3]),
    }),
  );
  assert.equal(invalid.status, 400);
  const silent = await POST(
    new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: encodeAudioWav(new Float32Array(16000)),
    }),
  );
  assert.equal(silent.status, 422);
});

import { narrationChunks, narrationText } from "./professor-text";
test("la narración conserva el contenido y pronuncia las siglas en español", () => {
  assert.equal(narrationText("**NIST**: IaaS, PaaS y SaaS."), "Instituto Nacional de Estándares y Tecnología: infraestructura como servicio, plataforma como servicio y software como servicio.");
  const chunks = narrationChunks(course.welcome);
  assert.ok(chunks.every(part => part.length <= 230));
  assert.equal(chunks.join(" "), course.welcome.replace(/\s+/g, " ").trim());
});

import { professorSpeech, speechConfig, SpeechError } from "./speech-provider";
test("ElevenLabs se activa con clave y voz completas y mantiene el modo local sin ambas", () => {
  assert.equal(speechConfig({}), null);
  assert.equal(speechConfig({ ELEVENLABS_API_KEY: "  ", ELEVENLABS_VOICE_ID: "" }), null);
  assert.throws(() => speechConfig({ ELEVENLABS_API_KEY: "secret" }), /Completa/);
  assert.throws(() => speechConfig({ ELEVENLABS_API_KEY: "secret", ELEVENLABS_VOICE_ID: "https://invalid" }), /identificador/);
});
const elevenEnv = { ELEVENLABS_API_KEY: "test-secret", ELEVENLABS_VOICE_ID: "my_voice", ELEVENLABS_MODEL_ID: "eleven_multilingual_v2" };
test("ElevenLabs recibe la voz privada y el texto pronunciable y devuelve audio MP3", async () => {
  const audio = await professorSpeech("NIST y SaaS", undefined, elevenEnv, async (url, init) => {
    assert.equal(String(url), "https://api.elevenlabs.io/v1/text-to-speech/my_voice?output_format=mp3_44100_128");
    assert.equal(new Headers(init?.headers).get("xi-api-key"), "test-secret");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model_id, "eleven_multilingual_v2");
    assert.match(body.text, /Instituto Nacional/);
    assert.match(body.text, /software como servicio/);
    return new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } });
  });
  assert.equal(audio.type, "audio/mpeg");
  assert.equal(audio.size, 3);
});
test("los errores de ElevenLabs no exponen respuestas privadas ni cambian de voz", async () => {
  for (const status of [401, 403, 404, 422, 429, 500]) {
    await assert.rejects(professorSpeech("Hola", undefined, elevenEnv, async () => new Response("test-secret private account", { status })), error => error instanceof SpeechError && !error.message.includes("test-secret"));
  }
  await assert.rejects(professorSpeech("Hola", undefined, elevenEnv, async () => new Response("not audio")), /audio válido/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(professorSpeech("Hola", controller.signal, elevenEnv, async (_url, options) => { options?.signal?.throwIfAborted(); throw new Error(); }), { name: "AbortError" });
});

import { professorSpeechResponse } from "./speech-provider";
test("la narración continua entrega los primeros bytes sin esperar el final del audio", async () => {
  let finish!: () => void;
  const upstream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array([73, 68, 51]));
    finish = () => { controller.enqueue(new Uint8Array([1, 2])); controller.close(); };
  } });
  const response = await professorSpeechResponse("Hola. Hoy estudiaremos nube.", undefined, elevenEnv, async (url, options) => {
    assert.match(String(url), /my_voice\/stream\?output_format=mp3_44100_128/);
    assert.match(JSON.parse(String(options?.body)).text, /Hola/);
    return new Response(upstream, { headers: { "Content-Type": "audio/mpeg" } });
  }, true);
  const reader = response.body!.getReader();
  assert.deepEqual((await reader.read()).value, new Uint8Array([73, 68, 51]));
  finish();
  assert.deepEqual((await reader.read()).value, new Uint8Array([1, 2]));
  assert.equal((await reader.read()).done, true);
});

test("al bloquear autoplay se cancela el MP3 aunque aún no hayan llegado los siguientes bytes", { timeout: 2000 }, async t => {
  const { playStreamedNarration } = await import("./narration-player");
  let cancelled = false;
  const bytes = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1])); },
    cancel() { cancelled = true; },
  });
  t.mock.method(globalThis, "fetch", async () => new Response(bytes));
  class Source extends EventTarget {
    static isTypeSupported() { return true; }
    constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event("sourceopen"))); }
    addSourceBuffer() {
      return new class extends EventTarget {
        buffered = { length: 1 };
        appendBuffer() { queueMicrotask(() => this.dispatchEvent(new Event("updateend"))); }
      };
    }
  }
  class AudioElement {
    async play() { throw new DOMException("Autoplay", "NotAllowedError"); }
    pause() {}
    load() {}
    removeAttribute() {}
  }
  installGlobal(t, "MediaSource", Source);
  installGlobal(t, "Audio", AudioElement);
  t.mock.method(URL, "createObjectURL", () => "blob:prueba");
  t.mock.method(URL, "revokeObjectURL", () => {});
  const abort = new AbortController();
  t.after(() => abort.abort());
  await assert.rejects(playStreamedNarration("Hola", abort.signal, () => assert.fail("No debe empezar la narración")), { name: "NotAllowedError" });
  assert.ok(cancelled);
});

test("cada lección Markdown de lessons/ cumple el contrato y la demo local la recorre", async () => {
  const { readdirSync } = await import("node:fs");
  const { loadLessonFile } = await import("./lesson-file");
  const files = readdirSync("lessons").filter((file) => file.endsWith(".md") && file !== "README.md");
  assert.ok(files.includes("arduino-electronica.md"));
  for (const file of files) {
    const lesson = loadLessonFile(`lessons/${file}`);
    assert.ok(lesson.ejes.length >= 1, file);
    assert.equal(lesson.objetivos.length, lesson.objetivos.filter((o) => o.respuesta < o.opciones.length).length);
  }
  const arduino = loadLessonFile("lessons/arduino-electronica.md");
  assert.equal(arduino.profesor, "Tu profesora de electrónica");
  assert.deepEqual(arduino.ejes[0].conceptos.map((c) => c.id), ["voltaje", "corriente", "resistencia", "ley_ohm", "circuito"]);
  assert.deepEqual(arduino.ejes[2].ejemplo?.conceptos, ["estructura_sketch", "salida_digital"]);
  assert.match(arduino.notas, /20 mA/);
});

test("un front matter o una sección inválidos explican qué corregir", async () => {
  const { parseLessonMarkdown } = await import("./lesson-file");
  assert.throws(() => parseLessonMarkdown("## Bienvenida\nHola"), /front matter/);
  assert.throws(() => parseLessonMarkdown("---\nid: x\n---\n## Otra cosa\nTexto"), /Sección desconocida/);
  assert.throws(() => parseLessonMarkdown("---\nid: x\n---\n## Bienvenida\nHola"), /curso/);
});

test("los artefactos ricos rechazan red, almacenamiento y datos remotos antes de mostrarse", async () => {
  const { richArtifactIssues } = await import("./artifact-check");
  const base = { titulo: "Circuito", descripcion: "Un LED con resistencia.", guia: [] };
  const html = (code: string) => artifactSchema.safeParse({ tipo: "html", ...base, html: code });
  assert.ok(html('<button onclick="tutor.estado({on:true})">Cerrar</button><script>let on=false;</script>').success);
  assert.equal(html('<script src="https://cdn.example.com/d3.js"></script>').success, false);
  assert.equal(html("<script>localStorage.setItem('a','1')</script>").success, false);
  assert.equal(html("<script>fetch('/api')</script>").success, false);
  assert.ok(artifactSchema.safeParse({ tipo: "svg", ...base, svg: '<svg viewBox="0 0 10 10"><circle r="4"/></svg>' }).success);
  assert.equal(artifactSchema.safeParse({ tipo: "svg", ...base, svg: "<div>no</div>" }).success, false);
  const chart = { mark: "line", encoding: { x: { field: "a", type: "quantitative" }, y: { field: "b", type: "quantitative" } } };
  assert.equal(artifactSchema.safeParse({ tipo: "vegalite", ...base, spec: { ...chart, data: { url: "https://x/datos.csv" } } }).success, false);
  const valid = artifactSchema.parse({ tipo: "vegalite", ...base, spec: { ...chart, data: { values: [{ a: 1, b: 2 }, { a: 2, b: 4 }] } } });
  assert.deepEqual(await richArtifactIssues(valid as never), []);
  assert.equal((await richArtifactIssues({ ...valid, spec: { mark: { type: "linea" }, data: { values: [] } } } as never)).length, 1);
  // Caso real: un canal con «calculate» se descarta con una simple advertencia.
  const dropped = await richArtifactIssues({
    ...valid,
    spec: {
      ...chart,
      data: { values: [{ a: 1, b: 2 }] },
      encoding: { x: { field: "a", type: "quantitative" }, y: { calculate: "(datum.v - 2) / datum.r * 1000", type: "quantitative" } },
    },
  } as never);
  assert.match(dropped[0], /Vega-Lite advierte: .*Dropping/);
  const flow = { tipo: "mermaid" as const, ...base, codigo: 'flowchart LR\n  F["Fuente 5 V"] -->|corriente| R["Resistencia 220 Ω"] --> L[LED] --> G[GND]' };
  assert.deepEqual(await richArtifactIssues(flow), []);
  assert.match((await richArtifactIssues({ ...flow, codigo: "flowchart LR\n  A -->" }))[0], /Mermaid/);
});

test("un encargo del profesor llega después de la narración, se corrige una vez y el profesor solo ve su resumen", async (t) => {
  const { POST } = await import("../app/api/tutor/route");
  const { readTutorResponse } = await import("./tutor-stream");
  setTestEnv(t, {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
    AZURE_OPENAI_API_KEY: "test-key",
    AZURE_OPENAI_DEPLOYMENT_1: "docente",
    AZURE_OPENAI_DEPLOYMENT_ARTIFACTS: "disenador",
  });
  const narration = "Imagina un servidor que recibe más visitas de las que puede atender.";
  const lab = {
    tipo: "html",
    titulo: "Elasticidad en acción",
    descripcion: "Ajusta la demanda y observa cuántas instancias se necesitan.",
    guia: ["Mueve la demanda"],
    html: '<input type="range" id="d" aria-label="Demanda"><output id="o"></output><script>const d=document.getElementById("d");d.oninput=()=>tutor.estado({demanda:+d.value});</script>',
  };
  const upstream: unknown[] = [
    { permitido: true, foco: null },
    {
      mensaje: [{ texto: narration, concepto: null }],
      clase: { paso: 0, notaDelEstudiante: "" },
      artefacto: { tipo: "encargo", formato: "html", titulo: lab.titulo, objetivo: "Relacionar demanda y capacidad.", contenido: "Control de demanda y tarjetas de instancias." },
      acciones: ["¿Y si baja la demanda?"],
    },
    { anuncios: [] },
    { ...lab, html: '<script src="https://cdn.example.com/chart.js"></script>' },
    lab,
  ];
  const bodies: { model: string; messages: { content: string }[] }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(upstream.shift()) } }] }), {
      headers: { "Content-Type": "application/json" },
    });
  });
  const previousLab = { ...lab, titulo: "Laboratorio anterior", html: "<p>código anterior que el profesor no necesita</p>" };
  const contexto = { ...initialContext, artefacto: previousLab, estado: { demanda: 40 } };
  const stages: string[] = [];
  const order: string[] = [];
  const result = await readTutorResponse(
    await POST(new Request("http://localhost/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({ mensaje: "Muéstrame la elasticidad con un laboratorio", historial: [], contexto }),
    })),
    (stage) => stages.push(stage),
    {
      onResult: (reply) => {
        order.push("narracion");
        assert.equal(reply.mensaje, narration);
        assert.equal(reply.artefacto, null);
        assert.deepEqual(reply.artefactoPendiente, { formato: "html", titulo: lab.titulo });
      },
      onArtifact: (artifact) => {
        order.push("artefacto");
        assert.equal(artifact.tipo, "html");
      },
      onArtifactError: () => order.push("error"),
    },
  );
  assert.deepEqual(order, ["narracion", "artefacto"]);
  assert.ok(stages.includes("diseno") && stages.at(-1) === "correccion");
  assert.equal(result.artefacto?.tipo, "html");
  assert.equal(bodies[1].model, "docente");
  assert.ok(!bodies[1].messages.at(-1)!.content.includes("código anterior"));
  assert.ok(bodies[1].messages.at(-1)!.content.includes("Laboratorio anterior"));
  assert.equal(bodies[3].model, "disenador");
  const designRequest = bodies[3].messages.at(-1)!.content;
  assert.ok(designRequest.includes("código anterior") && designRequest.includes(narration));
  assert.match(bodies[4].messages.at(-1)!.content, /recursos externos/);
});

test("el análisis de intención exige un gráfico al aclarar un concepto y, si el profesor lo omite, lo encarga igualmente", async (t) => {
  const { POST } = await import("../app/api/tutor/route");
  setTestEnv(t, {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
    AZURE_OPENAI_API_KEY: "test-key",
    AZURE_OPENAI_DEPLOYMENT_1: "docente",
  });
  const idea = "Varios proveedores de nube con cargas repartidas entre ellos";
  const spoken = {
    mensaje: [{ texto: "Multicloud es usar servicios de más de un proveedor de nube.", concepto: null }],
    clase: { paso: 0, notaDelEstudiante: "" },
    artefacto: null,
    acciones: [],
  };
  const lab = {
    tipo: "html",
    titulo: "Multicloud",
    descripcion: "Cargas repartidas entre proveedores.",
    guia: [],
    html: "<div class=\"tarjeta\">Proveedor A</div><div class=\"tarjeta\">Proveedor B</div>",
  };
  const upstream: unknown[] = [
    { permitido: true, foco: null, intencion: "aclaración", apoyo: "grafico", formato: "html", idea },
    spoken,
    spoken,
    { anuncios: [] },
    lab,
  ];
  const bodies: { messages: { content: string }[] }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(upstream.shift()) } }] }), {
      headers: { "Content-Type": "application/json" },
    });
  });
  const response = await POST(new Request("http://localhost/api/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensaje: "¿Qué es multicloud?", historial: [], contexto: initialContext }),
  }));
  const data = await response.json();
  assert.equal(data.artefacto?.tipo, "html");
  assert.equal(upstream.length, 0);
  assert.match(bodies[0].messages[0].content, /apoyo/);
  assert.match(bodies[1].messages.at(-1)!.content, /"apoyo":"grafico"/);
  assert.match(bodies[2].messages.at(-1)!.content, /apoyo gráfico/);
  const design = bodies[4].messages.at(-1)!.content;
  assert.ok(design.includes(idea) && design.includes("¿Qué es multicloud?"));
});

test("un análisis de apoyo mal formado se ignora sin romper el turno", async (t) => {
  const { POST } = await import("../app/api/tutor/route");
  setTestEnv(t, {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
    AZURE_OPENAI_API_KEY: "test-key",
    AZURE_OPENAI_DEPLOYMENT_1: "docente",
  });
  const upstream: unknown[] = [
    { permitido: true, foco: null, apoyo: "mucho", formato: "pdf" },
    {
      mensaje: [{ texto: "Exacto, lo has entendido bien.", concepto: null }],
      clase: { paso: 0, notaDelEstudiante: "" },
      artefacto: null,
      acciones: [],
    },
    { anuncios: [] },
  ];
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(upstream.shift()) } }] }), {
      headers: { "Content-Type": "application/json" },
    }));
  const response = await POST(new Request("http://localhost/api/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensaje: "Sí, eso creo", historial: [], contexto: initialContext }),
  }));
  const data = await response.json();
  assert.equal(data.mensaje, "Exacto, lo has entendido bien.");
  assert.equal(data.artefactoPendiente ?? null, null);
});

test("si el diseñador no logra un artefacto válido, la narración se conserva y se informa el fallo", async (t) => {
  const { POST } = await import("../app/api/tutor/route");
  setTestEnv(t, {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
    AZURE_OPENAI_API_KEY: "test-key",
    AZURE_OPENAI_DEPLOYMENT_1: "docente",
  });
  const broken = { tipo: "mermaid", titulo: "Flujo", descripcion: "Un flujo.", guia: [], codigo: "flowchart LR\n A -->" };
  const upstream: unknown[] = [
    { permitido: true, foco: null },
    {
      mensaje: [{ texto: "Veamos el flujo de una petición.", concepto: null }],
      clase: { paso: 0, notaDelEstudiante: "" },
      artefacto: { tipo: "encargo", formato: "mermaid", titulo: "Flujo", objetivo: "Ver el recorrido.", contenido: "Cliente, red y servidor." },
      acciones: [],
    },
    { anuncios: [] },
    broken,
    broken,
  ];
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(upstream.shift()) } }] }), {
      headers: { "Content-Type": "application/json" },
    }));
  const response = await POST(new Request("http://localhost/api/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensaje: "Dibuja el flujo de una petición", historial: [], contexto: initialContext }),
  }));
  const data = await response.json();
  assert.equal(data.mensaje, "Veamos el flujo de una petición.");
  assert.equal(data.artefacto, null);
  assert.equal(data.artefactoPendiente, null);
  assert.match(data.errorArtefacto, /Flujo/);
});

test("SPEECH_PROVIDER elige Kokoro-FastAPI sin borrar ElevenLabs y valida su configuración", () => {
  assert.equal(speechConfig({ ...elevenEnv })?.provider, "elevenlabs");
  assert.equal(speechConfig({ ...elevenEnv, SPEECH_PROVIDER: "local" }), null);
  assert.deepEqual(speechConfig({ ...elevenEnv, SPEECH_PROVIDER: "kokoro-api" }), {
    provider: "kokoro-api",
    url: "http://127.0.0.1:8880",
    voice: "ef_dora",
    speed: 1,
  });
  assert.equal(
    (speechConfig({ SPEECH_PROVIDER: "kokoro-api", KOKORO_API_VOICE: "ef_dora(0.6)+em_alex(0.4)" }) as { voice: string }).voice,
    "ef_dora(0.6)+em_alex(0.4)",
  );
  assert.throws(() => speechConfig({ SPEECH_PROVIDER: "azure" }), /SPEECH_PROVIDER/);
  assert.throws(() => speechConfig({ SPEECH_PROVIDER: "elevenlabs" }), /Completa/);
  assert.throws(() => speechConfig({ SPEECH_PROVIDER: "kokoro-api", KOKORO_API_URL: "ftp://x" }), /KOKORO_API_URL/);
  assert.throws(() => speechConfig({ SPEECH_PROVIDER: "kokoro-api", KOKORO_API_VOICE: "https://x" }), /KOKORO_API_VOICE/);
  assert.throws(() => speechConfig({ SPEECH_PROVIDER: "kokoro-api", KOKORO_API_SPEED: "4" }), /KOKORO_API_SPEED/);
});

test("Kokoro-FastAPI recibe el texto pronunciable, transmite MP3 y no llama a ElevenLabs", async () => {
  const env = { ...elevenEnv, SPEECH_PROVIDER: "kokoro-api", KOKORO_API_URL: "http://127.0.0.1:8880/", KOKORO_API_VOICE: "em_alex", KOKORO_API_SPEED: "0.95" };
  const response = await professorSpeechResponse("NIST y SaaS", undefined, env, async (url, init) => {
    assert.equal(String(url), "http://127.0.0.1:8880/v1/audio/speech");
    assert.equal(new Headers(init?.headers).get("xi-api-key"), null);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual({ ...body, input: undefined }, { model: "kokoro", voice: "em_alex", response_format: "mp3", speed: 0.95, stream: true, input: undefined });
    assert.match(body.input, /Instituto Nacional/);
    return new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } });
  }, true);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  await assert.rejects(
    professorSpeech("Hola", undefined, env, async () => { throw new TypeError("fetch failed"); }),
    /contenedor está en marcha/,
  );
  await assert.rejects(professorSpeech("Hola", undefined, env, async () => new Response("{}", { status: 422 })), /em_alex/);
});

test("el kit del iframe es JavaScript válido y el documento incrusta solo las librerías que usa", async (t) => {
  const { artifactKit } = await import("./artifact-kit");
  assert.doesNotThrow(() => new Function(artifactKit));
  for (const api of ["reproductor", "pasos", "conectar", "preguntar", "estado", "revision"]) assert.match(artifactKit, new RegExp(api));
  const { GET } = await import("../app/api/vendor/route");
  const anime = await GET(new Request("http://localhost/api/vendor?lib=anime"));
  assert.match(await anime.text(), /anime\.js v3/);
  assert.equal((await GET(new Request("http://localhost/api/vendor?lib=lodash"))).status, 404);
  const requested: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requested.push(String(url));
    return new Response(`/* ${url} */ var cierre = "</script>";`);
  });
  const { frameDocument } = await import("./artifact-frame");
  const base = { tipo: "html" as const, titulo: "Video", descripcion: "Animación.", guia: [] };
  const plain = await frameDocument({ ...base, html: "<div id=a></div><script>tutor.reproductor({contenedor:'#a',escenas:[{duracion:1000,dibujar(){}}]})</script>" });
  assert.deepEqual(requested, []);
  assert.match(plain, /Content-Security-Policy/);
  const withD3 = await frameDocument({ ...base, html: "<svg id=g></svg><script>d3.select('#g')</script>" });
  assert.deepEqual(requested, ["/api/vendor?lib=d3"]);
  assert.ok(withD3.includes('"<\\/script>"'), "un </script> dentro de una librería no debe cerrar la etiqueta");
});

test("la corrección de maquetación envía al diseñador los problemas medidos y devuelve un artefacto validado", async (t) => {
  const { POST } = await import("../app/api/artifact/route");
  setTestEnv(t, {
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
    AZURE_OPENAI_API_KEY: "test-key",
    AZURE_OPENAI_DEPLOYMENT_1: "docente",
    AZURE_OPENAI_DEPLOYMENT_ARTIFACTS: "disenador",
  });
  const artifact = { tipo: "html", titulo: "Placa", descripcion: "Partes de la placa.", guia: [], html: '<div style="width:1400px">Pines</div>' };
  const fixed = { ...artifact, html: '<div class="fila"><div class="tarjeta">Pines</div></div>' };
  const bodies: { model: string; messages: { content: string }[] }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(fixed) } }] }), { headers: { "Content-Type": "application/json" } });
  });
  const request = (body: unknown) => new Request("http://localhost/api/artifact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const problem = "El contenido mide 1400 px de ancho y el marco 860 px";
  const response = await POST(request({ artefacto: artifact, problemas: [problem] }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).artefacto.html, fixed.html);
  assert.equal(bodies[0].model, "disenador");
  assert.ok(bodies[0].messages.at(-1)!.content.includes(problem));
  assert.equal((await POST(request({ artefacto: artifact, problemas: [] }))).status, 400);
  assert.equal((await POST(request({ artefacto: { ...artifact, tipo: "mermaid", codigo: "flowchart LR\n A-->B" }, problemas: [problem] }))).status, 400);
});
