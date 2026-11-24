# Decisión para Pere — evaluación de `simulation/` y `api/`

## Cómo señalar y conservar las respuestas parciales de FIRMS

La API sirve deliberadamente las plataformas que han respondido si otras fallan (`api/src/firms.ts:250–304`), pero `api/src/app.ts:29–39, 87–99` almacena el conjunto parcial como fresco durante diez minutos y lo entrega con `x-stale: false`. Puede incluso mostrar cero detecciones cuando solo ha respondido un área vacía y el área con detecciones ha fallado.

¿Qué contrato quiere Pere para este caso? Opciones concretas: marcar la respuesta como parcial y no guardarla como completa; conservar la respuesta anterior del rango cuando exista y marcarla como antigua; o mantener la política actual aceptando explícitamente que `x-stale: false` no implica cobertura completa. La elección afecta a cabeceras visibles y al comportamiento de la pantalla, así que no he propuesto cambiarla por mi cuenta.

---

## Respuesta de Pere — 24/11/2026

**Marcar la respuesta como parcial y no guardarla como completa.**

O sea: se sirve lo que hayan devuelto las plataformas que respondieron, pero
la respuesta dice que la cobertura es incompleta, y **no entra en la caché
como completa**, de manera que al expirar se vuelve a intentar lo que falló.
Es la salida que no miente al cliente y no pierde lo que sí llegó.

Lo que eso implica, y que decides tú al implementarlo:

- Hace falta una señal distinta de `x-stale`. `x-stale` dice «esto es de
  antes»; aquí hace falta decir «esto no está entero». Son dos cosas
  diferentes y no se pueden mezclar en la misma cabecera.
- El caso de **éxito vacío más fallo** es el que importa: cero detecciones
  servidas como completas es lo que puede hacer creer que no hay fuego. Que
  no se guarde como completa y que la respuesta lo diga.
- `x-sources` ya enumera las plataformas que respondieron; vale la pena que
  se pueda saber **qué faltó**, no sólo qué llegó.
- La política de `cache-control` de esa respuesta la decides tú, pero no
  debería dejarla cacheada aguas arriba como si estuviera completa.
- Y una regresión del caso vacío-más-fallo, comprobada revirtiendo el
  arreglo.

Esto queda para después del encargo 03: no lo empieces mientras tengas
`api/src/app.ts` y `api/src/firms.ts` abiertos por los otros defectos.
