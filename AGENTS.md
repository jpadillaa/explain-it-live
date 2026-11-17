# Nube Tutor — contexto y guía de continuidad

Actualizado: 16 de noviembre de 2026. Proyecto local: `/Users/jpadillaa/workspace_git/demo_tutor`. Este documento reúne el origen, las decisiones del usuario, la implementación y el estado de verificación. Describe una POC; no implica que exista un producto publicado ni una evaluación pedagógica formal.

## 1. Propósito y punto de partida

La solicitud inicial fue replicar de forma simple una experiencia de tutor de inteligencia artificial observada en capturas: conversación a la izquierda, artefactos dinámicos en el centro y progreso/notas a la derecha. En la referencia, un cuarto panel podía mostrar la ejecución de código. El profesor debía explicar por voz y texto y admitir participaciones escritas, habladas y mediante botones.

La visión original era enseñar cualquier tema y producir presentaciones, gráficos, animaciones, código y diagramas. Para construir rápido se eligió una demostración de fundamentos de computación en la nube con Next.js y TypeScript, sin infraestructura cloud real ni herramientas complejas. La visión amplia es contexto de origen, no el alcance implementado.

Posteriormente el usuario precisó que no buscaba un chat con historial: el profesor conduce una clase magistral que se adapta a las intervenciones. Esta decisión gobierna la experiencia actual. La pantalla muestra la explicación vigente, el estudiante participa y la siguiente intervención reemplaza la anterior.

## 2. Alcance pedagógico vigente

El curso se llama **Fundamentos de nube según NIST**. Su referencia base es NIST SP 800-145: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf. El texto español del proyecto es una paráfrasis, no una traducción oficial ni una cita literal.

Los tres ejes obligatorios son:

1. Definición de computación en la nube y sus cinco características: autoservicio bajo demanda, acceso amplio por red, agrupación de recursos, elasticidad rápida y servicio medido.
2. Modelos de servicio: IaaS, PaaS y SaaS; capacidades entregadas y responsabilidades del consumidor/proveedor.
3. Modelos de despliegue: privado, comunitario, público e híbrido; diferencias por uso y composición.

El estudiante puede explorar temas afines no listados: multicloud, serverless, virtualización, seguridad cloud, proveedores, migración, costos y arquitectura. No se convierten por ello en objetivos obligatorios. Multicloud no debe presentarse como un quinto modelo de despliegue NIST. No atribuir seguridad o disponibilidad garantizada a una nube por ser pública o privada.

Se redirigen las preguntas de otras áreas sin resolverlas. Usar números o matemáticas para explicar capacidad, demanda o costos cloud sí es pertinente. Una aplicación de nube en otra industria es admisible cuando el objeto de la explicación sigue siendo cloud. La restricción de alcance se clasifica por intención y contexto; no debe reducirse a una búsqueda de palabras clave.

### Dinámica de la clase

- El saludo inicial presenta los tres ejes y desarrolla una primera idea sobre la definición. Se muestra en texto; la voz empieza silenciada y solo se narra cuando el estudiante activa al profesor con el altavoz.
- Cada intervención del profesor conecta con la explicación previa. El prompt orienta hacia explicaciones orales naturales de unas 80–150 palabras; peticiones explícitas de brevedad pueden cambiar esa longitud.
- El alumno puede preguntar, responder, pedir ejemplos, solicitar otra representación o manipular una simulación/diagrama. El profesor adapta la siguiente intervención.
- «Continuar clase» desarrolla los conceptos pendientes y luego avanza al siguiente eje. Una duda o una petición de artefacto puede mantener el eje actual.
- Una mera mención en la agenda no acredita que un concepto haya sido enseñado. El estado conserva conceptos ya desarrollados para evitar omisiones al retomar el recorrido.
- El progreso de objetivos se completa con preguntas de comprobación; escuchar o avanzar no equivale a aprobar. Hay tres comprobaciones básicas, no una evaluación exhaustiva.
- Los artefactos deben acompañar la explicación. No todo debe convertirse en diapositivas o listas.

