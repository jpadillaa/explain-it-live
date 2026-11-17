# Tutor de clase adaptativa

Repositorio: [github.com/jpadillaa/explain-it-live](https://github.com/jpadillaa/explain-it-live)

POC de una clase guiada y adaptativa construida con Next.js, React y TypeScript. Un profesor explica en español por texto y voz; el estudiante participa escribiendo, hablando o con acciones sugeridas. Cada intervención reemplaza la anterior (no es un chat con historial) y el panel central muestra material interactivo generado para lo que se está explicando.

El contenido de la clase vive en un archivo Markdown dentro de `lessons/`. Se incluyen dos lecciones:

- `lessons/nube-nist.md`: fundamentos de computación en la nube según [NIST SP 800-145](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf) (definición, IaaS/PaaS/SaaS y modelos de despliegue).
- `lessons/arduino-electronica.md`: electrónica básica con Arduino (ley de Ohm, la placa y entradas/salidas).

Es una demostración local: no incluye autenticación, base de datos ni sesiones multiusuario.

## Qué incluye

- **Clase guiada:** una sola intervención visible y un estado compacto (eje, conceptos explicados y resumen). «Continuar clase» recorre los conceptos de cada eje; el progreso se completa con preguntas de comprobación.
- **Lecciones en Markdown:** front matter YAML para la interfaz (curso, profesor, objetivos, pronunciación, alcance) y Markdown para el contenido. Formato en [lessons/README.md](lessons/README.md).
- **Artefactos ricos:** el profesor encarga visualizaciones y un diseñador dedicado genera laboratorios HTML/CSS/JS interactivos, animaciones tipo video, esquemas, diagramas Mermaid y gráficos Vega-Lite. Además hay diapositivas, tablas y diagramas/simulaciones declarativos simples.
- **Revisión visual automática:** antes de mostrar un artefacto HTML/SVG se dibuja oculto y se miden textos superpuestos, tapados, recortados o demasiado pequeños, desbordes y errores. El diseñador lo corrige hasta dos veces.
- **Voz:** el profesor empieza silenciado; al activar el altavoz narra con ElevenLabs, con Kokoro-FastAPI (Docker) o con Kokoro local.
- **Participación oral:** grabación en el navegador y transcripción local con Whisper.
- **Avatar 2D** animado solo mientras suena la voz, y revelado de 1,25 s cuando cambia el material.
- **Notas y progreso** guardados en el navegador por lección.

## Requisitos

- Node.js 20.9 o posterior y npm (verificado en macOS con Node.js 26.4.0 y npm 11.17.0).
- Un despliegue de Azure OpenAI (u otro proveedor compatible con Chat Completions) para la experiencia generativa. Sin proveedor se activa una demo guiada limitada.
- Para la voz, una de estas opciones: clave de ElevenLabs, Docker para Kokoro-FastAPI, o `espeak-ng` para Kokoro local.
- Navegador con micrófono, MediaRecorder y Web Audio, en `localhost`/`127.0.0.1` o HTTPS.

## Instalación

```sh
git clone https://github.com/jpadillaa/explain-it-live.git
cd explain-it-live
npm ci
cp -n .env.example .env   # solo si aún no tienes .env
npm run voice:prepare     # descarga Whisper (~78 MB) para el micrófono
npm run dev
```

Abre <http://127.0.0.1:3000>. Las variables de `.env` y la lección se leen al arrancar: **reinicia `npm run dev` tras cambiarlas**. Los cambios de código se recargan solos.

## Docker

`compose.yaml` levanta dos servicios: la app compilada para producción, con Whisper ya descargado en la imagen, y Kokoro-FastAPI, cuya imagen trae el modelo y las voces. No hace falta Node, `npm run voice:prepare` ni Docker manual para la voz.

```sh
docker compose up -d --build
```

Abre <http://127.0.0.1:3000> (otro puerto: `APP_PORT=3100 docker compose up -d`). Para detenerlo: `docker compose down`.

- **Credenciales:** se leen de `.env` al arrancar el contenedor. `.env` nunca se copia a la imagen (`.dockerignore`).
- **Lección:** `LESSON_FILE` se lee de `.env` **al construir**. Tras cambiarla o editar la lección, reconstruye con `docker compose up -d --build`.
- **Voz:** por defecto `kokoro-api` contra el servicio `kokoro` de la red interna (`KOKORO_API_URL` lo fija compose). Para usar tu voz, pon `SPEECH_PROVIDER=elevenlabs` en `.env` y reinicia. `local` no está disponible en la imagen.
- **Versión de Kokoro:** `KOKORO_TAG` fija otra etiqueta de la imagen (por defecto `latest`). El servicio `kokoro` no publica puertos en el equipo.

La imagen de la app ocupa unos 1,9 GB, casi todo dependencias (ONNX Runtime, Transformers, Mermaid y Vega).

## Configuración (`.env`)

Las claves se usan solo en el servidor; no uses el prefijo `NEXT_PUBLIC_` ni compartas `.env`. Si existe `.env.local`, tiene prioridad.

### Lección

```dotenv
LESSON_FILE=lessons/nube-nist.md
# LESSON_FILE=lessons/arduino-electronica.md
```

### Profesor (Azure OpenAI)

```dotenv
AZURE_OPENAI_ENDPOINT=https://TU-RECURSO.openai.azure.com/
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_1=gpt-5.4-mini
# Opcional: despliegue para diseñar artefactos; por defecto el anterior.
AZURE_OPENAI_DEPLOYMENT_ARTIFACTS=
```

El endpoint es la URL base HTTPS del recurso (o su base `/openai/v1/`). La alternativa `TUTOR_API_KEY`, `TUTOR_MODEL`, `TUTOR_BASE_URL` (y `TUTOR_ARTIFACT_MODEL`) sirve para otros proveedores compatibles; Azure tiene prioridad.

### Voz del profesor

```dotenv
SPEECH_PROVIDER=kokoro-api   # elevenlabs | kokoro-api | local
KOKORO_API_URL=http://127.0.0.1:8880
KOKORO_API_VOICE=em_alex     # ef_dora, em_alex, em_santa
KOKORO_API_SPEED=1
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

- **`kokoro-api`** — pruebas sin coste por uso. Arranca el servicio con:
  ```sh
  docker run -d --rm --name kokoro -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
  ```
- **`elevenlabs`** — tu voz; consume créditos de ElevenLabs.
- **`local`** — Kokoro en el propio proceso; requiere `espeak-ng` (`brew install espeak-ng`) y `npm run professor:prepare`.
- **Sin valor** — ElevenLabs si clave y Voice ID están completos; si no, `local`.

ElevenLabs y Kokoro-FastAPI transmiten MP3 que empieza a sonar con los primeros bytes. Mientras el profesor esté silenciado no se llama a ningún servicio de voz.

## Cómo funciona un turno

1. El estudiante escribe, habla o pulsa una acción; se detiene la narración en curso.
2. `/api/tutor` clasifica el alcance y genera la intervención validada con Zod (con un intento de corrección).
3. La narración llega primero. Si el profesor encargó un artefacto rico, la clase sigue mientras el diseñador lo genera, se valida y llega por el mismo stream NDJSON.
4. Los artefactos HTML y SVG pasan por la revisión visual y, si hace falta, por `/api/artifact` para corregir la maquetación.
5. HTML y SVG se muestran en un iframe aislado (`sandbox="allow-scripts"`, CSP sin red). Desde ahí, `tutor.preguntar()` y `tutor.estado()` envían preguntas y estado al profesor. El kit ofrece `tutor.reproductor` (video con escenas), `tutor.pasos` y `tutor.conectar` (flechas automáticas), y anime.js y d3 sin red. Mermaid se dibuja en modo `strict` y Vega sin acceso a la red.

La validación garantiza estructura y aislamiento, no la corrección conceptual de lo generado.

## Pruebas

```sh
npm run typecheck
npm test
npm run build
```

Las pruebas (`lib/tutor.test.ts`) usan la lección NIST y respuestas simuladas de los proveedores; no comprueban tus credenciales. Para la compilación de producción, detén el servidor de desarrollo y ejecuta `npm run start`.

Con el servidor en marcha, `GET /api/tutor` y `GET /api/speech` muestran el modo y el proveedor de voz seleccionados (no prueban autenticación); `GET /api/transcribe` carga Whisper.

## Solución de problemas

| Síntoma | Qué revisar |
| --- | --- |
| No se escucha al profesor | Actívalo con el altavoz; empieza silenciado. Revisa el volumen. |
| «No se pudo conectar con Kokoro» | Que el contenedor esté en marcha y `KOKORO_API_URL` sea correcta. |
| Error de ElevenLabs | Clave, permisos de texto a voz, Voice ID, modelo y créditos. |
| Azure no responde | URL base, clave y nombre exacto del despliegue. Los errores de validación se registran en la terminal. |
| La lección no carga | El arranque muestra el campo del Markdown a corregir. |
| Micrófono o Whisper no disponibles | Permisos del navegador y `npm run voice:prepare`. |
| Una visualización falla | Usa «Pedir corrección» o «Reintentar». |

## Estructura

| Ruta | Función |
| --- | --- |
| `lessons/` | Lecciones en Markdown y su formato. |
| `app/page.tsx`, `app/globals.css` | Interfaz, estado de la clase y estilos. |
| `app/components/` | Panel de artefactos, visor aislado, diagramas, simulaciones, avatar, voz y micrófono. |
| `app/api/tutor`, `app/api/speech`, `app/api/transcribe` | Profesor y diseñador, síntesis de voz y transcripción. |
| `lib/lesson.ts`, `lib/lesson-file.ts`, `lib/course.ts` | Esquema, lectura e inyección de la lección. |
| `lib/tutor.ts`, `lib/tutor-stream.ts` | Contratos de petición, respuesta, estado y stream. |
| `lib/artifacts.ts`, `lib/artifact-check.ts`, `lib/artifact-prompt.ts` | Esquemas, validación y prompt del diseñador. |
| `lib/artifact-designer.ts`, `lib/model-client.ts`, `app/api/artifact` | Diseño, corrección de maquetación y cliente del modelo. |
| `lib/artifact-kit.ts`, `lib/artifact-frame.ts`, `app/api/vendor` | Kit y revisión visual del iframe, y librerías locales. |
| `lib/provider.ts`, `lib/speech-provider.ts` | Proveedores de modelo y voz. |
| `lib/voice.ts`, `lib/audio.ts`, `lib/transcription.ts` | Captura y transcripción de audio. |
| `lib/narration-player.ts`, `lib/professor-voice.ts`, `lib/professor-text.ts` | Reproducción, voz local y pronunciación. |
| `public/tutor-avatar/` | Sprites WebP del avatar. |
| `assets/tutor-avatar/` | PNG originales del avatar (no se publican). |
| `scripts/` | Descarga de modelos locales. |
| `Dockerfile`, `compose.yaml`, `.dockerignore` | Imagen de la app con Whisper y despliegue junto a Kokoro-FastAPI. |

Para las decisiones pedagógicas y técnicas y el estado de verificación, consulta [AGENTS.md](AGENTS.md).
