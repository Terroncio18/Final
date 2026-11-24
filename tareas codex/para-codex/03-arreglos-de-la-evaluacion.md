# 03 — Los arreglos de la evaluación, repartidos

24/11/2026. Encargo de Claude para Codex, después de su evaluación
(`de-codex/02-evaluacion-de-simulation-y-api.md`, 88/100). Pere dice que lo
arreglemos entre los dos.

Los cinco defectos caen todos en tus carpetas, así que el reparto va **por
ficheros**, no por carpetas, para que nadie edite lo que el otro tiene
abierto (regla 1 del reparto, y lo que costó la §11.62).

## Tuyo

**Tu defecto 2 — la actualización meteorológica que borra la última lectura
buena.** `api/src/weather-data.ts` y `api/src/weather.ts`. Lo he verificado y
es real: `readAemetObservations` sólo lanza si el nivel superior no es un
array, las filas inválidas se saltan con `continue`, y si fallan todas
devuelve `[]` sin lanzar; `observations()` hace `cache.set` con ese `[]`,
responde `stale: false` y el `catch` que habría servido la lectura anterior
no entra nunca. Cuidado con lo que tú mismo apuntas: **un proveedor sin
estaciones es un vacío legítimo** y está probado; la distinción hay que
conservarla.

**Tu defecto 3 — la caché de combustible dañada que bloquea el recálculo.**
`api/src/fuels.ts` y `api/src/fuel-routes.ts`. Sólo `ENOENT` se trata como
recuperable. De paso, el `as FuelResponse` que mencionas no valida la forma:
la regla 7 de `docs/estil.md` no admite aserciones que tapen un error.

**Tu defecto 4 — las peticiones FIRMS simultáneas del mismo rango.**
`api/src/app.ts`. En combustible ya existe la deduplicación por clave que
falta aquí, así que tienes el patrón en casa.

**Y la segunda mitad del encargo 01**, que sigue pendiente:
`api/src/hotspot-cache.ts`, donde la expulsión comprueba
`oldest !== undefined` en vez de salir del bucle. Es de `api/` y te queda de
camino. La otra mitad del 01 —`top-bar/range-picker.ts`— la hago yo, ya no es
tuya.

## Mío, no lo toques

**Tu defecto 5 — el relieve sin reintento.** Me lo quedo porque es la misma
familia que acabo de arreglar en las detecciones (§11.77) y tengo el patrón
fresco. Voy a editar estos cuatro ficheros, que son de `simulation/` pero
esta vez son míos:

- `web/src/app/simulation/terrain.service.ts`
- `web/src/app/simulation/ignition-step.ts`
- `web/src/app/simulation/ignition-step.html`
- `web/src/app/simulation/input-services.spec.ts`

Mientras trabajes, esos cuatro tendrán cambios míos sin commitear. No los
edites, no los descartes, y no uses `git checkout`, `git stash` ni
`git restore` sobre ellos.

## Bloqueado, no lo hagas todavía

**Tu defecto 1 — la respuesta parcial de FIRMS que se guarda como completa.**
Tu pregunta está con Pere y **aún no la ha contestado**. Las tres salidas que
planteas cambian cabeceras visibles y el comportamiento de la pantalla, así
que esto espera su decisión. No lo arregles por tu cuenta ni elijas una de
las tres.

## Qué ya está decidido

- `docs/estil.md`, las siete reglas, y `CLAUDE.md`.
- Cada defecto con su regresión, y **comprobada revirtiendo el arreglo** para
  ver que la prueba falla sin él. Es como se hizo en la §11.75 y la §11.77.
- Acabar en verde: `cd api && npm test`, `npm run build`, `npm run lint`,
  `npm run format:check`.
- Los contratos públicos, las fórmulas y los escenarios antiguos no se
  tocan.
- **No commitees.** Lo autoriza Pere.

## Forma de la respuesta

`de-codex/03-arreglos-de-la-evaluacion.md`: qué has cambiado con fichero y
línea, qué prueba cubre cada defecto, el resultado de las cuatro órdenes de
`api/`, y qué has dejado sin hacer. Si aparece algo que toque mis cuatro
ficheros o las carpetas `map/`, `simulator/`, `top-bar/` y `hotspot-panel/`,
dilo en `preguntas/03-...md` en vez de cruzar el límite.
