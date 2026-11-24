# Evaluación de `simulation/` y `api/` — 24/11/2026

## Nota: 88/100

Valoro la corrección de los contratos de entrada, el comportamiento ante fallos y concurrencia, la capacidad de recuperación y la fuerza de las pruebas. La base es buena: el modelo separa la propagación de la medición, valida igniciones y opciones de viento/brasas, los datos de combustible se decodifican con longitud y procedencia comprobadas, y las pruebas ejercitan varios resultados físicos y fallos reales. La nota no sube porque hay caminos de error que pueden publicar datos incompletos como frescos o impedir su recuperación, y porque la concurrencia de peticiones iguales queda fuera de las pruebas de la API. Es una valoración de esta mitad, no una reinterpretación del 91/100 de la revisión anterior del conjunto.

No he modificado código ni ejecutado las suites: el encargo y la bitácora §11.77 documentan 420 pruebas, compilaciones, lint y formato verdes antes de esta lectura. Los defectos siguientes se deducen del flujo actual; no los presento como reproducciones instrumentadas.

## Defectos, por gravedad

### 1. Una respuesta parcial de FIRMS se publica y conserva como completa — alta

[`api/src/firms.ts`](../../api/src/firms.ts) líneas 277–304 acepta cualquier resultado si fallan menos de todos los trabajos. Esto permite servir incluso una colección vacía cuando, por ejemplo, el área o plataforma que contiene detecciones falla y otra responde vacía. [`api/src/app.ts`](../../api/src/app.ts) líneas 29–39 guarda esa respuesta diez minutos con `stale: false`; líneas 87–99 envía `x-stale: false` y `cache-control: public, max-age=300`. Durante ese tiempo no se vuelve a consultar el trabajo fallido y el cliente no sabe que el mapa es incompleto. `x-sources` enumera plataformas que respondieron, pero no revela qué combinación de área y ventana faltó.

La aceptación de resultados parciales es deliberada y está probada en [`api/tests/firms-network.test.ts`](../../api/tests/firms-network.test.ts) líneas 160–180. La prueba no cubre su almacenamiento como respuesta completa, el caso de éxito vacío más fallo, ni el reintento de los trabajos perdidos. La política de caché y señalización necesita la decisión de Pere; la dejo en `preguntas/02-evaluacion-de-simulation-y-api.md`.

### 2. Una actualización meteorológica con todas las filas inválidas borra la última lectura válida — alta

[`api/src/weather-data.ts`](../../api/src/weather-data.ts) líneas 105–115 y 178–190 descarta filas inválidas y devuelve `[]` si no queda ninguna, aun cuando el proveedor haya enviado filas. [`api/src/weather.ts`](../../api/src/weather.ts) líneas 69–80 interpreta ese resultado como éxito, sobrescribe la caché anterior y lo conserva veinte minutos; [`api/src/app.ts`](../../api/src/app.ts) líneas 134–136 responde 404. Así, una respuesta del proveedor con envoltura válida y filas corruptas hace desaparecer una observación previa que sí habría servido como `stale` si el parser hubiera lanzado un error.

[`api/tests/weather.test.ts`](../../api/tests/weather.test.ts) líneas 305–313 comprueba filas inválidas junto a otras válidas; líneas 356–365 comprueba una envoltura inválida tras una lectura buena. No cubre la actualización con envoltura válida y todas las filas inválidas. El caso legítimo de proveedor sin estaciones está probado en líneas 217–222, por lo que la distinción debe conservarse.

### 3. Una caché de combustible dañada bloquea el recálculo — media

[`api/src/fuels.ts`](../../api/src/fuels.ts) líneas 289–297 solo trata `ENOENT` como fallo recuperable. Un `.json.gz` reciente truncado, con gzip inválido o JSON corrupto hace que `gunzipSync` o `JSON.parse` lance; [`api/src/fuel-routes.ts`](../../api/src/fuel-routes.ts) líneas 16–29 responde 502 sin reconstruir la cuadrícula. Cada petición de esa misma caja repite el fallo hasta que el archivo envejece treinta días o se retira por fuera. Un JSON sintácticamente válido pero de forma errónea también atraviesa la aserción `as FuelResponse` sin validarse.

[`api/tests/fuel-cache.test.ts`](../../api/tests/fuel-cache.test.ts) cubre escrituras y disco lleno; no hay prueba de lectura corrupta o de regeneración en [`api/tests/fuels.test.ts`](../../api/tests/fuels.test.ts). La caché de combustible es un artefacto derivado: su corrupción no debería impedir generar la respuesta desde las fuentes.

