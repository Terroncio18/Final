# 06 — Revisión cruzada del cambio de Claude en `web/`

24/11/2026. Revisión del diff sin editar `web/`. El cambio estaba sin commit al revisarlo.

## Hallazgos

1. **Falta la regresión del arreglo de `simulator-view`.** En `web/src/app/simulator/simulator-view.ts:765-769`, la lectura de `beds[1]` ya queda dentro del `try` y, si falta, lanza un error que llega al `catch` con restauración del plan y los vientos. El diff no añade ninguna prueba que suprima el modelo 1 y compruebe esa restauración o el error mostrado. El arreglo hace lo que pretende para ese caso; su regresión sigue sin demostrarlo. La llamada de `editPlan()` ahora captura y registra rechazos inesperados, pero eso tampoco se ejercita en una prueba nueva.
2. **La latitud añadida al doble meteorológico no está ejercitada.** `web/src/app/simulator/weather-panel.spec.ts:42-46` compara ahora las dos coordenadas, como el servicio real. La prueba existente cambia país y centro a `null`, pero nunca cambia solo la latitud con país y longitud constantes. Si se quita la nueva comparación de latitud, esa prueba sigue teniendo las mismas respuestas; falta el caso que verifique la corrección del doble.

## Resto del diff

- Los tres botones de reintento invocan el servicio adecuado. La nueva prueba de `form-components.spec.ts:188-217` comprueba los clics de región y provincia por número de llamadas y el de municipio por provincia solicitada. Demuestra que los controles llaman a `load`; usa dobles y no comprueba una recuperación real de red. El servicio municipal ya olvida una lectura fallida.
- `model-edges.spec.ts:42-48` fija cuatro límites calculados a mano, por lo que `domainRing()` ya no puede servir como única expectativa de `domainAround()`. `fire-spotting.spec.ts:59-65` fija la semilla y la celda de destino antes de comprobar la propagación: un cambio coherente en la búsqueda y en el vuelo ya rompe la prueba. Las 10 pruebas de estos dos archivos pasaron con `vitest run`.
- Las exclusiones de cobertura retiran los dos nombres obsoletos de ambos archivos de configuración. Los comentarios cambiados en los servicios describen el nuevo reintento. No observé otro cambio de comportamiento en esos fragmentos.

No se han ejecutado las puertas completas de `web/` durante esta revisión.
