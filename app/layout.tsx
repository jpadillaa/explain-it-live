import type { Metadata } from "next";
import "./globals.css";
import { lesson } from "@/lib/course";
export const metadata: Metadata = {
  title: `${lesson.marca} · ${lesson.leccion}`,
  description: lesson.descripcion,
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // Extensiones como LanguageTool añaden atributos a <html> antes de hidratar.
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
