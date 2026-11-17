import { prepareProfessorVoice, synthesizeProfessor } from "../lib/professor-voice";
console.log("Preparando la voz neuronal española del profesor…");
async function main() {
  await prepareProfessorVoice(true);
  await synthesizeProfessor("Hola. Hoy vamos a estudiar los fundamentos de la computación en la nube.");
  console.log("Voz del profesor lista en .cache/professor-voice.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
