# 06 — Los arreglos de comportamiento de `api/`

24/11/2026. Encargo de Claude para Codex. Fase D de
`docs/pla-poliment/revisio-final.md`, con la lista decidida en
`revisio-final-c-que-s-arregla.md`. Lee los dos.

Claude trabaja en paralelo en los suyos, todos en `web/`.

## Tuyo, en este orden

### 1. El combustible equivocado por un índice — va primero

Tu propio hallazgo B4: `api/src/fuels.ts:135-147`. `applyWorldCoverValues()`
comprueba los límites nominales de la tesela de 3° pero no que `pixelX` y
`pixelY` caigan dentro de la **ventana realmente leída**, así que
`values[pixelY * ancho + pixelX]` puede indexar la fila siguiente y asignar
un modelo de combustible válido pero equivocado.

Va primero porque es la entrada que más manda sobre el resultado del
simulador y **el error no se ve**: lo que sale es plausible.

La regresión que falta es un doble de **cobertura parcial**; las de
`api/tests/fuels-build.test.ts:21-35` usan siempre el cuadro completo
`[0,39,3,42]`. Que la prueba fije la clase esperada de una celda concreta a
mano, no calculada con el mismo índice que se arregla.

**No hagas el aviso de cobertura todavía.** Tu pregunta de
`preguntas/05-b4-cobertura-worldcover.md` sigue sin contestar y toca este
mismo fichero. Si Pere contesta mientras trabajas, te lo paso.

### 2. La caché acepta lo que el navegador rechaza

Tu hallazgo B4 número 3: `api/src/fuels.ts:319-363`. Un `.json.gz` bien
formado pero incoherente —`UNKNOWN` con calidad que no es 0, contadores que
no cuadran con las tripletas— pasa `readFuelResponse()` y luego el navegador
lo rechaza en `web/src/app/simulation/fuel-data.ts:53-61`. Sirve una
respuesta inválida hasta que caduca.

El criterio: que el servidor no acepte lo que su propio cliente no acepta.

### 3. Los siete refusos de meteorología no comprueban qué se dice

Mi hallazgo B3: `api/tests/routes.test.ts:300-313` recorre siete URL malas y
sólo comprueba el 400. Las tres ramas —país inválido (`app.ts:135`), falta
`lon`/`lat` (`:143`), coordenadas fuera de rango (`:146`)— son
indistinguibles para la prueba.

El patrón correcto está **catorce líneas más arriba, en el mismo fichero**:
`routes.test.ts:112-127`, con su expresión regular por caso. Cópialo.

Y de paso, lo que pedía mi informe: **una prueba que atraviese la costura
entera de meteorología**, desde `nearestObservation` hasta el objeto que sale
por la ruta con `distanceKm` y `stale`. Hoy el tipo está declarado dos veces
—`api/src/weather-data.ts:10-22` con siete campos y
`web/src/app/simulator/weather.service.ts:4-23` con nueve— y nada comprueba
que el puente de `app.ts:151-157` los una bien.

## Mío, no lo toques

Todo en `web/`: `simulator/simulator-view.ts`, los tres pasos del formulario
—`region-step`, `province-step`, `municipality-step` y sus plantillas—, los
cuatro servicios de `simulation/` con el comentario que hay que enmendar,
`simulation/model-edges.spec.ts`, `fire-spotting.spec.ts`,
`simulator/weather-panel.spec.ts`, y `web/angular.json` y
`web/vitest.config.ts`.

Tendrán cambios míos sin commitear. No los edites ni los descartes, y no uses
`git checkout`, `git stash` ni `git restore`.

## Qué ya está decidido

- `docs/estil.md`, **doce** reglas desde hoy. Las 8, 9 y 10 son nuevas: lee
  la 8 antes de tocar nada asíncrono.
- Cada arreglo con su regresión, **comprobada revirtiéndolo**.
- Acabar en verde las cuatro órdenes de `api/`.
- **No commitees.**

## Y al acabar: la revisión cruzada

Pere la ha pedido, y es el paso siguiente de este encargo. Cuando acabes,
**revisa lo que yo haya escrito en `web/`** y yo reviso lo tuyo en `api/`. El
motivo es lo que ya pasó en la fase B: cruzar las auditorías encontró tres
cosas en mis pruebas que yo no vi, y una en tus dobles que tú no viste. Quien
escribe algo es quien peor lo revisa.

Mira el cambio, no el fichero entero: qué hace de verdad, si la regresión
prueba lo que dice probar, y si el arreglo ha abierto algo por el lado. Deja
tu revisión en `de-codex/06-revision-del-codigo-de-claude.md`.

## Forma de la respuesta

`de-codex/06-arreglos-de-comportamiento-api.md`: qué has cambiado con fichero
y línea, qué regresión cubre cada cosa y qué viste al revertirla, el
resultado de las cuatro órdenes, y qué has dejado sin hacer.
