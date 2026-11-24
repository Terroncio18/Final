# B3 — Auditoría cruzada de pruebas del web

## Muestra

Elegí casos de **modelo y componentes que no escribí** y que ejercen límites, efectos asíncronos y dobles: `simulation/model-edges.spec.ts`, `fire-spotting.spec.ts`, `fuel-data.spec.ts`, `map/data-services.spec.ts`, `map/map-agents.spec.ts`, `form-components.spec.ts`, `simulator/weather-panel.spec.ts` y `simulator/simulator-view.spec.ts`. Leí las aserciones citadas, el código probado y los contratos de los dobles. Es una muestra dirigida de ocho archivos; no una estimación estadística de las 316 pruebas. No revisé las 124 pruebas de `api/`.

## Hallazgos, por importancia

1. **La prueba de geometría comparte el cálculo que debería contrastar.** `web/src/app/simulation/model-edges.spec.ts:41-48` obtiene `[w,s,e,n]` mediante `domainAround()` y usa esos cuatro valores para construir la expectativa de `domainRing()`. Si `domainAround()` reduce, amplía o desplaza el dominio de manera errónea y `domainRing()` sigue esos mismos límites, esta aserción pasa. Comprueba orden y cierre de los vértices, pero no tamaño ni ubicación independientes. `web/src/app/simulation/domain.ts:17-35` contiene ambos métodos. Prioridad media: otras pruebas pueden detectar consecuencias, pero este caso no detecta esa rotura.
2. **El escenario de brasa se elige con el mismo algoritmo que verifica.** `web/src/app/simulation/fire-spotting.spec.ts:14-18` busca un `seed` llamando a `emberFlight()` y `emberRandom()` y guarda el destino devuelto por `emberFlight()`. La prueba de integración de las líneas 58-68 exige que `spread()` encienda *ese* destino. Un cambio erróneo coherente de trayectoria o de la secuencia aleatoria podría cambiar la semilla y el destino y dejarla verde; sí detectaría pérdida total de ignición, falta de cruce del cortafuegos y pérdida de reproducibilidad. Prioridad media: falta al menos un destino o una semilla esperados de forma independiente del algoritmo.
3. **Un doble meteorológico acepta dominios que el servicio real rechaza.** `web/src/app/simulator/weather-panel.spec.ts:27-37` devuelve la observación para cualquier punto de ES con la misma longitud que `centre`, sin comparar latitud. El contrato real exige país, longitud **y latitud** (`web/src/app/simulator/weather.service.ts:38-44,90-95`). Las pruebas de `weather-panel.spec.ts:109-128` cambian país y usan centro nulo, pero no cambian solo latitud. Una regresión del panel que conserve la estación al desplazarse al norte/sur con igual longitud podría pasar aquí. Prioridad media; `web/src/app/map/data-services.spec.ts` sí prueba varios cambios de dominio del servicio real.
4. **Una aserción inicial aporta poco aislamiento.** `web/src/app/app.spec.ts:15` comprueba que `fixture.componentInstance` es verdadero tras crearlo. Pasaría aunque el componente dejase de montar casi toda la aplicación; las comprobaciones DOM siguientes en el mismo archivo sí añaden valor. Prioridad baja.

## Qué he comprobado y está bien

- El doble de detecciones de `web/src/app/form-components.spec.ts:110-121,152-164` **ya incluye `retry`**. La prueba de las líneas 317-333 abre el panel, pulsa los botones para error e incompletitud y comprueba dos llamadas. Esa rotura concreta de la §11.78 ya no queda oculta.
- `web/src/app/map/data-services.spec.ts:150-169,178-196` provoca un 503 en servicios reales y verifica que una segunda lectura ocurre y limpia `failed`; sus casos de municipios, lugares y meteorología también fuerzan respuestas tardías o errores. Estas aserciones fallarían con una promesa fallida retenida o una publicación tardía.
- `web/src/app/simulation/fuel-data.spec.ts:12-41` usa modelos y procedencias esperados explícitos y rechaza longitudes/códigos inválidos. No se limita a reproducir el decodificador.
- `web/src/app/map/map-agents.spec.ts:35-49` fuerza un fallo de importación y comprueba que la siguiente llamada importa de nuevo; el doble de mapa modela capas añadidas y retiradas.
- `web/src/app/simulator/simulator-view.spec.ts:110-155` declara un doble amplio de mapa; las pruebas inspeccionadas ejercen flujo, errores y limpieza, incluyendo orden de destrucción en las líneas 1153-1169. No encontré otro método ausente equivalente al antiguo `retry`.

## No evaluado

- No recorrí todas las pruebas ni calculé un porcentaje de aserciones débiles. No hice mutaciones de código ni ejecución de suites, por la condición de solo lectura y el trabajo paralelo. Los tres primeros hallazgos son análisis de sensibilidad de la prueba, no defectos demostrados en producción.
- La fidelidad de dobles no revisados fuera de la muestra, la interacción real con MapLibre/WebGL y la interfaz en navegador quedan sin evaluar.
