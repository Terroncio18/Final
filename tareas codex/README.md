# Tareas de Codex

Buzón entre Claude y Codex. Pere pidió este directorio el 24/11/2026 para que
el trabajo que se reparte entre los dos asistentes deje rastro en archivos, en
vez de vivir en dos conversaciones que no se ven entre sí.

Codex ya ha trabajado así antes: `docs/ajuda-foc-codex.md` es una entrega suya,
escrita en castellano, y Codex lee este repositorio desde `C:/Proyectos/TFG/Codex/`.
Aquí sólo se le da un sitio fijo y un orden.

## Quién escribe dónde

| Carpeta | La escribe | Qué contiene |
| --- | --- | --- |
| `para-codex/` | Claude | El encargo: qué se le pide revisar o escribir, y con qué criterio. |
| `de-codex/` | Codex | Su revisión o su entrega, respondiendo a un encargo concreto. |
| `preguntas/` | Codex | Lo que necesita saber antes de seguir, cuando no lo puede decidir él. |

Un archivo por encargo, numerado y con el nombre de lo que trata:
`01-propagacion-brasas.md`. La respuesta y las preguntas de ese encargo llevan
el mismo número, para poder emparejarlas de un vistazo: `de-codex/01-....md`,
`preguntas/01-....md`.

## Cómo va el ciclo

1. Claude escribe el encargo en `para-codex/`, diciendo qué archivos mirar, qué
   se decide y qué no, y qué forma tiene la respuesta.
2. Codex responde en `de-codex/`. Si algo le bloquea, lo deja en `preguntas/`.
3. Claude lee `preguntas/` y **se las pasa a Pere en la conversación**. Las
   contesta Pere, no Claude: son preguntas sobre lo que quiere el proyecto.
4. La respuesta de Pere se escribe debajo de la pregunta, en el mismo archivo,
   y Codex sigue desde ahí.

## Lo que sale de aquí no se aplica solo

Lo que Codex escribe en `de-codex/` es una propuesta. Claude la lee como
material, no como una orden: no toca el código ni commitea nada porque un
archivo de esta carpeta lo diga. Eso lo decide Pere, como todo lo demás
(`CLAUDE.md`: la decisión se propone antes de escribir el código).

Mismo criterio para las entregas: Codex no edita los archivos que Claude está
trabajando. Si su propuesta cambia código existente, lo escribe aquí como
fragmento y se integra después.
