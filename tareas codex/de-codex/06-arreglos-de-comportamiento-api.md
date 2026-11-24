# 06 — Arreglos de comportamiento de `api/`

24/11/2026. Sin commit. No se ha modificado `web/`.

## Cambios, en el orden encargado

1. **WorldCover parcial.** `api/src/fuels.ts:139-145` comprueba `pixelY` y `pixelX` contra la ventana realmente leída antes de indexar `values`. `api/tests/fuels-build.test.ts:93` usa una tesela recortada de dos columnas: la celda concreta de la primera fila al este del recorte debe ser `UNKNOWN`, aunque el índice plano anterior encontraba en ella la clase 20 de la fila siguiente y asignaba el modelo 5. La prueba falló antes del arreglo con `[5, 2, 2]` en vez de la tripleta desconocida y pasó después. También comprueba 12 celdas desconocidas.
2. **Caché de combustibles.** `api/src/fuels.ts:298-475` valida la pareja modelo/calidad de cada tripleta, sus longitudes y los totales derivados de procedencia, no combustible y modelos. Exige URL HTTPS en fuentes, como el decodificador del navegador. `api/tests/fuels-build.test.ts:227` introduce cinco entradas comprimidas válidas en forma pero incoherentes: `UNKNOWN` estimado, totales de procedencia, total no combustible, recuento por modelo y URL HTTP. Antes del arreglo fallaron los cinco casos porque se sirvió la entrada manipulada; después se reconstruyeron desde WorldCover. Se conserva el rechazo previo de gzip, JSON y estructura dañados.
3. **Meteorología.** `api/tests/routes.test.ts:299-317` comprueba el texto de las tres ramas de error en los siete rechazos, además del 400. `api/tests/weather-route.test.ts:38` atraviesa respuesta AEMET simulada → lectura y selección de estación → distancia y redondeo → respuesta de `/api/weather`; tras un fallo de actualización comprueba `stale: true` y todos los campos publicados. Para comprobar la regresión invertí temporalmente en `app.ts` el mensaje de país y los valores `distanceKm`/`stale`: fallaron ambas pruebas; restauré el código original y pasaron.

## Cuatro órdenes finales de `api/`

| Orden | Resultado |
| --- | --- |
| `npm test` | 12 archivos, 131 pruebas aprobadas |
| `npm run build` | Correcto |
| `npm run format:check` | Correcto |
| `npm run lint` | Correcto |

No se ha hecho el aviso de cobertura parcial del GeoTIFF: la decisión de Pere sigue pendiente. Tampoco se ha abordado la deduplicación de lectura JSON de la fase posterior.
