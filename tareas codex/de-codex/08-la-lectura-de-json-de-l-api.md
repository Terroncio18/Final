# 08 — Lectura de JSON de `api/`

## Cambios

- `api/src/read-json.ts:1-15`: añadí `readJson<T>(url: string, source: string, init?: RequestInit): Promise<T>`. Es `async`, lanza con `"${source}: ${status}"` si HTTP no es `ok` y devuelve el JSON parseado. `source` mantiene los mensajes de AEMET e IPMA; `init` permite enviar el header `api_key` de AEMET sin una variante especial de la función. El comentario dice expresamente que la aserción genérica no valida el JSON y que los llamadores deben comprobar los datos externos.
- `api/src/read-json.ts:1-9`: añadí `fetchChecked()` para compartir la comprobación HTTP con las respuestas que se leen como texto. Recibe una función para construir el mensaje, ya que FIRMS usa `FIRMS answered ...` y una de sus rutas añade `for ${source}`.
- `api/src/weather.ts:34-56`: las tres lecturas JSON (puntero de AEMET, estaciones y observaciones de IPMA) usan `readJson<JsonValue>` y siguen pasando por sus validadores existentes. La segunda respuesta de AEMET usa `fetchChecked()` y conserva su decodificación ISO-8859-15.
- `api/src/firms.ts:127-133,241-243`: las dos respuestas CSV usan `fetchChecked()` y conservan `parseCsv()` y sus mensajes de error exactos.
- `api/tests/read-json.test.ts:1-36`: siete pruebas nuevas comprueban el header de AEMET, el valor JSON y los seis formatos de error HTTP.

`readJson<T>` cubre tres de los seis puntos enumerados. Los otros tres no son lecturas JSON con `Response.json()`: dos son CSV de FIRMS y uno son bytes de AEMET que requieren ISO-8859-15. Su comprobación de estado sí queda unificada mediante `fetchChecked()`. Ningún mensaje de error se ha cambiado.

## Comprobaciones en `api/`

| Orden | Resultado |
| --- | --- |
| `npm test` | Verde: 13 archivos, 138 pruebas |
| `npm run build` | Verde |
| `npm run lint` | Verde |
| `npm run format:check` | Verde |

En este Windows ejecuté los scripts con `npm.cmd`, porque PowerShell bloquea `npm.ps1`. `git diff --check` también pasó. No he tocado `web/` ni he creado ningún commit.
