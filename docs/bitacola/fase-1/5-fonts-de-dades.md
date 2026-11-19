# 5. Fonts de dades

| Font | Dada | Cobertura | Estat |
| --- | --- | --- | --- |
| Esri World Imagery | Imatgeria | Global | En ús |
| Mapzen Terrain Tiles | Elevació (Terrarium) | Global | En ús |
| Eurostat GISCO — NUTS 2024 | Regions i províncies | UE | En ús (nivells 2 i 3) |
| Eurostat GISCO — LAU 2024 | Municipis i freguesies | UE | En ús |
| NASA FIRMS (VIIRS 375 m) | Focus actius | Global | En ús (1 dia) |
| IDEIB — IV Inventari Forestal | Model de combustible | Balears | En ús (§11.21) |
| ESA WorldCover 2021 v200 | Coberta del sòl, convertida a model de combustible | Global | En ús, com a estimació (§11.21) |
| MFE25 (MITECO) | Espècies, estructura i `ModComb` | Espanya | Pendent d'auditar |
| COS (DGT) | Ús i ocupació del sòl | Portugal | Pendent |
| AEMET OpenData | Meteorologia | Espanya | En ús (§11.18) |
| IPMA | Meteorologia | Portugal | En ús (§11.18) |
| OpenStreetMap (Overpass) | Topònims i cims | ES i PT | En ús (pantalla de simulació) |
| ICNF — Pontos de água (`BDG/Pontos_agua`) | Punts d'aigua de la xarxa DFCI, classes «Aéreo» i «Misto» | Portugal continental | Retirat el 16/11/2026 (fase 2 §11.49) |
| GVA — PPIFDF, punts d'aigua (WFS `terramapas.icv.gva.es/0509_PlanificacionPPIFDF`) | Punts d'aigua, amb aptitud per a helicòpter i amfibi | País Valencià | Retirat el 16/11/2026 (fase 2 §11.49) |
| REDIAM — punts d'aigua per a l'extinció d'incendis (WMS `REDIAM_puntos_agua`) | Punts d'aigua del Pla INFOCA | Andalusia | Retirat el 16/11/2026 (fase 2 §11.49) |
| IGN — hidrografia INSPIRE, «Aguas estancadas» (WFS `servicios.idee.es/wfs-inspire/hidrografia`) | Llacs i embassaments | Espanya | Retirat el 16/11/2026 (fase 2 §11.49) |
| ENAIRE — base de dades aeronàutica (`Aero_SRV_VIGOR_V2`, capa 3) | Aeròdroms i aeròdroms amb heliport de l'AIP | Espanya | Retirat el 16/11/2026 (fase 2 §11.49) |
| OpenStreetMap (Overpass, per la nostra API) | Parcs de bombers (`amenity=fire_station`); aeròdroms (`aeroway=aerodrome`) on ENAIRE no en té | ES i PT | Retirat el 16/11/2026 (fase 2 §11.49) |

**FIRMS.** L'API d'àrea és `/api/area/csv/[MAP_KEY]/[FONT]/[o,s,e,n]/[DIES]`, amb
un màxim de cinc dies per consulta i 5.000 transaccions cada deu minuts per clau.
Les tres plataformes VIIRS donen 375 m, la millor resolució operativa.
Mesurat el 25/10/2026, un dia de deteccions a l'àmbit en dona 195, amb
potències d'entre 0,39 i 56,7 MW i una mediana de 2,1: a l'octubre el que crema són
majoritàriament rostolls, no bosc (§3.5).

**OpenStreetMap.** L'ODbL demana que l'atribució i la llicència viatgin amb les
dades derivades, de manera que el crèdit del mapa diu «Topònims: ©
OpenStreetMap contributors, ODbL» i no només el nom. Els topònims es preparen
fora de línia amb `npm run data:places` i es publiquen com un fitxer per
província: Overpass és un servei públic i gratuït, i una pantalla que
arrenqués demanant-li dades dependria que estigui lliure —durant la preparació
d'aquests fitxers em va limitar la taxa dues vegades el mateix matí.

**IDEIB.** Publica `MODCOMB` amb el model d'Anderson 13 ja assignat pels autors de
l'inventari, de manera que el simulador hereta una classificació oficial i no una
d'inventada. Es descarrega per pàgines amb `outSR=4326` i
`maxAllowableOffset=0.0001`, cosa que redueix cada polígon de 14 kB a 1,5 kB. La
península i Portugal no el porten assignat: caldrà reclassificar a partir de
l'espècie i l'estructura, i serà la part metodològicament més discutible.

Esmena del 14/11/2026: la darrera frase era massa general. El documentador SIG
de l'IFN4 defineix `ModComb` —el model predominant fotointerpretat, codis 1 a
13— també per a la península, amb falta d'informació declarada a cinc
províncies (15, 27, 31, 32 i 36). El que no s'ha fet és baixar cap entrega
peninsular i mirar quants zeros porta. Mentrestant, fora de Balears el
combustible surt de la coberta del sòl (§11.21).

**ESA WorldCover.** CC BY 4.0. L'atribució viatja a cada resposta de l'API i
la pantalla l'escriu: «© ESA WorldCover project 2021 / Contains modified
Copernicus Sentinel data (2021) processed by ESA WorldCover consortium».