El contenido de cada lección (saludo, ejes, conceptos, cierres, resumen, temas afines, objetivos, preguntas, nombre del profesor, pronunciación y criterios de alcance) vive en un Markdown con front matter YAML dentro de `lessons/` (formato en `lessons/README.md`). `LESSON_FILE` en `.env` elige el archivo (por defecto `lessons/nube-nist.md`; también existe `lessons/arduino-electronica.md`). `next.config.ts` lo lee con `lib/lesson-file.ts`, lo valida con `lib/lesson.ts` y lo inyecta como `TUTOR_LESSON_JSON`; `lib/course.ts` lo expone a cliente y servidor. Cambiar o editar la lección exige reiniciar el servidor. La política docente genérica sigue en `app/api/tutor/route.ts` y se compone con los datos de la lección. Lo descrito en esta sección es la lección NIST.

## 3. Evolución de la POC

| Etapa | Decisión o resultado |
| --- | --- |
| Interfaz inicial | Tres zonas: profesor, lección interactiva y progreso/notas. |
| Modelo real | Integración con Azure OpenAI usando el despliegue solicitado `gpt-5.4-mini`. |
| Reducción curricular | Se acotó a definición NIST, servicios y despliegues; se conservaron preguntas afines de cloud. |
| Clase adaptativa | Se eliminó el historial visible acumulado y se conservó un estado compacto de enseñanza. |
| Reinicio de sesión | Recargar vuelve al saludo y material inicial; notas y progreso siguen persistidos. |
| Artefactos | Se incorporaron comparaciones, diagramas y simulaciones declarativas, además de diapositivas. |
| Lecciones en Markdown | El contenido del curso pasó a `lessons/*.md` (front matter YAML + Markdown), elegido con `LESSON_FILE`. |
| Artefactos ricos | Por decisión del usuario, el modelo genera HTML/CSS/JS, SVG, Mermaid y Vega-Lite mediante un diseñador dedicado en dos fases. |
| Latencia del tutor | Se muestran etapas reales de contexto, alcance, generación, validación y corrección. |
| Participación oral | Se sustituyó el reconocimiento de voz del navegador que fallaba con errores de red por captura y transcripción local con Whisper. |
| Indicador de micrófono | Se añadieron estado de grabación, punto pulsante y barras ligadas al nivel de audio. |
| Voz del profesor | La lectura del sistema se reemplazó por síntesis neuronal local y luego se integró la voz del usuario disponible en ElevenLabs. |
| Fluidez de ElevenLabs | La reproducción por fragmentos se reemplazó por una intervención completa en streaming y un único reproductor. |
| Señal de actualización | El artefacto se revela mediante 12 tarjetas violetas, junto al aviso «Contenido actualizado». |
| Corrección de React | Se resolvieron claves duplicadas entre el revelado y los componentes de diagramas/simulaciones usando prefijos diferenciados. |
| Avatar | Se integraron cuatro sprites del usuario junto a «Tu profesor de nube», animados durante la reproducción oral. |
| Contraste | Se intensificó el fondo lila de la lección a `#e5dff2` para destacar el artefacto blanco. |

No hay un editor de código para el estudiante; el único código ejecutado es el de los artefactos ricos, aislado como se describe en la sección 4. El cuarto panel de ejecución y la generación arbitraria de aplicaciones eran parte de la referencia inicial, no una función actual.

## 4. Arquitectura técnica

Aplicación única con Next.js App Router, React y TypeScript. `package.json` declara Next `^16.0.0`, React `^19.2.0`, TypeScript `^5.9.0`, Zod `^4.0.0`, Lucide y Transformers.js. Al documentar, `package-lock.json` resuelve Next 16.4.6 y React 19.3.1. El lockfile es la referencia para versiones instaladas.

El frontend y las rutas servidor conviven en el mismo proyecto. No hay base de datos, autenticación ni backend separado. Los modelos locales requieren Node.js y ONNX Runtime compatibles; no son rutas Edge. La URL local habitual es `http://127.0.0.1:3000`, con servidor ligado a loopback.

