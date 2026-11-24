# 04 — La respuesta parcial de FIRMS

24/11/2026.

## Cambios

- `api/src/firms.ts:44-48, 275-308`: `HotspotAnswer` lleva `missing`. Cada consulta fallida añade `fuente/ámbito` una sola vez, incluso cuando las consultas que sí responden traen cero detecciones. La respuesta conserva las detecciones y las fuentes que llegaron.
- `api/src/hotspot-cache.ts:3-8`: la entrada guardada conserva `missing`, así que nunca se interpreta una parcial como completa.
- `api/src/config.ts:31` y `api/src/app.ts:32-49`: una entrada parcial vive 60 segundos en la caché del servidor; una completa sigue viviendo 10 minutos. Al expirar se vuelve a consultar FIRMS. Las peticiones simultáneas siguen compartiendo `inFlight`. Si falla todo en el reintento, se sirve la entrada anterior como `stale`, conservando su condición de parcial.
- `api/src/app.ts:98-114`: la ruta envía `x-partial: true` y `x-missing` separados por comas cuando falta cobertura, y omite ambas cabeceras cuando está completa. `x-sources` sigue nombrando las fuentes que respondieron. `x-stale` permanece independiente. La caché HTTP de una parcial dura 30 segundos frente a los 300 de una completa, de modo que el cliente puede volver a consultar antes del siguiente reintento del servidor.

El minuto de retención evita repetir hasta 42 consultas en cada visita, pero reintenta una cobertura incompleta mucho antes del TTL completo. El reintento consulta de nuevo el rango; no reutiliza resultados individuales de FIRMS.

## Regresiones

- `api/tests/firms-network.test.ts:183-197`: un área responde con CSV válido y vacío mientras la península falla. Se comprueba cuerpo vacío, fuentes respondidas y las dos entradas `fuente/peninsula` en `missing`. Revertí temporalmente la propagación de `missing`: la prueba falló (`[]` frente a las dos áreas ausentes). Restauré el cambio.
- `api/tests/routes.test.ts:146-182`: la misma respuesta vacía se anuncia con `x-partial` y `x-missing`, se reutiliza antes de 60 segundos y se reintenta después; una respuesta completa posterior omite las dos cabeceras. Revertí temporalmente el TTL corto: la prueba falló porque solo hubo una llamada a FIRMS en vez de dos. Restauré el cambio.
- `api/tests/routes.test.ts:184-205`: si falla completamente ese reintento, la respuesta parcial anterior se sirve con `x-stale: true` y `x-partial: true`.

## Comprobación final desde `api/`

- `npm.cmd run build`: verde.
- `npm.cmd run lint`: verde.
- `npm.cmd run format:check`: verde.
- `npm.cmd test`: verde, 124 pruebas en 11 ficheros.

No he tocado `web/`, `map/`, `simulator/`, `top-bar/` ni `hotspot-panel/`. No he hecho ningún commit.
