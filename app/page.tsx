"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Mic,
  Volume2,
  VolumeX,
  ChevronRight,
  Bookmark,
  Check,
  PanelRightClose,
  LoaderCircle,
  StickyNote,
  X,
  Square,
  Play,
} from "lucide-react";
import {
  contextSchema,
  initialContext,
  nextLessonStep,
  buildParticipationRequest,
  type Context,
  type TutorRequest,
} from "@/lib/tutor";
import { TutorAvatar } from "./components/TutorAvatar";
import { LessonWorkspace } from "./components/LessonWorkspace";
import { simulationDefaults } from "@/lib/artifacts";
import {
  readTutorResponse,
  stageLabels,
  type Stage,
  type TutorResult,
} from "@/lib/tutor-stream";
import { useNarration } from "./components/useNarration";
import { MicrophoneLevel } from "./components/MicrophoneLevel";
import { course, lesson } from "@/lib/course";
import { LessonIcon } from "./components/LessonIcon";
import {
  startVoiceCapture,
  type VoiceCapture,
  type VoicePhase,
} from "@/lib/voice";
// Cada lección guarda sus notas y su progreso por separado (id del front matter).
const storageKey = lesson.id;
export default function Home() {
  const [context, setContext] = useState<Context>(initialContext);
  const [explanation, setExplanation] = useState(course.welcome);
  const [lastParticipation, setLastParticipation] = useState("");
  const pendingParticipation = useRef<TutorRequest | null>(null);
  const [actions, setActions] = useState(course.actions);
  const [notes, setNotes] = useState("");
  const [panel, setPanel] = useState<"progress" | "notes" | null>("progress");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [artifactUpdate, setArtifactUpdate] = useState(0);
  const requestAbort = useRef<AbortController | null>(null);
  const [pendingArtifact, setPendingArtifact] = useState<
    NonNullable<TutorResult["artefactoPendiente"]> | null
  >(null);
  const [artifactError, setArtifactError] = useState("");
  const currentArtifact = useRef(initialContext.artefacto);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("");
  const [ready, setReady] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase | null>(null);
  const setVoiceLevel = useRef<((rms: number) => void) | null>(null);
  const listening = voicePhase === "recording";
  const voiceWorking = voicePhase !== null;
  const voiceAbort = useRef<AbortController | null>(null);
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [quiz, setQuiz] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const capture = useRef<VoiceCapture | null>(null);
  const lessonScroll = useRef<HTMLDivElement>(null);
  const greetingAttempted = useRef(false);
  const { enabled: voice, playback, speak, stop: stopSpeech, toggle: toggleVoice } =
    useNarration(cancelVoice, setVoiceError);
  const speaking = playback.phase === "playing";
  const preparingSpeech = playback.phase === "preparing";
  const narrationActive = playback.phase !== "idle";
  const sendLatest = useRef<(text: string) => void>(() => {});
  const lock = useRef(false);
  const continueLabel = nextLessonStep(context.clase) === null ? "Resumir la clase" : "Continuar clase";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        const checked = contextSchema.safeParse(saved.context);
        if (checked.success) {
          setContext({
            ...initialContext,
            completados: checked.data.completados,
          });
          setNotes(typeof saved.notes === "string" ? saved.notes : "");
        }
      }
    } catch {
      setError(
        "No pudimos recuperar la sesión guardada. Puedes empezar una nueva.",
      );
    }
    setReady(true);
    setCanListen(
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof window.MediaRecorder === "function" &&
        typeof window.AudioContext === "function" &&
        typeof window.OfflineAudioContext === "function",
    );
    setCanSpeak(typeof Audio === "function");
    fetch("/api/tutor")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => setMode("unknown"));
    return () => {
      requestAbort.current?.abort();
      voiceAbort.current?.abort();
      capture.current?.cancel();
    };
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            context: { ...initialContext, completados: context.completados },
            notes,
          }),
        );
      } catch {
        setError("No se pudo guardar la sesión en este navegador.");
      }
    }
  }, [context.completados, notes, ready]);
  useEffect(() => {
    lessonScroll.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [explanation]);
  useEffect(() => {
    if (!ready || !canSpeak || greetingAttempted.current) return;
    greetingAttempted.current = true;
    speak(course.welcome);
  }, [ready, canSpeak]);
  async function send(text = input, retry = false) {
    if (!text.trim() || lock.current) return;
    lock.current = true;
    // Una nueva participación cancela el diseño de un artefacto que aún no llegó.
    requestAbort.current?.abort();
    setPendingArtifact(null);
    setArtifactError("");
    stopSpeech();
    cancelVoice();
    setStages(["contexto"]);
    setBusy(true);
    setError("");
    setVoiceError("");
    setInput("");
    const participation =
      retry && pendingParticipation.current
        ? pendingParticipation.current
        : buildParticipationRequest(text, explanation, context);
    pendingParticipation.current = participation;
    setLastParticipation(participation.mensaje);
    const abort = new AbortController();
    requestAbort.current = abort;
    const current = () => requestAbort.current === abort;
    let narrated = false;
    try {
      const r = await fetch("/api/tutor", {
        signal: abort.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(participation),
      });
      await readTutorResponse(
        r,
        (stage) =>
          setStages((previous) =>
            previous.at(-1) === stage ? previous : [...previous, stage],
          ),
        {
          onResult: (reply) => {
            narrated = true;
            setMode(reply.mode);
            setExplanation(reply.mensaje);
            setLastParticipation("");
            pendingParticipation.current = null;
            setActions(reply.acciones);
            setContext((c) => ({ ...c, clase: reply.clase ?? c.clase }));
            if (reply.artefacto) applyArtifact(reply.artefacto);
            setPendingArtifact(reply.artefactoPendiente ?? null);
            speak(reply.mensaje);
            // La clase sigue: el estudiante puede intervenir mientras se diseña el artefacto.
            lock.current = false;
            setBusy(false);
          },
          onArtifact: (artifact) => {
            if (!current()) return;
            applyArtifact(artifact);
            setPendingArtifact(null);
          },
          onArtifactError: (message) => {
            if (!current()) return;
            setPendingArtifact(null);
            setArtifactError(message);
          },
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo conversar.";
      if (abort.signal.aborted) {
        // Cancelada por otra participación o al cerrar la página.
      } else if (narrated) {
        if (current()) {
          setPendingArtifact(null);
          setArtifactError(message);
        }
      } else setError(message);
    } finally {
      if (!narrated) {
        lock.current = false;
        setBusy(false);
      }
      if (current()) requestAbort.current = null;
    }
  }
  function applyArtifact(artifact: Context["artefacto"]) {
    if (JSON.stringify(artifact) !== JSON.stringify(currentArtifact.current))
      setArtifactUpdate((revision) => revision + 1);
    currentArtifact.current = artifact;
    setContext((c) => ({
      ...c,
      artefacto: artifact,
      slide: 0,
      valores:
        artifact.tipo === "simulacion" ? simulationDefaults(artifact) : {},
      nodo: artifact.tipo === "diagrama" ? artifact.nodos[0].id : null,
      estado: {},
    }));
    setArtifactVersion((version) => version + 1);
  }
  useEffect(() => {
    sendLatest.current = (text) => {
      void send(text);
    };
  });
  function cancelVoice() {
    voiceAbort.current?.abort();
    voiceAbort.current = null;
    capture.current?.cancel();
    capture.current = null;
    setVoicePhase(null);
    setVoiceLevel.current?.(0);
  }
  async function listen() {
    if (listening) {
      capture.current?.stop();
      return;
    }
    if (lock.current || voiceAbort.current) return;
    stopSpeech();
    setVoiceError("");
    const abort = new AbortController();
    voiceAbort.current = abort;
    setVoicePhase("permission");
    try {
      const recording = await startVoiceCapture({
        signal: abort.signal,
        onLevel: (rms) => {
          if (voiceAbort.current === abort) setVoiceLevel.current?.(rms);
        },
        onPhase: (phase) => {
          if (voiceAbort.current === abort) setVoicePhase(phase);
        },
        onTranscript: (text) => {
          if (voiceAbort.current !== abort) return;
          capture.current = null;
          voiceAbort.current = null;
          setVoicePhase(null);
          setInput(text);
          sendLatest.current(text);
        },
        onError: (message) => {
          if (voiceAbort.current !== abort) return;
          capture.current = null;
          voiceAbort.current = null;
          setVoicePhase(null);
          setVoiceError(message);
        },
      });
      if (voiceAbort.current === abort) capture.current = recording;
      else recording.cancel();
    } catch (error) {
      if (voiceAbort.current !== abort) return;
      voiceAbort.current = null;
      setVoicePhase(null);
      const name = error instanceof Error ? error.name : "";
      setVoiceError(
        name === "NotAllowedError"
          ? "Permite el micrófono en el navegador para participar por voz."
          : name === "NotFoundError"
            ? "No encuentro un micrófono. Conecta uno y vuelve a intentarlo."
            : "No se pudo iniciar la grabación. Comprueba el micrófono y vuelve a intentarlo.",
      );
    }
  }
  const patch = useCallback((values: Partial<Context>) => {
    setContext((c) => ({ ...c, ...values }));
  }, []);
  function saveNote(text: string) {
    setNotes((n) => `${n}${n ? "\n\n" : ""}${text}`);
    setPanel("notes");
  }
  function answer(index: number) {
    const correct = index === course.quizzes[quiz ?? 0].answer;
    setFeedback(
      correct
        ? "¡Correcto! Objetivo completado."
        : "Revisa el ejemplo e inténtalo de nuevo.",
    );
    if (correct && quiz !== null)
      patch({
        completados: Array.from(new Set([...context.completados, quiz])),
      });
  }
  const dismissArtifactError = useCallback(() => setArtifactError(""), []);
  const askFromWorkspace = useCallback((text: string) => sendLatest.current(text), []);
  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Inicio">
          <LessonIcon size={25} />
          <strong>
            {lesson.marca}<span> / tutor</span>
          </strong>
        </a>
        <div className="breadcrumb">
          {lesson.curso} <ChevronRight size={13} />
          <b>{lesson.leccion}</b>
        </div>
        <div className="session-mode">
          <i />
          {mode === "connected"
            ? "Tutor IA conectado"
            : mode === "local"
              ? "Demo local · respuestas guiadas"
              : "Conectando…"}
        </div>
      </header>
      <section className="teaching-panel" aria-label="Clase con el tutor">
        <div className="teaching-head">
          <TutorAvatar speaking={speaking && !busy && !voiceWorking && voice} />
          <div>
            <strong>{lesson.profesor}</strong>
            <small aria-live="polite">
              {voicePhase === "permission"
                ? "Activando el micrófono"
                : voicePhase === "transcribing"
                  ? "Transcribiendo tu intervención"
                  : listening
                    ? "Escuchando tu participación"
                    : busy
                      ? "Adaptando la clase"
                      : preparingSpeech
                        ? "Preparando la voz del profesor"
                        : speaking
                        ? "Explicando"
                        : "Tu turno para participar"}
            </small>
          </div>
          <button
            className={voice ? "icon active" : "icon"}
            aria-label={voice ? "Desactivar voz" : "Activar voz"}
            disabled={!canSpeak}
            onClick={() => toggleVoice(explanation)}
          >
            {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
        <div className="lesson-explanation" ref={lessonScroll}>
          <article
            className="current-explanation"
            aria-label="Explicación actual del profesor"
          >
            <p aria-live="polite">
              {speaking && playback.target === explanation
                ? playback.visible || "…"
                : explanation}
            </p>
            <div className="explanation-tools">
              <button
                onClick={() => saveNote(explanation)}
                title="Guardar explicación en notas"
              >
                <Bookmark size={14} /> Guardar idea
              </button>
              {canSpeak && voice && (
                <button
                  onClick={() => (narrationActive ? stopSpeech() : speak(explanation))}
                >
                  {speaking ? <Square size={13} /> : <Volume2 size={14} />}{" "}
                  {preparingSpeech ? "Preparando voz… · Cancelar" : narrationActive ? "Detener explicación" : "Escuchar explicación"}
                </button>
              )}
            </div>
          </article>
        </div>
        <div className="participation-area">
          {busy && (
            <div
              className="turn-progress"
              role="status"
              aria-label="Actividad del tutor"
            >
              <div className="message-label">EN CURSO</div>
              <ol>
                {stages.map((stage, index) => (
                  <li
                    key={`${stage}-${index}`}
                    className={
                      index === stages.length - 1 ? "current" : "complete"
                    }
                  >
                    {index === stages.length - 1 ? (
                      <LoaderCircle size={13} className="activity-spinner" />
                    ) : (
                      <Check size={13} />
                    )}
                    <span>{stageLabels[stage]}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {!busy && !error && (
            <button
              className="continue-lesson primary"
              onClick={() => send(continueLabel)}
            >
              <Play size={14} />{" "}{continueLabel}
              <ChevronRight size={14} />
            </button>
          )}
          {!busy && !error && (
            <div className="quick-actions">
              {actions.map((x) => (
                <button key={x} onClick={() => send(x)}>
                  {x}
                  <ChevronRight size={12} />
                </button>
              ))}
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
              {lastParticipation && (
                <button onClick={() => send(lastParticipation, true)}>
                  Reintentar
                </button>
              )}
            </div>
          )}
          {voiceWorking && (
            <div
              className={`voice-activity ${listening ? "is-recording" : ""}`}
              role="status"
            >
              {listening ? (
                <>
                  <div className="recording-copy">
                    <strong>
                      <span className="recording-dot" aria-hidden="true" />
                      Micrófono grabando
                    </strong>
                    <small>Habla. Una pausa enviará tu intervención.</small>
                  </div>
                  <MicrophoneLevel ref={setVoiceLevel} />
                </>
              ) : (
                <div className="recording-copy">
                  <strong>
                    <LoaderCircle size={13} className="activity-spinner" />
                    {voicePhase === "transcribing"
                      ? "Transcribiendo tu intervención"
                      : "Activando el micrófono"}
                  </strong>
                  <small>
                    {voicePhase === "transcribing"
                      ? "Grabación finalizada"
                      : "Esperando permiso del micrófono"}
                  </small>
                </div>
              )}
              <button
                onClick={cancelVoice}
                type="button"
                aria-label="Cancelar grabación"
              >
                Cancelar
              </button>
            </div>
          )}
          {voiceError && (
            <p role="status" className="error">
              {voiceError}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              aria-label="Tu participación"
              placeholder="Comparte una idea, responde o plantea una duda…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={3000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="composer-controls">
              <button
                type="button"
                className={`mic ${listening ? "listening" : ""}`}
                disabled={!canListen || busy || (voiceWorking && !listening)}
                onClick={listen}
                aria-label={listening ? "Terminar y enviar" : "Hablar"}
                aria-pressed={listening}
              >
                <Mic size={17} />
                <span>
                  {listening
                    ? "Terminar y enviar"
                    : voicePhase === "transcribing"
                      ? "Transcribiendo…"
                      : voicePhase === "permission"
                        ? "Activando…"
                        : "Hablar"}
                </span>
              </button>
              <button
                className="send"
                aria-label="Enviar participación"
                disabled={busy || (voiceWorking && !listening) || !input.trim()}
              >
                <ArrowUp size={19} />
              </button>
            </div>
          </form>
          <small className="input-hint">
            {canListen
              ? listening
                ? "Te escucho. Tu intervención se enviará al terminar la frase."
                : "Participa por voz o escribe para adaptar la siguiente explicación."
              : "El reconocimiento de voz requiere un navegador compatible."}
          </small>
        </div>
      </section>
      <LessonWorkspace context={context} disabled={busy || voiceWorking}
        artifactVersion={artifactVersion} artifactUpdate={artifactUpdate}
        patch={patch} onAsk={askFromWorkspace}
        pending={pendingArtifact} artifactError={artifactError}
        onDismissError={dismissArtifactError} />
      <aside className="rail">
        <button
          title="Progreso"
          aria-label="Abrir progreso"
          className={panel === "progress" ? "active" : ""}
          onClick={() => setPanel(panel === "progress" ? null : "progress")}
        >
          <span
            className="progress-ring"
            style={{
              background: `conic-gradient(#6c58cc ${(context.completados.length / 3) * 360}deg, #e9e5f5 0)`,
            }}
          >
            <b>{Math.round((context.completados.length / 3) * 100)}%</b>
          </span>
          <small>Progreso</small>
        </button>
        <button
          title="Notas"
          aria-label="Abrir notas"
          className={panel === "notes" ? "active" : ""}
          onClick={() => setPanel(panel === "notes" ? null : "notes")}
        >
          <StickyNote size={21} />
          <small>Notas</small>
        </button>
      </aside>
      {panel && (
        <aside className="detail-panel">
          <div className="panel-heading">
            <strong>
              {panel === "progress" ? "Tu recorrido" : "Notas de clase"}
            </strong>
            <button
              className="icon"
              aria-label="Cerrar panel"
              onClick={() => setPanel(null)}
            >
              <PanelRightClose size={17} />
            </button>
          </div>
          {panel === "progress" ? (
            <>
              <div className="course-label">
                {lesson.etiqueta ?? lesson.curso.toUpperCase()}
              </div>
              <h2>{lesson.leccion}</h2>
              <p className="panel-description">{lesson.descripcion}</p>
              <div className="current-topic-label">
                Recorrido · {course.slides[context.clase.paso].title}
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${(context.completados.length / course.objectives.length) * 100}%`,
                  }}
                />
              </div>
              <small>
                {context.completados.length} de {course.objectives.length} objetivos
                completados
              </small>
              <div className="objectives">
                {course.objectives.map((x, i) => (
                  <button
                    key={x}
                    onClick={() => {
                      setQuiz(i);
                      setFeedback("");
                    }}
                  >
                    <span
                      className={
                        context.completados.includes(i) ? "check done" : "check"
                      }
                    >
                      {context.completados.includes(i) ? (
                        <Check size={13} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <div>
                      <b>{x}</b>
                      <small>
                        {context.completados.includes(i)
                          ? "Completado"
                          : "Comprobar lo aprendido"}
                      </small>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <div className="tip">
                <span>✦</span>
                <p>
                  La curiosidad marca el camino. Puedes pedir un ejemplo,
                  cambiar los números o volver a una idea.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="panel-description">
                Guarda ideas del tutor o escribe con tus propias palabras.
              </p>
              <textarea
                className="notes"
                aria-label="Notas de clase"
                placeholder="Lo que quiero recordar…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <small>Guardado en este navegador</small>
            </>
          )}
        </aside>
      )}
      {quiz !== null && (
        <div className="modal-backdrop">
          <section
            className="quiz"
            role="dialog"
            aria-modal="true"
            aria-label="Comprobar lo aprendido"
          >
            <button
              className="modal-close icon"
              aria-label="Cerrar comprobación"
              onClick={() => setQuiz(null)}
            >
              <X size={18} />
            </button>
            <div className="eyebrow">COMPRUEBA LO APRENDIDO</div>
            <h2>{course.quizzes[quiz].question}</h2>
            {course.quizzes[quiz].choices.map((x, i) => (
              <button className="quiz-choice" key={x} onClick={() => answer(i)}>
                {x}
              </button>
            ))}
            {feedback && <p role="status">{feedback}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
