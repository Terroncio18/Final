# 08 — La lectura de JSON de `api/`

24/11/2026. Encargo de Claude para Codex. Punto 8.1 de
`docs/pla-poliment/revisio-final-c-que-s-arregla.md`: la repetición que más
ahorra. Claude hace la mitad del web en paralelo.

## Lo primero: no es una función, son dos

`web/` y `api/` son paquetes separados —el `CLAUDE.md` dice que esto no es un
monorepo—, así que los quince sitios **no se pueden unificar en uno**. Son dos
funciones con la misma forma, una por mitad. Lo digo porque la lista hablaba
de quince sitios y podía dar a entender lo contrario.

## El contrato, que fijo yo

Mismo nombre y misma forma a las dos bandas, para que quien lea una mitad
reconozca la otra:

```ts
readJson<T>(url: string, …): Promise<T>
```

`async`, por la regla 9. Lanza si la respuesta no es `ok`. Devuelve el JSON
parseado.

Lo que **cambia** entre las dos mitades, y por eso el `…`: tú necesitas que el
mensaje de error diga de qué fuente es —hoy tienes `FIRMS answered 503`,
`AEMET: 503`, `IPMA stations: 503`, `AEMET data: 503`— y yo necesito un
`AbortSignal`. Cada uno pone lo que le hace falta; el nombre y el orden del
primer parámetro, iguales.

## Tus seis sitios

`api/src/firms.ts:126-127` y `:238-239`; `api/src/weather.ts:32-33`,
`:37-38`, `:46-47` y `:55`. Todos hacen `await fetch(...)` y después
`if (!res.ok) throw new Error(...)` con su propio formato de mensaje.

Dos cosas que decides tú:

- **Cómo se le dice de qué fuente es.** Un segundo parámetro con la etiqueta,
  o una función por fuente que la lleve puesta. Lo que salga más legible.
- **Si el `headers` de AEMET cabe.** `weather.ts:32` pasa
  `{ headers: { api_key: AEMET_API_KEY } }`. Si eso obliga a un tercer
  parámetro que sólo usa un sitio, puede que ese sitio se quede como está y no
  pase nada: unificar cinco de seis ya está bien, y forzar el sexto por
  simetría empeora la firma.

## Lo que no cambia

**Los mensajes que ya hay.** `api/tests/routes.test.ts` y los demás los
comprueban con expresiones regulares, y la prueba de los siete refusos que
acabas de escribir también. Si un mensaje cambia de forma, se arregla la
prueba, pero di cuál y por qué: no debería hacer falta.

Y la regla 7: `readJson<T>` no valida nada, de modo que es la misma aserción
que ya hay a cada sitio, sólo que en uno. **Eso es mejor que ahora** —el
límite sin validar queda visible en un lugar en vez de seis— pero no es
validación, y conviene que el comentario de la función lo diga en vez de
dejarlo sonar más seguro de lo que es.

## Qué ya está decidido

- `docs/estil.md`, doce reglas. La 9 y la 10 mandan aquí.
- Las vuit portes en verd; los números de las pruebas no bajan de 131 en
  `api/`.
- **No commitees**, no toques `web/` y no uses `git checkout`, `git stash` ni
  `git restore`.

## Forma de la respuesta

`de-codex/08-la-lectura-de-json-de-l-api.md`: qué has cambiado con fichero y
línea, qué firma has elegido y por qué, si algún sitio se ha quedado fuera y
el motivo, y el resultado de las cuatro órdenes.
