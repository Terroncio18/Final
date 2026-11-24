# Arreglos de la evaluación — 24/11/2026

## Cambios y regresiones

| Encargo | Cambio | Regresión y comprobación sin el arreglo |
| --- | --- | --- |
| Defecto 2, actualización meteorológica | `api/src/weather-data.ts:114,190-191`: AEMET e IPMA rechazan una respuesta con datos pero sin ninguna observación válida. Así `weather.ts` conserva la última lectura y la marca `stale`. El array vacío de AEMET y un proveedor IPMA sin estaciones siguen siendo vacíos legítimos. | `api/tests/weather.test.ts:368,389,412`: lecturas previas de ES y PT sobreviven a actualizaciones con todas las filas inválidas; AEMET vacío sigue devolviendo `null`. Al retirar cada rechazo por separado, su prueba de actualización falló porque se perdió la lectura anterior. |
| Defecto 3, caché de combustible dañada | `api/src/fuels.ts:289-429,542`: valida forma, versión, dominio, tamaño, recuentos, rachas y metadatos del JSON descomprimido. Un gzip o JSON corrupto y una respuesta de forma inválida se tratan como fallo de caché derivada y permiten reconstruir desde las fuentes. Los errores de lectura del sistema de archivos distintos de `ENOENT` siguen propagándose. Ya no hay `as FuelResponse` en la lectura. | `api/tests/fuels-build.test.ts:181-207`: gzip inválido, JSON inválido, metadatos de forma incorrecta y rachas de longitud incorrecta se regeneran. Al hacer que la lectura dañada lanzara de nuevo, falló el caso gzip; al volver a aceptar el JSON sin validar, fallaron los dos casos de forma incorrecta. |
| Defecto 4, FIRMS simultáneo | `api/src/app.ts:28,36-51`: las peticiones del mismo rango comparten la promesa de `fetchHotspots`; al terminar se retira solo si sigue siendo la promesa de ese rango. | `api/tests/routes.test.ts:151-172`: dos peticiones en vuelo hacen una sola consulta y reciben la misma colección. Al desactivar temporalmente la consulta de la promesa compartida, la prueba vio dos consultas y falló. |
| Encargo 01, expulsión de caché FIRMS | `api/src/hotspot-cache.ts:28-31`: el bucle sale si el iterador no entrega una clave. | `api/tests/hotspot-cache.test.ts:49-63`: simula un iterador sin clave; al reponer temporalmente el condicional anterior, el bucle insistió y la prueba falló. |

Cada reversión se hizo temporalmente sobre el archivo de ese arreglo; se ejecutó su prueba dirigida, se observó el fallo indicado y se repuso el contenido antes de continuar. Las pruebas dirigidas volvieron a pasar con los arreglos.

## Comprobación final de `api/`

- `npm test`: verde, 11 archivos y 121 pruebas.
- `npm run build`: verde.
- `npm run lint`: verde.
- `npm run format:check`: verde.
- `git diff --check`: sin errores.

## Pendiente y límites

- Defecto 1, respuesta parcial de FIRMS: pendiente de la decisión de Pere; no se ha cambiado su política de caché, cabeceras ni presentación.
- Defecto 5 de relieve y la otra mitad del encargo 01 (`top-bar/range-picker.ts`): trabajo de Claude, sin intervención mía.
- No he editado los cuatro ficheros de `simulation/` reservados por Claude ni `map/`, `simulator/`, `top-bar/` o `hotspot-panel/`. Durante este trabajo aparecieron modificaciones ajenas en varios archivos de `web/`; no las he descartado ni incorporado al arreglo.
- Sin commit.
