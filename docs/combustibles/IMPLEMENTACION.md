# Combustibles por celda: implementación

**Ampliación 19/11/2026:** [fuentes oficiales fuera de Baleares](FUENTES-OFICIALES.md),
con preparación automática, GeoTIFF y pruebas integradas. El inventario de esta
página describe la implementación inicial del 14/11.

14/11/2026 · `Pere/Final`. La API, la carga del visor y el motor están conectados.

## Qué está disponible

- `/api/fuels?bbox=oeste,sur,este,norte&size=1024` devuelve modelos Anderson 1–13 para la misma extensión y orientación que el relieve. `0` significa no combustible y `255`, desconocido. Cada celda conserva además procedencia: `1` modelo oficial, `2` estimación, `0` desconocida.
- Baleares: importados 11.654 polígonos del archivo IDEIB ya disponible en `Pere/Code/apps/api/data/fuel-balears.geojson`. Se asignaron los 6.183 con modelo 1–13; los 5.471 con `MODCOMB=0` **no se interpretan como incombustibles**. Resultado: 73 teselas locales, publicadas mediante un manifiesto.
- España y Portugal, incluidas islas: cobertura de respaldo con ESA WorldCover 2021 v200, consultada mediante rangos HTTP sobre sus GeoTIFF públicos. No necesita clave. Es cobertura del suelo observada por satélite; su conversión a combustible **es una aproximación, no una cartografía oficial de combustibles ni una medición actual**.
- La pantalla muestra porcentajes oficiales, estimados, desconocidos y no combustibles, los modelos presentes, fuentes, fechas y atribuciones. No permite iniciar si falta combustible en terreno terrestre o una ignición está sobre una celda no combustible.
- El motor usa el modelo de cada celda, integra el tiempo a través de todas las celdas cruzadas y respeta barreras de una celda, incluso en pasos largos y diagonales.

## Arranque

Desde `Final/api`:

```powershell
npm install
npm run build
npm start
```

Desde `Final/web`, ejecutar `npm start` como antes. El proxy `/api` existente sirve también combustibles. Si la API estaba ejecutándose sin vigilancia, reiniciarla para cargar la nueva ruta.

El directorio por defecto es `api/data/fuels` al arrancar desde `api`. Se puede fijar una ruta absoluta con `FUEL_DATA_DIR`. La web solicita automáticamente el dominio al entrar al simulador y al cambiar el centro. No hay descarga nacional masiva al abrir la página.

El conjunto preparado de esta máquina es `data/fuels/datasets/ideib-balears-20261019`. Estos datos y la caché están excluidos de Git: para otra máquina hay que copiar los conjuntos preparados con su manifiesto o volver a importarlos. Sin ellos, sigue funcionando el respaldo estimado.

## Preparar otra entrega oficial

El importador acepta GeoJSON WGS84 o Shapefile con sus `.dbf` y `.prj`. Solo se deben introducir fuentes cuya leyenda confirme **Anderson 1–13**; no basta con que tengan números entre 1 y 13. Otras leyendas, incluidos productos portugueses pendientes de verificar, requieren una conversión específica revisada antes de importarlas.

Ejemplo desde `api`, después de extraer una entrega oficial:

```powershell
npm run fuels:prepare -- --input=C:/datos/mfe/capa.shp --id=mfe-region-edicion --field=MODCOMB --label="MFE · región" --url=https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/biodiversidad/mfe.html --date="año de la entrega" --attribution="MITECO"
```

Opciones: `--crs=EPSG:25831` si no hay `.prj`, `--encoding=windows-1252`, `--priority=10`. Mayor prioridad sobrescribe menor; en empate se aplica el orden del identificador. El identificador de una entrega terminada es inmutable: usar otro para una actualización. Para retirar una entrega antigua, mover su directorio completo fuera de `datasets`.

Reproducir la preparación ya realizada en esta máquina:

```powershell
npm run fuels:prepare -- --input=C:/Proyectos/TFG/Pere/Code/apps/api/data/fuel-balears.geojson --id=ideib-balears-20261019 --label="IDEIB · IV Inventari Forestal" --url=https://ideib.caib.es/geoserveis/rest/services/public/GOIB_InvForestal_IB/MapServer/1 --date="IFN4 · consulta 2026-10-19" --attribution="Govern de les Illes Balears–SITIBSA"
```

No repetir sobre el mismo identificador ya publicado. La fecha de consulta no es el año del inventario. El archivo local original declara simplificación geométrica de aproximadamente 0,0001 grados; rasterizarlo no añade precisión de campo.

El modo opcional `--region=illesbalears` intenta descargar el ZIP de MITECO. En esta revisión el servidor devolvió un formulario HTML con CAPTCHA, aunque respondió HTTP 200. El importador detecta ese caso y no publica datos. Usar la descarga manual del portal y `--input` sobre el `.shp` extraído. Para archivos grandes es preferible extraerlos antes de ejecutar el importador.

## Conversión del respaldo WorldCover

Versión de la respuesta: `anderson13-worldcover2021-v2` (la v1 asignaba el modelo 1 al suelo desnudo; cambiado el 14/11/2026, bitácora §11.21). Una modificación de la tabla debe cambiar la versión en API y decodificador para invalidar resultados anteriores.