### Mapa de código

| Archivo | Responsabilidad |
| --- | --- |
| `app/page.tsx` | Estado de clase, participación, paneles, notas y progreso. |
| `app/components/LessonWorkspace.tsx` | Artefacto visible, selección de lámina y revelado. |
| `app/components/useNarration.ts`, `MicrophoneLevel.tsx` | Reproducción y cancelación de la voz del profesor e indicador local del nivel del micrófono. |
| `app/globals.css` | Diseño, responsive, contraste y animaciones de interfaz. |
| `app/components/ArchitectureDiagram.tsx` | Render de nodos y conexiones, selección y explicación de componentes. |
| `app/components/InteractiveSimulation.tsx` | Controles, métricas, gráfica y barrido de variables. |
| `app/components/TutorAvatar.tsx` | Cuatro posiciones de boca del profesor. |
| `app/api/tutor/route.ts` | Clasificación de alcance, generación, validación y corrección de respuestas. |
| `lessons/*.md`, `lib/lesson.ts`, `lib/lesson-file.ts`, `lib/course.ts` | Lecciones en Markdown, su esquema, su lectura en Node y su exposición a la app. |
| `lib/tutor.ts` | Esquemas de petición/respuesta/contexto, estado inicial y tutor local de demostración. |
| `lib/artifacts.ts` | Esquemas y evaluación de fórmulas de simulación. |
| `lib/provider.ts` | Configuración servidor de Azure o proveedor alternativo compatible. |
| `lib/tutor-stream.ts` | Contrato de eventos y lectura incremental NDJSON. |
| `lib/voice.ts`, `lib/audio.ts` | Grabación, detección de actividad, conversión y validación WAV. |
| `lib/transcription.ts`, `app/api/transcribe/route.ts` | Transcripción local con Whisper. |
| `lib/speech-provider.ts`, `app/api/speech/route.ts` | Selección de ElevenLabs o voz local y respuestas de audio. |
| `lib/narration-player.ts` | Reproducción MP3 continua mediante MediaSource cuando está disponible. |
| `lib/professor-voice.ts` | Síntesis neuronal local con Kokoro y fonetización española. |
| `lib/professor-text.ts` | Texto pronunciable y segmentación del modo de voz local. |
| `lib/tutor.test.ts` | Pruebas de contratos, comportamiento, audio y proveedores simulados. |
| `scripts/prepare-voice.ts`, `scripts/prepare-professor.ts` | Descarga y preparación de los modelos locales. |

### Un turno de interacción

1. El alumno escribe, pulsa una acción o termina una intervención oral.
2. Se detiene la narración vigente y se cancela la captura anterior cuando corresponde.
3. Se envían la participación, la explicación actual y el contexto compacto a `/api/tutor`.
4. Con proveedor real se clasifica el alcance; si procede, se genera la respuesta y se valida con Zod. Una salida inválida admite un intento adicional de corrección.
5. Se reemplaza la explicación. Si hay artefacto, se actualiza y se reinician sus controles según sus datos iniciales. La señal visual se activa cuando cambian sus datos.
6. Se narra la nueva intervención; el avatar acompaña la reproducción efectiva. El alumno puede interrumpir y comenzar otro turno.

Los clientes NDJSON reciben eventos de progreso; el endpoint también admite la respuesta JSON habitual. Esas etapas son estados de ejecución, no una exposición del razonamiento interno del modelo. La síntesis de voz comienza después de recibir la intervención textual final; la explicación del LLM aún no se narra token a token.

### Memoria y persistencia

El estado docente contiene `paso` (0–2), conceptos explicados y un resumen de hasta 900 caracteres. Cada una de las cinco características tiene su propio identificador. El botón ofrece resumir cuando se han desarrollado todos los conceptos de los tres ejes. El contexto incluye el artefacto visible, diapositiva, valores de controles, nodo seleccionado y objetivos completados. Aunque el contrato conserva un campo `historial`, la experiencia utiliza únicamente la explicación vigente como contexto conversacional, sin acumular un chat completo.

