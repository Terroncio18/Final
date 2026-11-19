# Combustibles oficiales fuera de Baleares

19/11/2026 · Rama `codex/combustibles-oficiales`, separada de `master`.

La rama incorpora cartografía de combustible de Asturias, Navarra, Valencia y
las cinco islas forestales de Canarias. Los datos están preparados en el árbol
de trabajo de esta máquina; **los binarios no están en Git**. Baleares se conserva.
La API y el mapa utilizan el mismo contrato: procedencia 1 oficial, 2 estimada,
0 desconocida. Oficial significa modelo cartografiado por el organismo, no una
medición del combustible actual ni una validación de la predicción de incendios.

## Fuentes realmente integradas

| Fuente | Dato utilizado | Tratamiento |
| --- | --- | --- |
| [Canarias / GRAFCAN](https://www.gobiernodecanarias.org/medioambiente/materias/biodiversidad/sistemas-de-informacion-en-biodiversidad/cartografia-verctorial-de-montes/) | `*_gen.tif`, modelos NFFL de 25 m, cinco islas | Ráster original, sin el suavizado `Sieve`. CRS declarado por el fichero: EPSG:32628. Cero y NoData desconocidos |
| [ICV / PATFOR Valencia](https://dadesobertes.gva.es/es/dataset/patfor-modelo-de-combustible-rothermel1) | WFS Shapefile, `mod_comb`, EPSG:25830 | 30.722 polígonos recibidos, 21.170 con modelos 1–13. Conteo contrastado con `resultType=hits`. Los 9.552 ceros no se convierten en barreras |
| [SITNA / IDENA Navarra](https://datosabiertos.navarra.es/dataset/spasitnaforest_pol_modecombus-xml) | `FOREST_Pol_ModeCombus.shp`, `IDCOMBUSTI`, EPSG:25830 | 41.011 polígonos, 36.732 modelos 1–9. Actualización LiDAR 2019 sobre mapa 2005. A/H/SD/U quedan para el respaldo; no se inventa un modelo para esas clases |
| [CETEMAS / Asturias](https://www.cetemas.es/descargas-ide/) | `ROTHERMEL_ASTURIAS_filter.tif`, 25 m, EPSG:25830 | LiDAR 2020, MFE/IFN4 2009–2010. Se utilizan 1–6, 8 y 9; se excluyen 7, 21 y −128 |

La memoria oficial canaria es de agosto de 2015 y describe LiDAR 2011–2013.
La fecha de consulta no se presenta como una revisión de la vegetación en 2026.
No se ha confirmado la supuesta revisión 2023 del resumen inicial. La
[tabla de equivalencia oficial, página 39 impresa](https://www.gobiernodecanarias.org/medioambiente/descargas/descargas/Biodiversidad/Forestal/cartografia-forestal-documentos/Modelos_Combustible_proceso.pdf)
ya está aplicada en los rásteres `gen`: se usan estos y no los códigos locales `can`.

**Asturias:** el QML entregado con el ráster define 7 como «Modelo 7 o 10» y 21
como «Sin modelo de combustible». −128 no tiene clase documentada. Se conservan
como huecos y se completa con WorldCover, etiquetado como estimado. No se fuerza
el modelo 7 ni se aplica una equivalencia inventada. La fotoguía gallega del
mismo ZIP es otra clasificación y no se importa.

Licencias: Navarra CC BY 4.0; Valencia CC BY según catálogo GVA; CETEMAS CC BY
según su página de descargas, atribuyendo la reproyección y el muestreo.
Canarias conserva su aviso legal propio; no se le asigna una licencia CC.
Los manifiestos conservan URL, atribución, fecha de referencia, leyenda,
prioridad, SHA-256 de las entradas y exclusiones. No se redistribuyen archivos
de origen en esta rama.

## Preparación reproducible

Desde `api`, con las dependencias instaladas:

```powershell
npm run fuels:official -- --list
npm run fuels:official -- --source=all --edition=20261119
# También: --source=canarias, canarias-tenerife, icv-valencia-patfor,
# sitna-navarra, cetemas-asturias; la lista contiene todos los identificadores.
```

`edition` identifica la descarga, no el año observado. Los conjuntos publicados
son inmutables; repetir el mismo identificador los omite. Para una nueva
entrega, cambiar la edición y retirar el directorio antiguo fuera de `datasets`.
Las fuentes regionales tienen prioridad 20; un futuro MFE puede usar 10.

Asturias necesita Python 3 (biblioteca estándar, sin paquetes adicionales),
configurable con `PYTHON`. Se descarga por rangos solamente el miembro original
Rothermel: el ZIP completo también contiene casi 6 GB descomprimidos de pendiente
y orientación que no hacen falta. Se comprueban Content-Range, ETag y CRC; se
guarda un ZIP local reducido y un registro `.ranges.json`. Su SHA-256 corresponde
al ZIP local, **no** al archivo remoto completo. Alternativa: pasar el ZIP completo
ya descargado con `--archive=C:/datos/Mapa_mcb_2cob-1.zip`.

Para reutilizar archivos locales:

```powershell
npm run fuels:official -- --source=canarias-tenerife --edition=20261119 --archive=C:/datos/TENERIFE.zip
npm run fuels:official -- --source=icv-valencia-patfor --edition=20261119 --archive=C:/datos/cv.zip --expected-features=30722
```

La descarga WFS automática consulta el número de objetos antes de descargar y
rechaza una respuesta truncada. El modo local exige el conteo verificado para
Valencia. Los ZIP se extraen por nombres permitidos; no se usan sus rutas como
destino. Un fallo no publica el manifiesto.

El importador general ahora admite GeoTIFF categórico de una banda y píxel-área,
orientado al norte, además de GeoJSON y Shapefile. Rechaza RGB, clases no
reconocidas, CRS ausente o geometrías fuera del ámbito. Muestrea el centro de
cada celda transformado al CRS original, sin interpolar categorías. La malla
local sigue siendo 512 × 512 por 0,125°: remuestrear no añade precisión a la fuente.

## Funcionamiento y huecos

Las capas oficiales se superponen primero. WorldCover solo rellena sus huecos;
si un dominio está completamente cubierto no se consulta ese servicio remoto.
Los nuevos manifiestos y la revisión interna del ensamblado invalidan la caché
de dominios antiguos. El contrato público y las ecuaciones de propagación no cambian.

- **MFE:** el enlace regional verificado devuelve HTTP 200 con un formulario
  HTML/CAPTCHA, no un ZIP. El antiguo host ATOM tampoco resolvió. Se mantiene
  la importación manual documentada en `IMPLEMENTACION.md`; no se afirma una
  cobertura oficial estatal preparada.
- **Portugal:** ICNF MapServer y `/identify` sí respondieron en esta revisión.
  En −8,25;39,62 devolvió el código nacional 227. La leyenda contiene 212–235 y
  91/93/98/99, que no son Anderson 1–13. No se convierten los colores de `/export`
  en combustible. Falta un acceso masivo a valores originales y una adaptación
  revisada de los modelos nacionales; Portugal conserva el respaldo estimado.
- Lanzarote y Fuerteventura no están en los cinco ZIP canarios. Madeira, Azores
  y las demás regiones sin un conjunto preparado también conservan WorldCover.
- SIOSE, COS y LiDAR son entradas útiles para otros derivados; no pasan a ser
  modelos oficiales simplemente por añadir sus endpoints.

## Verificación

```powershell
# api
npm run build
npm test
npm run fuels:verify
# web
npm run test:simulation
npm run build
```

70 pruebas de API y 155 de simulación superadas; ambas compilaciones correctas.
La prueba integrada usa archivos oficiales reales, la ruta HTTP, el decodificador
del visor y el motor, a 1024 × 1024. Simula 30 minutos sobre relieve plano
sintético y verifica que no alcanza celdas sin combustible. Es una comprobación
del software, no una validación frente a incendios observados.

| Dominio de 30,72 km de lado | Celdas oficiales |
| --- | ---: |
| Somiedo (Asturias) | 35,99 % |
| Serra (Valencia) | 42,72 % |
| Irati (Navarra) | 59,72 % |
| Tenerife | 31,91 % |
| Gran Canaria | 69,72 % |
| La Palma | 41,94 % |
| La Gomera | 33,02 % |
| El Hierro | 17,42 % |
| Sóller (regresión Baleares) | 39,11 % |
| Madrid, Portugal, Lanzarote (controles) | 0 % |

Los doce dominios no tuvieron celdas desconocidas. Los porcentajes incluyen
todo el cuadrado, también mar y espacios no forestales: **no representan el
porcentaje de cobertura oficial de cada comunidad o isla**. Informe con centros,
fuentes, tiempos y tamaños: `verificacion-oficiales-20261119.json`. La orden de
verificación escribe futuras mediciones en `api/data/fuels/verification.json`.

## Probar aislado de master

Árbol de trabajo local: `C:/Proyectos/TFG/Pere/worktrees/combustibles-oficiales`.
Abrir dos terminales dentro de él:

```powershell
# Terminal 1, desde api
$env:PORT = '3001'
node --env-file-if-exists=.env dist/server.js
# Terminal 2, desde web
npx ng serve --port 4201 --proxy-config proxy.fuels.config.json
```

Abrir `http://localhost:4201`, escoger uno de los territorios integrados y mirar
el desglose de combustible del simulador. Las claves opcionales para otras
funciones de la API se configuran en `.env` como en la instalación principal.
La preparación de esta rama utiliza su propio `api/data/fuels`; no modifica
los datos ni los procesos de `Final`.
