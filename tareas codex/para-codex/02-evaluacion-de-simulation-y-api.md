# 02 — Evaluación de `simulation/` y `api/`

24/11/2026. Encargo de Claude para Codex. Pere pide una evaluación del
código y decide repartirla: Codex evalúa `web/src/app/simulation/` y `api/`,
Claude evalúa `map/`, `simulator/`, `top-bar/` y `hotspot-panel/`.

## Qué se pide

Una **evaluación crítica con nota**, comparable con las dos anteriores: la
primera dio 82,20/100 (§11.74) y la segunda 91/100 (§11.75). No es una
fase del plan de pulido: es una lectura con criterio sobre lo que ya está
hecho y verificado.

**Es una evaluación, no un arreglo.** Se lee y se informa; no se edita
código en este encargo. Así ninguno de los dos toca ficheros del otro
mientras el otro los está leyendo, y los arreglos se reparten después,
cuando Pere haya visto los dos informes y decida qué entra. La única
excepción es lo que ya está en marcha: el encargo `01` sí te pide editar
`top-bar/range-picker.ts` y `api/src/hotspot-cache.ts`, y sigue en pie.

## Estado de partida, verificado hoy

Pasadas las ocho puertas de las dos mitades, todas en verde:

- 420 pruebas: 147 del modelo, 161 de componentes del web, 112 de la API.
- `npm run build` en web y API.
- `npm run lint` y el formato en las dos mitades.
- Cero funciones de producción por encima de 80 líneas, medido con ESLint
  y la regla `max-lines-per-function` añadida a mano; la complejidad 15 de
  la regla 4 también pasa.

Esto significa que la evaluación **no va de que algo esté roto a la vista**.
Lo que se busca es lo que las suites verdes no cubren.

## Dónde mirar

- `web/src/app/simulation/`: el modelo —Rothermel, propagación, brasas,
  contramedidas, combustible— y los servicios de datos y los pasos del
  formulario que viven ahí.
- `api/`: ingesta de FIRMS, combustibles, puntos de agua, meteorología,
  los cachés y las rutas.
- Las pruebas que hay al lado de cada cosa: parte de la evaluación es si
  prueban comportamiento o sólo repiten la implementación.

## Qué ya está decidido

- `docs/estil.md`: las siete reglas. Complejidad máxima 15, ni `any` ni
  `unknown`, ni aserciones que tapen un error, comentarios excepcionales.
- `CLAUDE.md`: las órdenes de cada mitad y cómo se trabaja aquí.
- Las fórmulas, unidades, escenarios antiguos y contratos públicos del
  modelo no se discuten. Si la evaluación propone tocar resultados del
  modelo de propagación, eso es una decisión de Pere, no una corrección.
- La bitácora tiene el motivo de casi todo: `docs/bitacola/`. Antes de
  anotar algo como defecto, vale la pena mirar si ya se discutió y se
  decidió así a propósito.
- **No se commitea.** Lo autoriza Pere.

## Qué buscar, por si sirve de pista

Las dos revisiones anteriores encontraron la misma familia de defectos, y
vale la pena comprobar si queda algún caso vivo: **una lectura que falla y
se queda en la memoria caché o en un señalador, y no se vuelve a intentar
nunca**. La segunda pasada encontró seis instancias de eso, cuatro en
`simulation/` (`regions`, `provinces`, `search`, `municipalities`).

Más allá de eso, lo que interesa es lo que una suite verde no ve:
concurrencia y orden de llegada de respuestas, destrucción y recreación,
datos externos malformados que pasan la validación, límites numéricos del
modelo, y pruebas que pasarían igual con el comportamiento roto.

## Forma de la respuesta

`de-codex/02-evaluacion-de-simulation-y-api.md`:

1. **La nota**, con el criterio con el que la pones y por qué no es más alta.
2. **Los defectos**, uno por uno, con fichero y línea, qué pasa y en qué
   condiciones, y si ya hay prueba que lo cubra o no. Ordenados por
   gravedad.
3. **Lo que has mirado y está bien**, en corto: sirve para saber qué parte
   de la nota está respaldada por una lectura y qué parte no.
4. **Lo que no has podido evaluar** y por qué.

Si algo te bloquea o es una decisión de Pere y no tuya —tocar resultados del
modelo, cambiar un contrato público, o un defecto que está en mis
carpetas—, va a `preguntas/02-...md` y se lo paso yo.
