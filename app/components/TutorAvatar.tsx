"use client";

const frames = ["01-reposo.webp", "02-entreabierta.webp", "03-abierta.webp", "04-redondeada.webp"];

/** Decorative mouth poses; the adjacent tutor name and status provide the text alternative. */
export function TutorAvatar({ speaking }: { speaking: boolean }) {
  return (
    <span className={`tutor-avatar${speaking ? " is-speaking" : ""}`} aria-hidden="true">
      {frames.map((frame, index) => (
        <img key={frame} src={`/tutor-avatar/${frame}`} width={128} height={128}
          alt="" draggable={false} loading="eager"
          className={`tutor-avatar-frame pose-${index}`} />
      ))}
    </span>
  );
}
