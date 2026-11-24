# 04 — La respuesta parcial de FIRMS

24/11/2026. Encargo de Claude para Codex. Es tu defecto 1 de la evaluación
(`de-codex/02-...md`), el único que quedaba abierto, y **Pere ya ha
decidido**: su respuesta está bajo tu pregunta, en
`preguntas/02-evaluacion-de-simulation-y-api.md`.

## La decisión

**Marcar la respuesta como parcial y no guardarla como completa**, de manera
que lo que falló se vuelva a intentar. No es mantener la política de ahora ni
servir la anterior.

## El contrato, que fijo yo

Lo fijo porque hay dos lados y los hacemos a la vez: tú el servidor, yo la
pantalla. Si no acordamos los nombres antes, no se puede trabajar en
paralelo.

**`x-partial`**: `"true"` cuando alguna de las consultas de ese rango ha
fallado, y la cabecera **no se envía** cuando la cobertura es completa. No lo
metas dentro de `x-stale`: ese dice «esto es de antes», y éste dice «esto no
está entero». Son dos cosas que pueden pasar por separado y la pantalla las
cuenta distinto.

**`x-missing`**: qué faltó, en el mismo formato que ya usas para el aviso de
consola —`font/àmbit`, separado por comas—. `x-sources` sigue diciendo qué
respondió. Sin la cabecera cuando no falta nada.

Yo leeré las dos desde `web/src/app/map/hotspots.service.ts`. Si necesitas
cambiar un nombre, dilo en `preguntas/04-...md` **antes** de implementarlo, no
después.

## Lo que te toca decidir

Cómo se consigue que lo que falló se reintente. Lo que no vale es que una
respuesta parcial se sirva como completa durante los diez minutos del TTL,
que es el defecto. Lo que sí hay que evitar es el extremo opuesto: no
cachearla en absoluto haría que cada visita relance hasta 42 consultas aguas
arriba, que es el defecto 4 que acabas de arreglar por el otro lado.

Entre los dos extremos hay sitio —una vida más corta para las entradas
parciales, por ejemplo—, y la elección es tuya. Si te hace falta un valor
nuevo en `api/src/config.ts`, ponlo con nombre y comentario.

Dos cosas que no cambian: una respuesta parcial **sigue sirviendo** lo que
llegó, no se descarta; y si todo falla y hay entrada anterior, se sigue
sirviendo como `stale`, como ahora.

## La regresión que importa

**Éxito vacío más fallo.** Es el caso que hace creer que no hay fuego: un
área responde vacía, el área que tenía las detecciones falla, y hoy eso se
sirve como cero detecciones completas y frescas. Que la prueba cubra
exactamente eso, no sólo el parcial con datos.

Y la que va con la decisión: que una entrada parcial **no** se sirva como
completa y fresca durante el TTL entero.

## Dónde mirar

- `api/src/firms.ts` líneas 284-306: donde `failures.length` ya se conoce y
  hoy sólo se registra en consola.
- `api/src/app.ts` líneas 30-53 y 96-101: la caché, el `inFlight` que acabas
  de añadir, y las cabeceras.
- `api/src/config.ts` si hace falta el valor nuevo.
- `api/tests/firms-network.test.ts` y `api/tests/routes.test.ts`.

`HotspotAnswer` tendrá que llevar lo que falló, y `CachedHotspots` tendrá que
saber si la entrada es parcial.

## Qué ya está decidido

- `docs/estil.md`, las siete reglas; complejidad 15; ni `any` ni `unknown`,
  ni aserciones que tapen un error.
- Cada cosa con su regresión, **comprobada revirtiendo el arreglo**.
- Acabar en verde las cuatro órdenes de `api/`.
- **No commitees**, y no toques `web/`: la pantalla es mía en este encargo.
- No uses `git checkout`, `git stash` ni `git restore`.

## Forma de la respuesta

`de-codex/04-la-respuesta-parcial-de-firms.md`: qué has cambiado con fichero
y línea, qué mecanismo has elegido para el reintento y por qué, las dos
regresiones, y el resultado de las cuatro órdenes.
