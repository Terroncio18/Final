# 01 — Fecha de hoy y expulsión del caché

Encargo cerrado por la integración posterior de la §11.78 de la bitácora. No he vuelto a editar esos archivos: ambos arreglos y sus regresiones ya están en el repositorio.

- `web/src/app/top-bar/range-picker.ts`: `maxDay()` consulta `today()` al usarse; `problem()` y los dos `[max]` de `range-picker.html` lo leen. La prueba `takes the latest allowed day from the clock, not from when it was built` de `web/src/app/form-components.spec.ts` atraviesa la medianoche UTC con el mismo componente y comprueba que el día nuevo deja de rechazarse. La vista se actualiza en la siguiente detección de cambios; no hay un temporizador que fuerce una actualización justo a medianoche.
- `api/src/hotspot-cache.ts`: la expulsión sale del bucle si el iterador no entrega una clave, sin aserciones. La prueba `eviction stops if the map yields no oldest key` de `api/tests/hotspot-cache.test.ts` simula esa condición y falla si se intenta iterar otra vez.

La §11.78 documenta la comprobación al integrar esos arreglos: 434 pruebas y las ocho puertas de las dos mitades en verde, con las regresiones comprobadas revirtiendo cada arreglo. Es el resultado registrado entonces, no una ejecución nueva para esta respuesta. No hace falta una pregunta a Pere.
