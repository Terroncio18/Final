# 6. Recursos de tercers i llicències

Comprovat el 29/10/2026. Les llicències del programari surten del `package.json`
instal·lat; les de les dades, de la pàgina de cada proveïdor. El que no diu la
font es marca **per confirmar** en lloc d'endevinar-ho.

| Recurs | Versió | Llicència |
| --- | --- | --- |
| Angular | 22.2.3 | MIT |
| MapLibre GL JS | 6.15.0 | BSD-3-Clause |
| maplibre-contour | 0.1.1 | BSD-3-Clause |
| RxJS | 7.8.2 | Apache-2.0 |
| tslib | 2.8.1 | 0BSD |
| TypeScript | 6.0.3 | Apache-2.0 |
| Fastify | 5.12.7 | MIT |
| pino | 10.4.0 | MIT |
| geotiff | 3.0.5 | MIT |
| proj4 | 2.23.0 | MIT |
| shapefile | 0.6.6 | BSD-3-Clause |
| fflate | 0.8.3 | MIT |
| @types/geojson | 7946.0.16 | MIT |
| Material Symbols «mode_heat» | — | Apache-2.0 |
| DM Sans (variable, latin i latin-ext) | v17 | OFL-1.1 |
| Manrope (variable, latin i latin-ext) | v23 | OFL-1.1 |
| Open Sans, servida per fonts.openmaptiles.org | — | Per confirmar: Apache-2.0 o OFL segons la versió |

**Les dues famílies de lletra són al repositori, no a Google Fonts.** Quatre
fitxers woff2 a `web/src/fonts/`, 95 kB en total, amb el text de l'OFL de
cadascuna al costat —que és el que la llicència demana de qui les
redistribueix. Es van baixar de Google Fonts el 13/11/2026 i no es demanen en
temps d'execució: l'única dependència remota de tipografia que queda és la dels
glifs del mapa, que serveix OpenMapTiles i que la §2.6 ja compta.

Les dades no tenen cap llicència amb nom, i això és una troballa:

| Font | Condicions | Atribució que demanen |
| --- | --- | --- |
| Eurostat GISCO (NUTS) | Gratuïta, ús no comercial, citant la font | Per confirmar (vegeu sota) |
| Esri World Imagery | Esri Master License Agreement | «Esri, Vantor, Earthstar Geographics, and the GIS User Community» |
| Mapzen / AWS Terrain Tiles | Cap llicència conjunta: cada font té la seva | Per font; a Europa, Copernicus EU-DEM |
| NASA FIRMS | Cap llicència amb nom; dades obertes | Text d'agraïment publicat (vegeu sota) |
| OpenStreetMap | ODbL 1.0 | «© OpenStreetMap contributors», amb la llicència al costat |
| ESA WorldCover 2021 | CC BY 4.0 | «© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium» |
| IDEIB — IV Inventari Forestal | Per confirmar: el servei no en publica cap | «Govern de les Illes Balears–SITIBSA», el crèdit que declara la capa |
| GVA — punts d'aigua (PPIFDF) | CC BY | «Generalitat Valenciana» |
| REDIAM — punts d'aigua per a l'extinció | CC BY 4.0 | «REDIAM, Junta de Andalucía» |
| IGN — hidrografia (Aguas estancadas) | CC BY 4.0 | «© Instituto Geográfico Nacional» |
| ICNF — Pontos de água | Per confirmar: el servei no en publica cap; el mateix tema en conjunts municipals de dados.gov.pt és CC0 | «Instituto da Conservação da Natureza e das Florestas, IP», el crèdit que declara el servei |
| ENAIRE — dades aeronàutiques | Per confirmar: no s'han trobat les condicions d'ús del servei | «ENAIRE» |

**GISCO.** La nota de copyright «© EuroGeographics for the administrative
boundaries» i la clàusula explícita de no comercial són a la pàgina d'*unitats
administratives*, no a la de *NUTS*, que és d'on surten `regions.geojson` i
`provinces.geojson`. La pàgina de NUTS no publica cap condició pròpia i la que
hi enllaçava dona 404. Per a un TFG, que no és comercial i cita la font, no hi
ha problema; però com que el repositori redistribueix geometria derivada, la
via segura és afegir la nota d'EuroGeographics a l'atribució del mapa encara
que la pàgina de NUTS no l'exigeixi.

**El que diu el mapa.** Corregit el 29/10/2026 (pendent 3.13). L'atribució
d'Esri deia «Imatgeria © Esri, Vantor, Earthstar Geographics» i es menjava el
«and the GIS User Community» del crèdit publicat; la del relleu deia només
«Mapzen Terrain Tiles» quan el que les fonts demanen és esmentar Copernicus
EU-DEM i l'USGS; i la de GISCO no duia la nota d'EuroGeographics. Les tres
cadenes viuen ara a `map.config.ts`, cadascuna amb la seva citació al costat.

**FIRMS.** No hi ha llicència: NASA publica les dades obertament i demana
aquest agraïment, que haurà d'anar a la memòria —aquí sense les URL que
l'original hi intercala—: «We acknowledge the use of
data and/or imagery from NASA's Fire Information for Resource Management
System (FIRMS), part of NASA's Land, Atmosphere Near real-time Capability for
Earth observations (LANCE) and NASA's Earth Science Data and Information
System (ESDIS).»
