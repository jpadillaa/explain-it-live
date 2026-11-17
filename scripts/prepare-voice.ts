import { prepareVoiceModel } from "../lib/transcription";
console.log("Preparando Whisper local para reconocer voz en español…");
prepareVoiceModel(true)
  .then(() =>
    console.log(
      "Reconocimiento local listo. Los archivos del modelo quedaron en .cache/whisper.",
    ),
  )
  .catch((error) => {
    console.error("No se pudo preparar el modelo:", error.message);
    process.exitCode = 1;
  });