| WorldCover | Modelo asignado | Supuesto |
| --- | --- | --- |
| 10 árboles, 95 manglares | 8 | Fullaraca compacta; no se conoce sotobosque ni estructura de copas |
| 20 matorral | 5 | Matorral bajo |
| 30 herbáceas, 40 cultivos | 1 | Combustible fino curado; no conoce fenología ni cosecha |
| 100 musgos/líquenes | 1 | Aproximación que puede sobreestimar el combustible; clase casi ausente en el ámbito |
| 60 suelo desnudo/vegetación dispersa | 0 | La fuente la define con un máximo del 10 % de cubierta vegetal en todo el año: sin continuidad para un fuego de superficie. Puede convertir en barrera un pedregal con algo de vegetación |
| 90 humedal herbáceo | 3 | Herbáceas altas potencialmente combustibles; humedad no observada |
| 50 construido, 70 nieve/hielo, 80 agua | 0 | No combustible a esta resolución; no representa vegetación dentro de áreas urbanas |
| Sin dato o código no reconocido | 255 | Desconocido; nunca se sustituye silenciosamente por un modelo uniforme |

Los códigos originales se leen a resolución nativa, sin interpolar clases ni usar colores WMS. Después se muestrea el centro de cada celda de simulación. Las teselas oficiales tienen 512 × 512 celdas por 0,125 grados: aproximadamente 20–27 m en estas latitudes. La celda de simulación nominal es de 30 m; la precisión temática sigue siendo la de la fuente.

Los trece modelos usan las cargas, profundidades y extinciones de Anderson. Se mantienen las ecuaciones Rothermel previas y sus hipótesis: meteorología uniforme y constante, humedad viva supuesta al 100 %, humedad muerta estimada, sin copas ni focos secundarios. La clasificación satelital no convierte esas hipótesis en observaciones.

## API, persistencia y fallos

- `bbox` admite hasta 0,8° por eje dentro del rectángulo que abarca España, Portugal e islas; `size`, 16–1024. La validación territorial es rectangular, no una frontera política.
- El cuerpo contiene `bounds`, `size`, `version`, `runs`, recuentos, fuentes y advertencias. `runs` son triples planos `[modelo, procedencia, númeroDeCeldas, ...]`, en filas de norte a sur y columnas de oeste a este.
- La caché persiste dominios completos en JSON gzip durante 30 días, con máximo de 96 entradas. Su clave incluye geometría, tamaño, versión y todos los manifiestos. Añadir un conjunto oficial invalida automáticamente las respuestas anteriores.
- Dos preparaciones simultáneas como máximo; peticiones idénticas se deduplican. Si está ocupado, HTTP 503 con `Retry-After`. Entradas inválidas: 400. Fallo local de lectura: 502.
- Una caída de WorldCover conserva las celdas sin otra fuente como desconocidas y devuelve advertencias; esas respuestas no se guardan en caché. Una respuesta completa previamente cacheada no requiere red durante su vigencia. El cliente permite reintentar y descarta respuestas de centros anteriores.
- Hay cobertura geográfica de respaldo, no garantía de disponibilidad permanente de un servicio remoto. El servicio portugués FIRE-MODSAT II y el GeoServer MFE no respondieron correctamente en la investigación; no se afirma que estén integrados.

## Verificación realizada

```powershell
# api
npm run test:fuels

# web
npx vitest run src/app/simulation/fire-fuels.spec.ts src/app/simulation/fuel-data.spec.ts
npm run build
```

Pruebas: validación y límites HTTP, rasterización con huecos y coordenadas negativas, nomenclatura de teselas occidentales, procedencia y códigos desconocidos, decodificación truncada o desplazada, barreras de una celda y diagonales, tiempo a través de franjas lentas, igniciones inválidas, trece modelos finitos y comparación con velocidades publicadas de ocho modelos exclusivamente muertos (tolerancia 10 %).

Consultas reales de 64 × 64 celdas en Sóller, Madrid, Lisboa, Canarias, Madeira y Azores: todas sin desconocidos. Dominios completos por HTTP interno Fastify:

| Centro | Oficiales | Estimadas | Desconocidas | Primera / caché |
| --- | ---: | ---: | ---: | --- |
| 2,72 E; 39,75 N | 410.097 | 638.479 | 0 | 1,33 s / 19 ms |
| 8,25 O; 39,62 N | 0 | 1.048.576 | 0 | 0,98 s / 22 ms |

Son tiempos de esta máquina y estas consultas, no un compromiso de servicio. Los porcentajes cuentan todo el dominio, incluidas celdas clasificadas como no combustibles.

Comprobación integrada adicional: respuesta real de Sóller → decodificador del visor → motor de 1024 × 1024 celdas, con relieve plano sintético, viento de 12 km/h y horizonte de 12 horas. Resultado: 449,46 ha, ninguna celda clasificada sin combustible alcanzada, 0,16 s de cálculo. Es una prueba de integración, no una validación contra un incendio observado.

## Fuentes

- [IDEIB, capa oficial de modelos](https://ideib.caib.es/geoserveis/rest/services/public/GOIB_InvForestal_IB/MapServer/1).
- [MITECO, descargas MFE](https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/biodiversidad/mfe.html).
- [ESA WorldCover, acceso y licencia](https://esa-worldcover.org/en/data-access) y [documentación del repositorio oficial](https://github.com/ESA-WorldCover/esa-worldcover-datasets). Atribución incluida en cada respuesta y en la pantalla: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · CC BY 4.0.
- [Anderson (1982), USDA, tabla 1 y descripciones](https://research.fs.usda.gov/download/treesearch/6447.pdf).
- [NWCG, parámetros de modelos de combustible de superficie](https://www.nwcg.gov/publications/pms437/fuels/surface-fuel-model-descriptions).
