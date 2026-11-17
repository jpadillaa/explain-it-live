import { useImperativeHandle, useState, type Ref } from "react";

const weights = [0.5, 0.8, 1, 0.65, 0.9, 0.75, 0.45];

export function MicrophoneLevel({ ref }: { ref: Ref<(rms: number) => void> }) {
  const [rms, setRms] = useState(0);
  useImperativeHandle(ref, () => setRms, []);
  const level = Math.min(1, rms * 12);
  return (
    <div className="microphone-level" aria-hidden="true">
      {weights.map((weight, index) => (
        <span
          key={index}
          style={{
            transform: `scaleY(${0.12 + level * weight * 0.88})`,
            opacity: 0.35 + level * weight * 0.65,
          }}
        />
      ))}
    </div>
  );
}
