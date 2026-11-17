# Lecciones en Markdown

La aplicación carga **una** lección al arrancar. El archivo se elige en `.env`:

```dotenv
LESSON_FILE=lessons/nube-nist.md
# LESSON_FILE=lessons/arduino-electronica.md
```

La ruta es relativa a la raíz del proyecto. `next.config.ts` lee el archivo, lo valida
(`lib/lesson.ts`) y lo inyecta en el cliente y el servidor. **Tras cambiar de archivo o
editarlo, reinicia `npm run dev`.** Si la lección no es válida, el arranque falla con la
lista de campos a corregir. El contenido viaja en el bundle del navegador: no pongas secretos.

## Front matter (YAML)

| Campo | Uso |
| --- | --- |
| `id` | Identificador; también clave de `localStorage` para notas y progreso de esa lección. |
| `curso`, `leccion`, `descripcion` | Migas de pan, título del panel de progreso y metadatos de la página. |
| `marca` | Texto del logotipo (`marca / tutor`). |
| `profesor` | Nombre que aparece junto al avatar. |
| `etiqueta` | Rótulo en mayúsculas del panel de progreso (opcional; por defecto `curso`). |
| `icono` | `cloud`, `cpu`, `zap` o `book`. |
| `tema` | Dominio que el tutor usa para el alcance y los prompts («computación en la nube»). |
| `fuente` | `nombre` y `url` de la referencia (opcional). |
| `agenda` | Palabras cortas bajo la lámina inicial (opcional; por defecto los títulos de los ejes). |
| `acciones` | Hasta 3 participaciones sugeridas. |
| `pronunciacion` | Mapa `sigla: lectura` para la voz. Claves en minúsculas ignoran mayúsculas. |
| `alcance` | `afines` (temas admitidos), `criterios` (qué aceptar o rechazar) y `redireccion` (respuesta fuera de tema). |
| `objetivos` | Lista de `objetivo`, `pregunta`, `opciones` y `respuesta` (índice desde 0). |

## Cuerpo (Markdown)

```markdown
## Bienvenida
Saludo inicial, narrado al abrir la clase. Presenta la agenda y el primer concepto.

## Eje: Título del eje
Claves: palabras, que, dirigen, la demo local   ← opcional
Párrafo que aparece como cuerpo de la lámina.
- Viñetas de la lámina (máx. 5).

> Ejemplo [id_concepto, otro_id]: Ejemplo que usa la demo local al pedir «Dame un ejemplo».
> Cierre: Frase que la aplicación añade cuando se enseña el último concepto del eje.

### Título del concepto {#id_concepto}
Explicación del concepto. El {#id} es opcional (si falta se deriva del título).

## Resumen
Síntesis final de la clase.

## Tema afín: Nombre {#id}
Temas fuera del recorrido obligatorio que el estudiante puede explorar.

## Notas para el profesor
Indicaciones libres que se añaden al prompt del tutor (rigor, seguridad, simulaciones…).
```

Reglas: el primer concepto del primer eje se considera explicado por la bienvenida; los ids
de concepto son únicos (minúsculas, números y `_`); una lección admite hasta 8 ejes. Las
negritas, el código en línea y los enlaces se muestran como texto plano.