`localStorage`, clave `nube-tutor-nist-v2`, guarda notas y objetivos completados. La recarga restaura esos datos pero reinicia la clase y el artefacto al estado inicial. Por tanto, «sesión nueva» no significa borrar notas/progreso. No confundir progreso persistido con haber cursado la sesión que acaba de abrirse.

### Artefactos ricos generados por el modelo

Decisión del usuario (16/11/2026): los artefactos deben ser elaborados e interactivos, así que el modelo genera código HTML/CSS/JS, SVG, Mermaid y Vega-Lite. Esto sustituye la regla anterior de no ejecutar contenido generado, solo para estos artefactos y con aislamiento:

- **Dos fases.** El profesor (`app/api/tutor/route.ts`) devuelve un `encargo` (`formato`, `titulo`, `objetivo`, `contenido`). El servidor emite primero la narración (`resultado` con `artefactoPendiente`) y después llama al diseñador (`lib/artifact-prompt.ts`, despliegue opcional `AZURE_OPENAI_DEPLOYMENT_ARTIFACTS`). Valida con Zod (`lib/artifacts.ts`) y la semántica de Mermaid/Vega-Lite (`lib/artifact-check.ts`), admite una corrección y emite `artefacto` o `artefacto_error` en el mismo NDJSON. El cliente JSON recibe todo combinado.
- **Aislamiento.** HTML y SVG se muestran en un iframe `sandbox="allow-scripts"` (origen opaco, sin cookies ni almacenamiento de la app) con una CSP que bloquea toda la red (`app/components/RichArtifactView.tsx`). El esquema rechaza recursos externos, peticiones de red, almacenamiento, `alert` y acceso a la ventana principal para que el diseñador los corrija. Mermaid se dibuja con `securityLevel: "strict"` y Vega con un cargador sin red.
- **Puente.** Dentro del iframe, `tutor.preguntar(texto)` envía una participación (como mucho una cada 2 s y nunca mientras el tutor responde). `tutor.estado({...})` guarda hasta 20 valores en `contexto.estado`, que el profesor recibe en el siguiente turno. El profesor solo ve un resumen del artefacto rico (sin su código); el diseñador recibe el código anterior para modificarlo.
- **Experiencia.** Tras la narración la clase queda libre: el estudiante puede escuchar o intervenir mientras se diseña el artefacto, y una nueva participación cancela el diseño pendiente. Si el diseño falla, la narración se conserva y aparece un aviso con «Reintentar».
- **Límites.** La validación garantiza estructura y aislamiento, no la corrección conceptual ni la calidad visual; un artefacto puede tener errores de JavaScript (el iframe los reporta y ofrece «Pedir corrección»). El diseño añade latencia: unos 15-30 s observados con `gpt-5.4-mini`, que no constituyen una garantía.

### Artefactos declarativos

Los tipos `slides`, `comparacion`, `diagrama` y `simulacion` se conservan para casos simples. Zod valida sus estructuras. Los diagramas usan nodos/conexiones identificados, no HTML o JavaScript libre del modelo. Las simulaciones definen entradas, rangos, salidas, fórmulas posfijas y supuestos didácticos. Se recalculan localmente; no ejecutan infraestructura ni predicen resultados reales sin un modelo validado.

Operadores de fórmula: `+`, `-`, `*`, `/`, `^`, `min`, `max`, `ceil`, `floor`. Las salidas referencian entradas y constantes, no otras salidas. No introducir `eval` en la app principal; la ejecución de código generado queda confinada al iframe de los artefactos ricos. Las cifras inventadas deben presentarse como supuestos y nunca atribuirse a NIST.

## 5. Voz, micrófono y avatar

### Entrada del estudiante

Se usa `getUserMedia`, MediaRecorder y AudioContext. La grabación se convierte a WAV PCM mono de 16 kHz y se envía a `/api/transcribe`. Whisper local `Xenova/whisper-base`, cuantizado, reside en `.cache/whisper` y se reutiliza en memoria con inferencia serializada. La limpieza del 16/11/2026 borró toda `.cache` a pedido del usuario: el micrófono necesita `npm run voice:prepare` antes de volver a funcionar, y la voz `local`, `npm run professor:prepare`.

