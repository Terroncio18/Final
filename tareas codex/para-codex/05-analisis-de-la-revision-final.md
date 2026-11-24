# 05 — Tres análisis para la revisión final

24/11/2026. Encargo de Claude para Codex. Arranca la fase B de
`docs/pla-poliment/revisio-final.md`. Lee ese plan antes que esto: explica por
qué esta revisión mira cosas que las tres anteriores no miraron.

**Nada de esto edita código.** Son análisis de sólo lectura, los dos a la
vez, y por eso no hay reparto de ficheros ni riesgo de pisarnos. Lo que se
cambie se decidirá después, con los informes delante y con Pere.

La fase A ya está hecha: `docs/estil.md` tiene ahora **doce reglas**. Las 8,
9 y 10 son nuevas y **el código todavía no las cumple** —eso es precisamente
lo que hay que medir—.

## B2 — Código muerto, al día

Todo el proyecto. La fase 4 se hizo el 20/11 y desde entonces han pasado
cinco fases, tres revisiones y diez arreglos: lo que entonces estaba vivo
puede no estarlo.

Un caso ya conocido, y que **no es tuyo decidir**:
`web/src/app/simulation/fire-appearance.ts` y sus siete pruebas no tienen
importador —comprobado hoy—, y `docs/ajuda-foc-codex.md` dice que se
conservan a propósito como registro. Anótalo con lo que pesa y deja la
decisión a Pere.

Lo que interesa: exportaciones que nadie importa, ramas inalcanzables,
parámetros que nadie pasa, campos que nadie lee, `.css` sin selector usado,
y dependencias de `package.json` que ya no entran en ningún `import`.

## B3 — Si las pruebas prueban: las del web

**Las del web, no las tuyas.** Cruzamos las auditorías a propósito: yo
audito las 124 de `api/` y tú las del web —148 del modelo y 168 de
componentes—. Nadie revisa las que ha escrito.

No hace falta recorrer las 316: coge una muestra y di cómo la has elegido.
Por cada una, la pregunta es **¿pasaría igual con el comportamiento roto?**
Lo que se busca:

- Pruebas que repiten la implementación en vez de comprobar comportamiento.
- Aserciones que no pueden fallar: un `expect` sobre algo que el propio test
  acaba de fijar.
- **Dobles que mienten.** Esto ya nos ha pasado hoy: el doble del servicio de
  detecciones no tenía `retry`, así que el botón de la §11.78 no lo pulsaba
  ninguna prueba y nadie se enteró, porque un `click` sobre un método que no
  existe sólo falla cuando se pulsa. ¿Cuántos dobles más se han quedado
  atrás de la clase que imitan?
- Caminos de error que ninguna prueba recorre.

## B4 — Lo que nadie ha leído a fondo, en `api/`

`api/src/fuels.ts` —557 líneas, el fichero más grande del proyecto— y
`api/src/fuel-raster.ts` (213). Las tres revisiones los han tocado por
encima: la de hoy sólo mirando la caché dañada.

Léelos enteros. Lo que interesa es lo que una suite verde no ve: límites
numéricos, qué pasa con un ráster que no cubre la caja pedida, aritmética de
coordenadas y redondeos, y si lo que el fichero promete en su contrato es lo
que hace.

## Qué ya está decidido

- `docs/estil.md`, las doce reglas, y `CLAUDE.md`.
- Las fórmulas, unidades y escenarios del modelo no se discuten.
- La bitàcola tiene el motivo de casi todo: antes de anotar algo como
  defecto, mira si ya se decidió así a propósito.
- **No se edita código en este encargo**, ni se commitea.
- No uses `git checkout`, `git stash` ni `git restore`.

## Forma de la respuesta

Tres ficheros, uno por análisis, en `de-codex/`:
`05-b2-codigo-muerto.md`, `05-b3-pruebas-del-web.md`,
`05-b4-fuels-y-raster.md`.

En cada uno: lo encontrado con fichero y línea, **ordenado por lo que más
importa**, qué has mirado y está bien, y qué no has podido evaluar. En B2,
además, lo que pesa cada cosa muerta. En B3, cómo elegiste la muestra.

Si algo es decisión de Pere —borrar algo que se conserva a propósito, cambiar
un contrato público— va a `preguntas/05-...md` y se lo paso yo.
