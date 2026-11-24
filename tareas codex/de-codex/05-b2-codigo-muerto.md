# B2 — Código muerto, estado del 24/11/2026

## Resultado, por importancia

1. **El caso señalado en el encargo ya está resuelto.** `web/src/app/simulation/fire-appearance.ts` y `fire-appearance.spec.ts` no existen en el árbol actual: **0 bytes actuales**. También se retiró `fire-field.ts`. La decisión consta en `docs/bitacola/fase-2/11.66-fora-el-punt-de-carrega-antic-i-els-pintors-que-no-es-feien-servir.md:16-19`, y 12.15 figura cerrada en `docs/bitacola/fase-2/12-decisions-pendents.md:202`. `docs/ajuda-foc-codex.md:10-18`, `docs/inventari-web.md:9` y las inclusiones explícitas de cobertura `web/angular.json:84` y `web/vitest.config.ts:14` conservan referencias históricas u obsoletas; no hacen que esos módulos existan ni añaden bytes al paquete. Conviene corregir esas referencias en una futura edición documental/configuración, sin reabrir el borrado.
2. **Exports sin consumidor externo de producción, pero con implementación viva: coste de código muerto, 0 bytes.** `web/src/app/simulation/point-locator.ts:31` exporta `shapeAt`; la usa la propia clase en las líneas 50 y 52 y las pruebas en `point-locator.spec.ts:2` e `input-services.spec.ts:9`. `api/src/fuels.ts:51` exporta `worldCoverTile`, usada en la línea 194 y en `api/tests/fuels.test.ts:12`. El modificador `export` podría sobrar, pero las funciones no. Los tipos exportados que se usan solo en su propio módulo (`web/src/app/map/hotspot.ts:1,8`, por ejemplo) desaparecen del JavaScript compilado; coste de ejecución **0 bytes**.

No he confirmado ningún módulo de producción íntegramente muerto, selector CSS propio sin uso, rama inalcanzable o dependencia de `package.json` que se pueda retirar con seguridad.

## Qué he comprobado y está bien

- Crucé imports estáticos y `import()` entre los `.ts` de producción de `web/src` y `api/src`. Los únicos archivos sin entrada desde otro módulo de producción son los cinco auxiliares de `web/src/testing` (**2.962 bytes de fuente en total**, usados por specs) y `api/src/fuel-raster.ts` (**7.017 bytes de fuente**, usado por `api/scripts/prepare-fuels.mjs:15`). No son código muerto de la aplicación.
- Ejecuté TypeScript con `--noEmit --noUnusedLocals --noUnusedParameters` para `web/tsconfig.app.json` y `api/tsconfig.json`: ambos terminaron sin diagnósticos. Esto cubre locales y parámetros que el compilador puede detectar; no demuestra que cada rama sea alcanzable.
- Crucé los selectores de clase CSS con nombres presentes en HTML y TS. Las únicas clases sin referencia textual propia son `.maplibregl-*` en `web/src/styles.css:82-107`, generadas por MapLibre. Los estilos de componentes Angular se enlazan mediante `styleUrl`.
- Comprobé las dependencias de ejecución y preparación: `geotiff` se importa en `api/src/fuels.ts:5` y en el preparador; `proj4`, `fflate` y `shapefile` se usan en el flujo fuera de línea (`api/src/fuel-raster.ts:3`, `api/scripts/prepare-fuels.mjs:12-14`, `api/scripts/prepare-official-fuels.mjs:10`). En web, `@angular/compiler` aparece en `web/src/app/simulation/input-services.spec.ts:3`, y `maplibre-contour`, `three` y `rxjs` tienen imports de producción. Las dependencias de Angular y `tslib` pueden ser requeridas por compilación/transitividad aunque no haya import textual directo.

## No evaluado / límite del método

- No medí el tamaño de paquetes compilados ni analicé alcance de cada rama con instrumentación. Los pesos anteriores son bytes de **fuente**, no ahorro de bundle.
- La búsqueda de selectores no puede probar usos dinámicos producidos por bibliotecas o por concatenación; por eso no declaro ninguno muerto.
- No ejecuté borrados de prueba, mutaciones, ni las suites: este encargo es de solo lectura sobre código y las otras tareas trabajan en paralelo.