### 4. Las peticiones FIRMS simultáneas del mismo rango no comparten trabajo — media

[`api/src/app.ts`](../../api/src/app.ts) líneas 29–39 consulta la caché antes de `await fetchHotspots`, pero no guarda la promesa en curso. Dos visitas que llegan antes de la primera respuesta lanzan dos lotes iguales; el máximo configurado es 42 peticiones upstream por rango de 31 días ([`api/src/config.ts`](../../api/src/config.ts) líneas 35–40). Esto amplifica latencia y consumo de cuota precisamente al expirar la caché o arrancar el servidor. En combustible sí existe deduplicación por clave ([`api/src/fuels.ts`](../../api/src/fuels.ts) líneas 413–424).

[`api/tests/routes.test.ts`](../../api/tests/routes.test.ts) líneas 140–149 prueba dos solicitudes *secuenciales*, ya con caché poblada; no prueba dos solicitudes en vuelo.

### 5. Una lectura de relieve fallida queda sin reintento para el mismo centro — media-baja

[`web/src/app/simulation/terrain.service.ts`](../../web/src/app/simulation/terrain.service.ts) líneas 16–19 conserva `last` antes de leer y líneas 32–37 no lo limpia al fallar. Otra llamada `read(point)` con el mismo punto sale inmediatamente. [`web/src/app/simulation/ignition-step.ts`](../../web/src/app/simulation/ignition-step.ts) líneas 123–127 solo vuelve a pedir el relieve cuando cambia la coordenada; [`ignition-step.html`](../../web/src/app/simulation/ignition-step.html) líneas 51–55 muestra el error sin control de reintento. Un fallo transitorio deja ese centro sin relieve mientras se permanezca en el paso; salir y volver lo desbloquea porque `ngOnDestroy()` llama a `clear()`.

[`web/src/app/simulation/input-services.spec.ts`](../../web/src/app/simulation/input-services.spec.ts) líneas 136–163 comprueba la cancelación y la lectura tras `clear()`, pero no el reintento del mismo punto después de un rechazo. Esto es distinto de las cuatro cargas administrativas corregidas en §11.75, que sí vuelven a admitir `load()` tras fallar.

## Lo que he revisado y está bien

- Las rutas de API rechazan rangos y coordenadas inválidos antes de consultar fuentes; FIRMS valida fecha, hora, coordenadas y FRP, y sus pruebas cubren respuestas `200` con error en texto, mezclas de filas válidas e inválidas y fallos totales.
- La caché FIRMS es acotada con expulsión por uso reciente; los fallos totales sirven la entrada previa marcada `stale`. El localizador de puntos elimina promesas fallidas y comparte lecturas simultáneas; las regresiones comprueban ambos comportamientos.
- El combustible distingue clases oficiales, estimadas y desconocidas; la API limita caja y tamaño, comparte trabajos iguales y marca respuestas con huecos o advertencias como `no-store`. El navegador comprueba la longitud y la semántica de las rachas recibidas.
- La lectura meteorológica valida forma, números finitos, coordenadas y fechas; conserva una lectura anterior cuando la actualización lanza. El modelo tiene pruebas de barreras, brigadas, brasas, cambios de viento y bordes, además de pruebas de entrada de escenarios.
- Revisé el flujo de servicios y pasos de formulario, los límites de `spread()`, el transporte de combustible, las rutas y cachés de la API, y las pruebas adyacentes citadas. La bitácora §11.74–§11.77 y §2.15 evita tratar como defecto la preferencia explícita por datos anteriores frente a un mapa vacío.

## Límites de la evaluación

No he hecho una auditoría línea a línea de todas las fórmulas y bucles de propagación, ni he contrastado resultados numéricos con datos físicos externos: cambiar fórmulas, unidades o escenarios antiguos es decisión de Pere. No he evaluado visualmente el navegador, las fuentes FIRMS/AEMET/IPMA en vivo, los rásteres oficiales locales ni Sonar. Tampoco he evaluado ni modificado las carpetas de Claude `map/`, `simulator/`, `top-bar/` y `hotspot-panel/`. Las pruebas verdes descritas arriba son el estado comunicado en el encargo; no las he repetido mientras había cambios ajenos sin commitear.
