# 09 — Aviso de cobertura parcial de WorldCover

## Cambio

- `api/src/fuels.ts` distingue una lectura correcta cuyo GeoTIFF no alcanza todas las celdas solicitadas. Añade un aviso propio en catalán: «WorldCover N39E000: el ràster no cobreix tota la zona sol·licitada; les cel·les sense altra font queden desconegudes. Tornar-ho a provar no servirà.»
- El aviso de fuente inaccesible conserva su texto y el de «Cap conjunt de combustible oficial configurat» sigue siendo independiente. La detección usa la ventana real de píxeles y respeta las celdas ya cubiertas por un conjunto oficial.
- `unknownCells`, la decisión de no guardar respuestas incompletas y el `no-store` HTTP mantienen su comportamiento. No se ha editado `web/`.

## Regresión comprobada

La misma prueba de `api/tests/fuels-build.test.ts` comprueba una ventana recortada (4 celdas estimadas, 12 desconocidas y el aviso nuevo) y, a continuación, una fuente inaccesible (16 desconocidas y su aviso distinto). En ambos casos se comprueba que no se escribe caché. Las pruebas existentes mantienen el recuento de un único aviso cuando la cobertura es completa y comprueban `no-store` para huecos o avisos.

Comprobé que la regresión detecta cada caso al revertir temporalmente cada aviso por separado: sin el aviso parcial falló en la línea que esperaba dos avisos; tras restaurarlo, sin el aviso de fuente inaccesible falló en la segunda lectura. Restauré ambos y la prueba pasó.

## Verificación final en `api/`

| Orden | Resultado |
| --- | --- |
| `npm run format:check` | Verde |
| `npm run build` | Verde |
| `npm run lint` | Verde |
| `npm test` | Verde: 13 archivos y 137 pruebas |

En este entorno ejecuté `npm.cmd` para evitar la restricción de PowerShell sobre los scripts `.ps1`.
