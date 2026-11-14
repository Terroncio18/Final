# Presentación Firecast sobre la simulación de Pere

14/11/2026. Referencia inspeccionada y ejecutada: `Codex/incendios/firecast/dist/terrain.js` y `model.js`.

## Implementado

- Superficie del fuego calculada en GPU: carbón, brasas, resplandor estrecho, frente caliente y ruido animado. Se interpola el tiempo de llegada antes de asignar el color, lo que permite un avance continuo entre celdas.
- La textura de 2048 × 2048 cubre solamente el rectángulo alcanzable del incendio, con margen. Esto mejora la nitidez de líneas y detalle sin cambiar la malla de cálculo de 30 m.
- Previsión acumulada a +30, +60 y +90 minutos respecto al cursor temporal, con bandas rojas, naranjas y amarillas, las dos primeras con línea discontinua. Se excluye lo ya quemado. Todas proceden del mismo campo de llegada que las métricas.
- Llamas repartidas a lo largo del contorno interpolado, en lugar de agruparse en los centros de unas pocas celdas recientes. Los ciclos, ruido, tamaños, ascenso, inclinación y deriva recuperan los parámetros visuales del prototipo. El humo conserva su punto de nacimiento y deriva con el viento.
- Anclaje de partículas al terreno renderizado, incluida la vista plana, sin el gran desplazamiento de profundidad que hacía que algunas llamas pareciesen separadas del suelo.
- Corrección de la caché del terreno 3D de MapLibre 6.15: subir el canvas con `play()`/`pause()` no invalidaba la textura que el relieve reutilizaba. Cada actualización publica ahora una revisión de contenido mediante `setCoordinates()`. Se verificó que ocultar las previsiones elimina realmente las bandas del terreno sin mover la cámara.
- Control de previsiones en «Capes del mapa», leyenda y superficies previstas en «Anàlisi». Botón «Veure el foc i la previsió» para encuadrar el conjunto.
- Pausar el avance conserva la animación ambiental. Retroceder o saltar en la línea temporal reinicia las partículas para evitar humo del momento anterior. Se respeta movimiento reducido y se suspende la animación continua en pestañas ocultas.

## Mecánicas conservadas

Este cambio no modifica Rothermel, los tiempos de llegada, la meteorología, la humedad, los combustibles, la resolución de cálculo, las barreras ni las métricas. El suavizado y la altura de las llamas son presentación, no resultados físicos. La imagen interpolada puede diferir ligeramente de la huella discreta usada para contar hectáreas.

Firecast usa una elipse irregular ilustrativa. Pere usa propagación heterogénea sobre relieve y combustibles. Por eso compartir animación, paleta y bandas no implica compartir la forma o la velocidad del incendio. Tampoco se rellena una barrera inaccesible para conseguir una figura más redonda.

Las previsiones mantienen las condiciones del cálculo: no son probabilidades ni intervalos de incertidumbre. Cuando `tiempo actual + horizonte solicitado` supera las 12 horas calculadas, esa banda se desactiva y la cifra indica «—»; no se etiqueta una previsión truncada como +90 min.

Si se quisiera reproducir **también** la forma y el crecimiento ilustrativos de Firecast, la propuesta sería añadir un modo de demostración separado, conservando Rothermel como modo de simulación. Eso cambiaría la mecánica y **no está implementado ni activado**: requiere la revisión del usuario. No es necesario para los cambios visuales actuales.

## Comprobaciones

- Compilación de producción dentro de los presupuestos de tamaño.
- Pruebas de contorno continuo, frentes desconectados, celdas inaccesibles, retroceso temporal, recorte geográfico, empaquetado de datos GPU y límites de +30/+60/+90; más las regresiones existentes del motor y los combustibles.
- Prueba en navegador del caso de Sóller: centro `2.71009,39.76552`, ignición `2.70378,39.75517`, condiciones manuales por defecto. A T+10 h: 35,5 ha actuales; 39,1 / 43,1 / 54,8 ha a +30/+60/+90. Los valores corresponden a los datos cargados en esta revisión.
- Shaders compilados y escena inspeccionada sin errores de consola. Comparación visual directa con Firecast en ejecución.

Para probar: iniciar la simulación, mover el cursor a un tiempo intermedio y pulsar el icono de llama «Veure el foc i la previsió». El extremo de 12 h no muestra áreas posteriores porque quedan fuera del cálculo disponible.

Durante la verificación se detectó la API local todavía ejecutando la versión de combustibles v1 mientras el código del visor ya esperaba v2. Se compiló y reinició la API existente, y se añadió revalidación HTTP para que una respuesta antigua del navegador no impida cargar el dominio después de una actualización.
