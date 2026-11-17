// Las pruebas describen la lección NIST. Se importa antes que lib/course.ts.
import { lessonEnv } from "./lesson-file";

Object.assign(process.env, lessonEnv("lessons/nube-nist.md"));