La detección de actividad termina el turno tras aproximadamente 1,5 segundos de pausa; hay salida por silencio inicial y un límite de 60 segundos. Las barras del micrófono responden al RMS del audio. Cancelar libera micrófono, contextos y trabajo pendiente. Azure recibe el texto reconocido y el contexto, no la grabación original.

### Salida del profesor

Si `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID` están completos, se usa esa voz. `ELEVENLABS_MODEL_ID` determina el modelo real; `eleven_multilingual_v2` es el valor predeterminado del código, no una imposición sobre la configuración del usuario. No sustituir el modelo configurado sin motivo.

Con ElevenLabs, cada intervención completa se envía al endpoint TTS `/stream`. El servidor retransmite MP3 a 44,1 kHz/128 kbps. MediaSource para `audio/mpeg` permite empezar con los primeros frames y seguir con un único reproductor. Si el navegador no lo soporta, se descarga el mismo audio completo antes de reproducirlo. Detener, silenciar o abrir el micrófono cancela el trabajo pendiente. Los errores de configuración/permisos/créditos se muestran sin cambiar de voz silenciosamente.

`SPEECH_PROVIDER` (`elevenlabs`, `kokoro-api` o `local`) elige la voz sin borrar credenciales; sin valor se mantiene la selección automática descrita aquí. Con `kokoro-api`, el servidor llama a Kokoro-FastAPI (`KOKORO_API_URL`, por defecto `http://127.0.0.1:8880`; `KOKORO_API_VOICE`, por defecto `ef_dora`; `KOKORO_API_SPEED`) en `/v1/audio/speech` y retransmite MP3 por el mismo reproductor continuo que ElevenLabs. Sirve para probar sin gastar créditos: `docker run -d --rm --name kokoro -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest`. El `.env` local quedó con `SPEECH_PROVIDER=kokoro-api` el 16/11/2026; para volver a la voz del usuario, poner `elevenlabs` y reiniciar.

Sin `SPEECH_PROVIDER`, sin clave ni voice ID se usa Kokoro-82M cuantizado, voz española `em_alex`, WAV de 24 kHz y velocidad 0,98. Requiere `espeak-ng` para los fonemas y `.cache/professor-voice`. Si solo está completa una de las dos variables de ElevenLabs, se informa de configuración incompleta.

**La voz está apagada por defecto en cada carga** (`useNarration`): mientras siga silenciada no se llama a `/api/speech` ni, por tanto, a ElevenLabs o Kokoro. Al activarla con el altavoz se narra la explicación vigente y las siguientes; silenciarla cancela la reproducción.

`narrationText` expande NIST, IaaS, PaaS, SaaS y API y adapta «cloud» para su pronunciación. El texto visible se mantiene. La primera narración puede quedar bloqueada por autoplay; «Escuchar explicación» permite iniciarla por acción del usuario.

### Avatar 2D

Fuente entregada por el usuario: `/Users/jpadillaa/Desktop/avatar-switch-v2.zip`. Los cuatro PNG originales (reposo, entreabierta, abierta y redondeada) se conservan en `assets/tutor-avatar`, fuera de `public`, para no publicarlos. Para la interfaz se precargan cuatro variantes WebP de 128 × 128 px en capas superpuestas. Se alterna la opacidad por pasos, sin deformar la imagen.

El avatar ocupa 64 × 64 px y reemplaza la estrella de la cabecera. La secuencia dura 960 ms y se repite únicamente en estado de voz activa; vuelve al sprite de reposo al acabar, pausar, esperar datos, cancelar o iniciar una intervención. Es una simulación de conversación, no sincronización fonética de labios. Con movimiento reducido permanece estático. No animarlo mientras el tutor solo está pensando ni durante el turno del alumno.

## 6. Diseño y señal de cambio

