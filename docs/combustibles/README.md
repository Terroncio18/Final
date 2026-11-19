# Combustibles cartografiados para IgnisLab

Investigación de Codex, 14/11/2026. Fuentes consultadas y servicios comprobados en
esa fecha. **La integración posterior ya está implementada**: consultar
[IMPLEMENTACION.md](IMPLEMENTACION.md) para ejecutar, importar datos y entender
la distinción entre modelos oficiales y estimados. Las secciones siguientes
conservan los resultados de la investigación inicial.

## Resultado y decisión propuesta

Empezar con **IDEIB para Baleares y los modelos originales 1–13**, conservando
explícitamente los huecos. Para ampliar España, inspeccionar primero `MODCOMB`
en las entregas MFE25: no hace falta asumir que toda la península requiere una
clasificación inventada a partir de especies. Para Portugal hay una cartografía
específica, pero su servicio no ha respondido correctamente en esta revisión.

| Territorio / fuente | Información utilizable | Acceso comprobado | Decisión propuesta |
| --- | --- | --- | --- |
| Baleares / IDEIB, IV Inventario Forestal | Polígonos con `MODCOMB`, estructura y coberturas | Metadatos, estadísticas y muestra GeoJSON: HTTP 200 | Primera integración |
| España / MFE25, MITECO | Cartografía forestal; `ModComb` documentado en IFN4, con excepciones territoriales | Índice y enlaces regionales comprobados; paquetes completos no descargados | Auditar cada entrega antes de reclasificar |
| Portugal continental / FIRE-MODSAT II | Modelos nacionales de combustible de 2021, derivados de COS2018, a 100 m | Fuente documentada por ICNF; MapServer devuelve HTTP 503 | Candidato pendiente de recuperación y leyenda |
| Europa / FIRE-RES | Cartografía de combustible y variables de copas | Portal responde; descarga del raster de superficie no verificada | Alternativa de investigación, no dependencia lista |
| Portugal / DGT COS | Uso y ocupación del suelo | Documentación oficial localizada | Complemento; requiere una conversión metodológica a combustible |

“Cartografiado” no significa medido hoy: el año de publicación, el de la
fotografía y el de trabajo de campo deben distinguirse. Tampoco indica humedad
actual, mantenimiento de parcelas o cambios recientes por incendios.

## 1. Baleares: fuente lista para trabajar

