# 01 — La fecha de hoy y la expulsión del caché

24/11/2026. Encargo de Claude para Codex. Primer encargo de este buzón: dos
cosas pequeñas, a propósito, para probar el ciclo antes de repartir nada
grande.

## Qué se pide

Las dos observaciones que la segunda revisión de calidad dejó anotadas y sin
corregir (bitácora §11.75, último párrafo). Siguen las dos en el código,
comprobado hoy. Son de tu mitad del reparto: `top-bar/` y `api/`.

### A. El calendario se queda en el día de ayer

`web/src/app/top-bar/range-picker.ts:38`

```ts
protected readonly today = today();
```

`today()` —`web/src/app/map/hotspot-range.ts:14`— devuelve
`new Date().toISOString().slice(0, 10)`, o sea la fecha **en UTC**. Aquí se
evalúa una sola vez, al construir el componente, y el valor se usa en dos
sitios: la validación de `problem()` (línea 47, `if (to > this.today)`) y el
`[max]` de los dos campos de fecha de la plantilla (`range-picker.html:46`
y `:56`).

Con el componente vivo al pasar la medianoche UTC, las dos cosas se quedan
en la fecha anterior: el calendario no deja llegar a hoy y, si se escribe la
fecha a mano, la validación dice «No hi ha deteccions de dates futures» para
un día que ya existe. No se arregla hasta que se recarga la página.

**Una advertencia, para que no se pierda tiempo:** envolverlo en un
`computed()` no lo arregla. `today()` no lee ninguna señal, así que un
`computed` sin dependencias se calcula una vez y no se vuelve a calcular
nunca. Hace falta que el valor se lea de nuevo en el momento de usarlo, o que
algo lo invalide.

### B. La expulsión del caché podría no acabar nunca

`api/src/hotspot-cache.ts:28-31`

```ts
while (this.stored.size > this.limit) {
  const oldest = this.stored.keys().next().value;
  if (oldest !== undefined) this.stored.delete(oldest);
}
```

Si `oldest` fuera `undefined`, la iteración no borra nada y la condición del
`while` no cambia: bucle infinito. **Hoy es inalcanzable**, porque
`size > limit >= 1` garantiza que el mapa no está vacío y la clave existe
siempre. El `!== undefined` está ahí porque `Map.keys().next().value` tiene
tipo `string | undefined`, no porque el caso pueda darse.

Lo que no vale: quitar la comprobación con una aserción (`as string`). La
regla 7 de `docs/estil.md` no admite aserciones que tapen un error. Lo que se
busca es que el caso imposible **salga del bucle** en vez de girar en vacío.

## Dónde mirar

- `web/src/app/top-bar/range-picker.ts` y `range-picker.html`, con
  `web/src/app/map/hotspot-range.ts` como origen de `today()`.
- `api/src/hotspot-cache.ts`.
- Las pruebas que ya haya al lado de los dos: tienen que seguir pasando.

## Qué ya está decidido

- `docs/estil.md`, regla 7: ni `any` ni `unknown`, ni aserciones que oculten
  un error. Regla 4: complejidad máxima 15.
- Regla 5: comentarios sólo para lo que no se deduce del código; las
  plantillas `.html` no llevan comentarios.
- El reparto por carpetas de `docs/pla-poliment/README.md`: `top-bar/` y
  `api/` son tuyas en este encargo, y no se tocan `map/`, `simulator/` ni
  `simulation/`.
- Cada defecto reproducido lleva su regresión, y se comprueba revirtiendo el
  arreglo que la prueba falla sin él. Es como se hicieron los seis de la
  §11.75.
- **No se commitea.** Lo autoriza Pere, no nosotros.

## Qué queda abierto

Cómo se arregla cada uno es tuyo: en A, si el valor se lee al usarlo, si se
invalida con algo, o si el `max` del calendario y la validación se resuelven
por caminos distintos. En B, la forma de salir del bucle.

Lo que **no** decidas tú: si al mirarlo te parece que A pide cambiar
`today()` en `hotspot-range.ts` —que está en `map/`, fuera de tu reparto— o
que el arreglo cambia lo que el usuario ve más allá de corregir el día, eso
va a `preguntas/01-...md` y lo contesta Pere. Las preguntas se las paso yo.

## Forma de la respuesta

`de-codex/01-la-fecha-de-hoy-y-la-expulsion-del-cache.md`: qué has cambiado,
fichero y línea, qué prueba nueva cubre cada uno, y el resultado de las dos
suites y de los linters. Los ficheros los puedes editar directamente, que son
de tu reparto y ahora mismo no los tengo abiertos; si algo te lleva fuera de
`top-bar/` o `api/`, déjalo como fragmento y dilo.
