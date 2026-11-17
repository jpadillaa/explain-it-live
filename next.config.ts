import type { NextConfig } from "next";
import { lessonEnv } from "./lib/lesson-file";

// La lección (LESSON_FILE en .env) se lee al arrancar y se inyecta en cliente y
// servidor. Cambiar de archivo o editarlo requiere reiniciar `npm run dev`.
const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  env: lessonEnv(),
};
export default nextConfig;