[Servicio oficial IDEIB](https://ideib.caib.es/geoserveis/rest/services/public/GOIB_InvForestal_IB/MapServer/1).
La capa se llama `Inventari Forestal Model combustible`. La consulta admite
GeoJSON, estadísticas, filtros espaciales y paginación, con un máximo declarado
de 2.000 registros por respuesta. CRS nativo EPSG:25831; se ha pedido salida
EPSG:4326 para el visor. Crédito del servicio: Govern de les Illes Balears–SITIBSA.

Campos que conviene conservar: `OBJECTID`, `POLIGON`, `MODCOMB`, `TIPESTR`,
`FCCARB`, `FCCMAT`, `FCCHER`, `HMMAT`, `SP1`. `M_COMBU` y `ESTRUCT1` ayudan a
comprobar el significado de los códigos; no son necesarios en cada tile.

Consulta estadística realizada sobre **todo el servicio**, sin descargar todas
las geometrías. Recuentos de polígonos, **no porcentajes de superficie**:

| MODCOMB | Polígonos |
| --- | ---: |
| 0, sin modelo informado | 5.471 |
| 1 | 44 |
| 2 | 610 |
| 3 | 99 |
| 4 | 596 |
| 5 | 1.586 |
| 6 | 2.496 |
| 7 | 725 |
| 8 | 25 |
| 9 | 2 |
| **Total** | **11.654** |

El 46,95 % de los polígonos tiene código 0. El propio texto `M_COMBU` indica
falta de información. Hay usos agrícolas, artificiales y otras estructuras
entre esos polígonos: **ni convertir todo 0 en agua/no combustible ni rellenar
todo 0 con el modelo 7**. La clasificación de no combustible debe tener una
evidencia independiente. El detalle agrupado por `TIPESTR` está en
`verificacion.json`. En la integración posterior el 0 se importa como
desconocido y lo cubre la estimación por cobertura del suelo
([IMPLEMENTACION.md](IMPLEMENTACION.md)); no se reclasifica por `TIPESTR`.

### Muestra descargada de Sóller

`soller-muestra.geojson`: 26 polígonos que intersectan la caja
`[2.70, 39.73, 2.74, 39.77]`, aproximadamente 0,99 MB, sin simplificación.
La respuesta no declara truncamiento y queda por debajo del límite pedido.
Contiene 13 polígonos de modelo 5, seis de modelo 6, dos de modelo 2 y cinco
sin asignar. **No son porcentajes de área.**

Son geometrías completas que intersectan la caja, no geometrías recortadas.
Es una muestra de investigación; **no cubre el dominio de 30,72 km del simulador**.
No debe conectarse como si fuera un mapa completo. La URL exacta y la hora de
consulta están en sus metadatos.

Ya existe una descarga anterior de toda Baleares en
`C:/Proyectos/TFG/Pere/Code/apps/api/data/fuel-balears.geojson` y un descargador
en `Code/apps/api/scripts/fetch_balearic_fuel.py`. Esa versión conserva menos
campos y simplifica las geometrías. Puede servir de referencia, pero para
resolver ceros hacen falta también estructura y procedencia. No se ha modificado.

### Antigüedad y distribución alternativa

La [ficha de MITECO para Baleares](https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/biodiversidad/mfe_illesbalears.html)
declara escala 1:25.000, actualización 31/12/2012 y un Shapefile de 38,3 MB.
No atribuir esa fecha automáticamente a una actualización concreta de IDEIB:
su descripción contiene el intervalo general del proyecto, no la fecha de cada
polígono. El paquete MITECO no se ha comparado con el servicio IDEIB.

[Descarga Shapefile publicada por MITECO](https://gis.miteco.gob.es/descargas/app/DescargaFichero?f=mfe_illesbalears.zip).
Enlace localizado en la ficha; archivo completo no descargado. MITECO autoriza
uso libre y gratuito con atribución. Para redistribuir la copia de IDEIB,
confirmar las condiciones específicas de esa capa; no asignarle una licencia
CC-BY por deducción.

## 2. España: corregir una premisa de la bitácora

La frase de `docs/bitacola/fase-1/5-fonts-de-dades.md` que afirma que la península no lleva modelo
asignado es demasiado general (enmendada en su §5 el 14/11/2026). El [documentador SIG del IFN4, página 18 y anexo 23](https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/temas/inventarios-nacionales/documentador_sig_tcm30-536622.pdf)
define `ModComb` como el modelo predominante fotointerpretado y describe los
códigos 1–13. Ese documento identifica expresamente falta de información en
las provincias 15, 27, 31, 32 y 36. Es evidencia del esquema documentado, **no
una auditoría de cobertura de los paquetes actuales**. Revisar valores nulos,
ceros y distribución territorial en cada entrega.

[Índice oficial de descargas regionales MFE25](https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/biodiversidad/mfe.html).
El script guarda sus enlaces. Como segundo territorio de prueba,
[Cataluña](https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/biodiversidad/mfe_catalunia.html)
ofrece un Shapefile de 363 MB con actualización declarada 31/12/2016 y permiso
de uso con atribución. [Enlace del paquete](https://gis.miteco.gob.es/descargas/app/DescargaFichero?f=mfe_catalunia.zip),
localizado pero no descargado. No confundir la fecha del catálogo nacional con
la antigüedad de cada comunidad.

La [metodología oficial](https://www.miteco.gob.es/es/biodiversidad/temas/inventarios-nacionales/mapa-forestal-espana/metodologia-mfe-25-.html)
establece teselas de generalmente 1 ha, con excepciones de 0,5 ha y 2 ha.
Rasterizar a 30 m permite usar la rejilla existente; no convierte la fuente
en una observación de combustible con precisión de 30 m.

## 3. Portugal: fuente específica localizada, acceso pendiente

El [catálogo del visor ICNF](https://fogos.icnf.pt/localizador/Apoio_Decisao_FSBF_Metadados.html)
describe **Modelos de Combustível 2021**, de FIRE-MODSAT II: clases nacionales
asignadas a COS2018, con resolución de 100 m. El HTML público del visor utiliza
[este MapServer de la Universidade de Lisboa](https://pccir.isa.ulisboa.pt/arcgis/rest/services/Mapas/ModeloCombustivel/MapServer).
Dos consultas de metadatos devolvieron HTTP 503 en esta sesión. No se han
verificado los códigos, parámetros, formato de descarga ni licencia de ese
raster; no interpretar sus enteros como Anderson sin la tabla correspondiente.

Como complemento, la DGT anuncia el [visor COS actualizado a 2018–2025](https://www.dgterritorio.gov.pt/coscid-versao-2018-2025-ja-esta-disponivel)
y mantiene [documentación de COS y otros productos](https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-tematica/SMOS-CLMS).
COS describe usos y coberturas; una equivalencia a combustible debe documentarse
y marcarse como estimación. COS y COSc son productos diferentes. No fijar COS2018
como única edición posible solo porque figure en la bitácora.

## 4. FIRE-RES: alternativa con otro catálogo de modelos

El [artículo de los autores](https://arxiv.org/abs/2409.00008) presenta capas
pan-europeas de combustible a resolución nominal de 100 m. El
[portal de Padova](https://www.cirgeo.unipd.it/fire-res/app/) responde y enlaza
una aplicación Earth Engine. No se ha probado una descarga GeoTIFF allí.

La [versión v6 del registro](https://zenodo.org/records/10520218) describe una
capa de clases Scott & Burgan y celdas de 0,0008983 grados: su ancho en metros
cambia con la latitud. La [versión v10](https://zenodo.org/records/17347074)
describe variables de copas y ofrece archivos restringidos en Zenodo, remitiendo
al visor para acceso. No presentar ese registro como una descarga directa,
abierta y ya verificada de combustible superficial.

No mezclar códigos Scott & Burgan con los 1–13 de IDEIB. Referencias de parámetros:
[Anderson 1982, USDA](https://research.fs.usda.gov/treesearch/6447) y
[Scott & Burgan 2005, USDA](https://www.fs.usda.gov/rm/pubs/rmrs_gtr153.pdf).
Una equivalencia aproximada entre familias introduce otra hipótesis; para la
primera integración balear propongo mantener Anderson.

## 5. Cambios concretos que necesitará el motor

> **Estado: hecho el mismo día.** Esta lista describe el código **antes** de la
> integración y se conserva como registro de lo que se pidió. Hoy `rothermel.ts`
> tiene los 13 modelos, el motor usa combustible por celda, los estados
> (modelo, no combustible, desconocido) y la procedencia (oficial, estimado)
> están separados, y la pantalla informa de los porcentajes del dominio. Los
> detalles están en [IMPLEMENTACION.md](IMPLEMENTACION.md) y las decisiones en
> la bitácora, §11.21. Sigue vigente el punto 6.

Conclusiones de la revisión del código local, no afirmaciones de los proveedores:

1. `rothermel.ts` solo contiene los modelos 1, 2, 4 y 7. La cartografía balear
   también usa 3, 5, 6, 8 y 9: 4.208 de los 6.183 polígonos con modelo asignado
   usan códigos todavía no implementados. Completar los 13 y contrastar sus
   parámetros y unidades antes de cargar las clases del mapa.
2. `SpreadInput` recibe un solo `bed` y `midflame`. Necesita combustible por
   celda y una caché de propiedades/tasas por modelo y condiciones. Revisar
   también `baseRate` y las métricas que hoy presuponen combustible homogéneo.
3. Mantener estados separados: modelo válido, no combustible demostrado,
   desconocido y estimado. Propuesta interna: IDs 1–13; 0 reservado a no
   combustible confirmado; 255 a desconocido. **El 0 de IDEIB se traduce a
   desconocido**, salvo evidencia independiente de uso no combustible.
4. Recortar/rasterizar en la preparación de datos, conservando CRS, versión,
   fecha, fuente y regla de asignación. Los IDs son categorías: no interpolar
   bilinealmente ni promediar códigos. Usar centros o mayoría de superficie
   con criterio documentado y probar límites/pequeñas barreras.
5. Informar porcentaje de área del dominio con modelo, desconocida y estimada.
   Los recuentos de polígonos de este informe no sustituyen esa medición.
   Un escenario con huecos debe avisarlo o usar una hipótesis explícita;
   bloquear el fuego en cada hueco falsearía el resultado.
6. La cartografía no proporciona automáticamente humedad viva actual ni viento
   bajo cubierta. Mantener visibles esas hipótesis aunque el combustible ya
   proceda de un mapa real.

## Evidencias y reproducción

- `verificacion.json`: respuestas originales de metadatos/estadísticas, enlaces
  extraídos y errores, con URL y hora UTC.
- `soller-muestra.geojson`: muestra de 26 polígonos para inspección.
- `verificar_fuentes.py`: consultas públicas reproducibles, sin dependencias.

Desde `Pere/Final`: `python docs/combustibles/verificar_fuentes.py`.
Vuelve a consultar los servicios y sobrescribe únicamente los dos archivos de
evidencia de esta carpeta. No descarga paquetes nacionales, no modifica la app
y no acredita acceso futuro si un servicio cambia. CORS desde el navegador,
y descarga nacional completa quedan sin verificar; la integración con el
visor y el modelo está descrita en [IMPLEMENTACION.md](IMPLEMENTACION.md).