La interfaz mantiene profesor a la izquierda, artefacto central y progreso/notas a la derecha. El fondo central actual es `--paper: #e5dff2`; el violeta principal es `--purple: #6c58cc`.

Cuando cambian los datos del artefacto, 12 tarjetas violetas en una cuadrícula de 4 × 3 lo cubren y se voltean en diagonal. Cada giro dura 775 ms; el retardo es `(fila + columna) × 95 ms`. El último retardo es 475 ms: el revelado completo dura **1.250 ms**. El aviso «Contenido actualizado» permanece 3,5 segundos. El overlay no bloquea los controles y respeta `prefers-reduced-motion`.

Las claves React del overlay y los artefactos llevan prefijos distintos (`reveal-…`, tipo de artefacto + versión). Conservar esa separación: claves numéricas idénticas entre hermanos produjeron los avisos de duplicados que ya se corrigieron.

## 7. Configuración y ejecución

Conservar las credenciales existentes. Nunca imprimir `.env`, incluir claves en documentación/capturas ni trasladarlas al cliente. No usar prefijos `NEXT_PUBLIC_` para secretos. `.gitignore` excluye `.env*` salvo `.env.example`, modelos en `.cache`, dependencias y compilados.

Variables principales, sin valores privados:

```dotenv
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_1=gpt-5.4-mini
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Azure usa la URL HTTPS base del recurso o `/openai/v1/` y el endpoint `/openai/v1/chat/completions`. La URL `/openai/responses?...` aportada al principio fue normalizada a la base compatible con la implementación actual. Hay una alternativa con `TUTOR_API_KEY`, `TUTOR_MODEL` y `TUTOR_BASE_URL`. Sin proveedor configurado se activa una demo guiada con alcance limitado, no un LLM local equivalente.

La clave de Azure OpenAI se usa solo en ese servicio; ElevenLabs utiliza su propia clave. No reutilizar credenciales de Azure OpenAI en Azure Speech. La prueba anterior con un despliegue TTS de Azure devolvió `DeploymentNotFound`; no se implementó Azure Speech.

Antes del arranque, seleccionar el perfil: Azure + ElevenLabs requiere ambas configuraciones; Azure + voz local requiere preparar Kokoro; la demo sin credenciales también requiere Kokoro para narrar. Whisper se prepara por separado para el micrófono. Copiar `.env.example` no descarga ninguno de esos modelos.

Arranque habitual, con Node.js compatible (Next requiere al menos 20.9; la prueba limpia se ejecutó en macOS con Node.js 26.4.0 y npm 11.17.0, no en todas las versiones):

```sh
npm ci
npm run voice:prepare
npm run dev
```

Para la voz local alternativa, instalar `espeak-ng` y ejecutar `npm run professor:prepare`. Con ElevenLabs no hace falta preparar Kokoro. `.env.local`, si existe, tiene prioridad; reiniciar tras cambiar configuración para verificar qué quedó activo. Detener únicamente el servidor de este proyecto, no todos los procesos Node del equipo.

## 8. Verificación y estado conocido

En la auditoría de instalación se creó una copia temporal sin dependencias, compilados, modelos ni credenciales del proyecto original. Se ejecutaron `npm ci`, TypeScript, 18 pruebas (hoy son 39) y el build correctamente. `.env` se creó desde `.env.example`. También se descargaron y prepararon Whisper y Kokoro desde cachés vacías. `espeak-ng` ya estaba instalado en el sistema: esta auditoría comprobó su uso, no una instalación nueva de Homebrew o del sistema operativo. npm informó scripts pendientes, pero los comandos completaron correctamente sin habilitar scripts adicionales. Se arrancaron desarrollo y producción en un puerto aislado y se verificaron HTTP 200 para página, participación demo y síntesis local, carga de Whisper y transcripción de una frase española generada. Se detuvieron los servidores temporales; el servidor original del proyecto no se reinició ni modificó. Esto verifica la instalación y los contratos de configuración; en esta auditoría no se repitió la autenticación real de Azure/ElevenLabs ni una prueba humana de micrófono. La autenticación en servicios externos debe comprobarse con credenciales propias.

`GET /api/tutor` y `GET /api/speech` identifican el modo seleccionado, no prueban conectividad ni autenticación; en particular, el GET del tutor puede indicar modo local ante una configuración Azure inválida aunque la participación POST muestre su error. No presentar la etiqueta «conectado» como una prueba de acceso real al modelo. `GET /api/transcribe` sí carga Whisper para comprobar su disponibilidad.

```sh
npm run typecheck
node --import tsx --test lib/tutor.test.ts
npm run build
```

Las pruebas cubren contenido base y contratos, multicloud/alcance local, tablas, diagramas, fórmulas, eventos NDJSON, corrección de salida, memoria compacta, WAV, silencio, cancelación de grabación, pronunciación, selección/errores de ElevenLabs y entrega incremental de audio. Las pruebas unitarias de proveedores usan respuestas simuladas; no equivalen a una llamada real en cada ejecución.

También se realizaron pruebas reales de Azure y ElevenLabs y revisión de navegador: saludo, explicaciones, streaming, creación de diagramas y simulaciones, transiciones entre tipos sin avisos de React, revelado, avatar hablando/reposo y detención al activar micrófono. Se verificó transcripción local con audio de prueba y acceso al micrófono; no asumir validación exhaustiva con múltiples hablantes, acentos, dispositivos o navegadores.

En una medición puntual del streaming se recibieron primeros bytes en unos 0,37 s y el audio completo en unos 3,15 s. Es una observación histórica, no un SLA ni una garantía del tiempo total hasta que el alumno escucha una respuesta (que también incluye Azure, red y navegador).

Las capturas de evidencia de esas verificaciones se eliminaron en la limpieza del 16/11/2026 a pedido del usuario; no hay evidencia gráfica en el repositorio. Verificar la aplicación actual antes de afirmar un comportamiento.

## 9. Límites y siguientes pasos posibles

La POC funciona localmente y demuestra la interacción; no consta despliegue público. No hay autenticación, multiusuario, persistencia servidor, analítica docente ni control de consumo por usuario. Los servicios externos tienen costos y límites. No hay ejecución de código generado, slides exportables, animaciones arbitrarias generadas por IA ni sincronización labial por fonemas.

La validación estructural no garantiza corrección conceptual del contenido generado ni fidelidad del modelo numérico. La clasificación de alcance depende del LLM y no constituye una barrera infalible. Las tres preguntas básicas y el progreso local no demuestran dominio del curso. No se ha realizado una validación educativa formal con estudiantes.

Posibles trabajos futuros, sujetos a solicitud: revisión docente de respuestas y supuestos; pruebas con estudiantes sobre comprensión y ritmo; evaluación de interrupciones, ruido y acentos; medición de latencia y consumo; mejor sincronización oral/visual; compatibilidad entre navegadores; y endurecimiento para uso compartido. No tratarlos como funciones ya aprobadas o implementadas.

## 10. Criterios para continuar el trabajo

- Mantener el alcance curricular reducido y la libertad de preguntar sobre cloud afín.
- Preservar la clase guiada con intervención vigente, no reintroducir un chat acumulativo por defecto.
- Conservar saludo oral/textual, participación por texto/voz y la capacidad de interrumpir.
- Elegir representaciones según la petición; no reducir diagramas o simulaciones a listas de bullets. Preferir encargos ricos para lo visual y mantener el aislamiento del iframe (sin `allow-same-origin`, CSP sin red).
- Mantener supuestos visibles y límites de simulaciones declarativas.
- Conservar la voz del usuario configurada y el reposo del avatar fuera de la reproducción.
- Mantener contraste, revelado de 1,25 s y preferencias de movimiento reducido salvo nueva decisión del usuario.
- Diferenciar lo comprobado por pruebas, lo observado en navegador y la revisión pedagógica pendiente.
- Leer el código propietario antes de modificarlo; este documento registra el estado y puede quedar desactualizado.
- Preservar el bloque de instrucciones Next.js que aparece a continuación.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
