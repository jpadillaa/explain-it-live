import { BookOpen, Cloud, Cpu, Zap, type LucideProps } from "lucide-react";
import { lesson } from "@/lib/course";

const icons = { cloud: Cloud, cpu: Cpu, zap: Zap, book: BookOpen } as const;

/** Icono elegido en el front matter de la lección (campo «icono»). */
export function LessonIcon(props: LucideProps) {
  const Icon = icons[lesson.icono];
  return <Icon {...props} />;
}
