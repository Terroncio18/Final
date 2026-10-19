# Bitàcola tècnica — IgnisLab

Registre de decisions, tecnologies i troballes del desenvolupament. Serveix de
material de base per a la memòria del TFG: cada decisió hi va amb el seu motiu,
les alternatives descartades i el seu estat.

Darrera actualització: 19 d'octubre de 2026.

---

## 1. Abast

Aplicació web que uneix el **monitoratge de focus actius** amb un **simulador
interactiu de propagació d'incendis forestals**, sobre la península Ibèrica i
els arxipèlags balear i canari.

Públic prioritari: població de la interfície urbana-forestal, docents i persones
interessades a comprendre el fenomen. **No** pretén substituir les eines
operatives dels serveis d'extinció.

El buit que omple, segons l'estat de l'art: les plataformes que mostren focus
actius no simulen, els simuladors no s'alimenten de deteccions en temps real, i
els més complets són comercials o d'ús institucional restringit.

---

## 2. Decisions preses

### 2.1. Arquitectura general

**Decisió.** Backend propi més frontend separat, en dos projectes independents
dins d'un mateix repositori (`web/` i `api/`).

**Motiu.** Les claus d'API (FIRMS, AEMET) i el CORS no es poden resoldre des del
navegador, de manera que cal un servidor propi. Separar-los permet instal·lar,
provar i desplegar cada meitat pel seu compte: el frontend és estàtic i el
backend no.

**Alternatives descartades.**

- *Només client, tot precalculat.* Cost zero de servidor, però obliga a limitar
  l'àmbit a unes poques zones preparades i impedeix meteorologia i focus en
  temps real.
- *Monorepo amb espais de treball npm.* S'hi va arribar a treballar i es va
  descartar: els espais de treball només gestionen la meitat JavaScript, i
  l'entorn de Python hi vivia dins ignorant-los. Era un monorepo a mitges que ja
  havia costat conflictes de noms i de versions.

**Estat.** Tancada.

### 2.2. Visor cartogràfic

**Decisió.** MapLibre GL JS 6.15, construït des de zero.

**Motiu.** És l'estàndard lliure en cartografia web, amb tessel·les vectorials i
ràster, terreny 3D i capes de dades natives. Evita mantenir un sistema propi de
càrrega progressiva.

La versió es fixa a `^6.15.0` a propòsit: les **6.4.0 i anteriors arrosseguen un
avís crític d'XSS** (GHSA-jrc7-96c5-q579).

**Alternativa descartada.** `react-map-gl` i embolcalls declaratius semblants:
pelegen amb un `CustomLayer` que manté estat propi a la GPU, que és exactament el
que necessita el simulador.

**Estat.** Tancada.

### 2.3. Framework del frontend

**Decisió.** Angular 22, en mode **zoneless** (sense `zone.js`).

**Motiu.** El criteri decisiu ha estat la comprensió: no es pot defensar davant
d'un tribunal codi que no s'entén. A més, Angular imposa l'estructura, cosa que
en un projecte en solitari de mesos estalvia re-discutir l'arquitectura cada
setmana, i porta injecció de dependències, RxJS i proves configurades de fàbrica.

El mode sense zones importa especialment en una aplicació de mapes: amb zones,
Angular dispara un cicle de detecció de canvis per cada esdeveniment que emet
MapLibre, i arrossegar el mapa va a batzegades si no s'embolcalla tot amb
`runOutsideAngular`. Sense zones aquest problema desapareix i la reactivitat es
porta amb senyals.

**Alternativa descartada.** React amb TypeScript. Es va arribar a implementar el
mapa i funcionava, però es va descartar per comprensió. El cost del canvi va ser
baix perquè `map.config.ts` i `map.style.ts` són TypeScript pur i es van
reaprofitar sense tocar res.

**Estat.** Tancada.

### 2.4. Relació entre Angular i MapLibre

**Decisió.** El mapa **no viu dins d'Angular**. Es crea una sola vegada en un
servei, que n'és l'únic propietari, i el component només posseeix l'element
contenidor.

**Motiu.** MapLibre té el seu propi canvas i el seu propi bucle de dibuixat.
Angular només ha de decidir on va el contenidor; tota la resta se li demana al
mapa de manera imperativa. Intentar que Angular governi el mapa és pelear-s'hi
constantment.

El servei publica com a senyal només allò a què la plantilla ha de reaccionar
(per exemple, si el mapa ja està llest).

**Estat.** Tancada.

### 2.5. Navegació: enquadraments fixos

**Decisió.** Navegació jeràrquica de quatre nivells, amb enquadraments fixos i
sense zoom lliure fins a l'últim:

1. Àmbit — Península, Balears o Canàries
2. Comunitat autònoma
3. Municipi
4. Zona de treball — aquí sí, navegació lliure

**Motiu.** El motiu de pes no és la càrrega del servidor, com es va plantejar
inicialment: el mapa base i el relleu venen d'Esri i de Mapzen, i FIRMS retorna
poques dades encara que l'enquadrament sigui enorme. **El motiu real és el
simulador**: un autòmat cel·lular necessita una graella fixa, i la Península a 30
m són uns 10.000 milions de cel·les. El model obliga a treballar sobre un domini
acotat; no és una optimització, és una condició del model.

Sí que pesa, en canvi, la cartografia de combustible: 1,5 MB només per a la vall
de Sóller.

**Estat.** Tancada. Falta implementar-la.

### 2.6. Domini de simulació

**Decisió.** Una **finestra de mida fixa centrada en el punt d'ignició** (ordre
de 30 × 30 km), no el polígon del municipi.

**Motiu.** Els incendis no respecten límits administratius. Els de la Sierra
Oeste de Madrid del juliol de 2026, que són a la motivació del treball, van
creuar diversos termes municipals. Retallar la simulació al municipi trencaria
el model justament en els casos que més importen. A 30 m, 30 × 30 km són un
milió de cel·les, que a la GPU van sobrades.

**Conseqüència a comunicar a la interfície.** El domini pot ser més gran que el
municipi des del qual s'hi ha entrat, de manera que l'usuari veurà foc fora del
terme que havia triat. És correcte, però s'ha d'explicar perquè no sembli un
error.

**Alternatives descartades.** El polígon del municipi (trenca el model) i una
finestra ajustable per l'usuari (fa que el cost i el temps de càlcul variïn entre
execucions).

**Estat.** Tancada. Falta implementar-la.

### 2.7. Cartografia base i relleu

**Decisió.** Imatgeria d'Esri World Imagery i elevació de les tessel·les
Terrarium de Mapzen. Mapa pla amb ombrejat de relleu, sense malla 3D.

**Motiu.** Totes dues fonts són globals, gratuïtes i sense clau, de manera que el
visor cobreix tot l'àmbit sense preprocessament. L'ombrejat fa llegible
l'orografia, que en incendis importa, sense pagar el cost del terreny en tres
dimensions.

Les dades d'elevació es carreguen igualment encara que el mapa sigui pla: **el
pendent és un dels tres factors de Rothermel**, al costat del combustible i la
meteorologia.

**Estat.** Oberta — vegeu 3.2.

---

## 3. Decisions pendents

### 3.1. Llenguatge del backend

Sense decidir. L'API que serveix el navegador —proxy de FIRMS amb memòria cau,
proxy d'AEMET i IPMA, i servir la cartografia filtrada— és igual de senzilla en
qualsevol llenguatge.

On hi ha diferència real és en el **preprocessament de la cartografia**:

| Opció | A favor | En contra |
| --- | --- | --- |
| Python | `rasterio`, `geopandas`, `shapely`, `pyproj`. És l'estàndard del camp i el que fa servir la literatura de modelització d'incendis. | Un llenguatge més al projecte. |
| Java | GeoTools i JTS són industrials; `shapely` no és més que un embolcall de JTS. | Molta més cerimònia i més codi per als mateixos cinc *endpoints*. |
| Node | Un sol llenguatge i un sol *toolchain* en tot el que es desplega; tipus compartits amb el frontend. | En ràster l'ecosistema és fluix. |

**Observació que desbloqueja la decisió.** El preprocessament no corre en
producció: és una feina per lots que es llança a mà i deixa fitxers. Pot ser un
script de Python encara que l'API sigui de Node o de Java.

### 3.2. Model digital d'elevacions

Ara mateix Terrarium, per comoditat. L'estat de l'art cita el **Copernicus DEM
GLO-30**, que té més qualitat. Si a la memòria es defensa la precisió del
terreny, caldrà reconsiderar-ho.

### 3.3. Polígons sense model de combustible

A l'inventari balear, `MODCOMB = 0` vol dir «sense informació, es recollirà en
visita de camp», i són **5.471 dels 11.654 polígons**, gairebé la meitat. Què en
fa la simulació és una decisió oberta i una limitació que caldrà declarar.
Confondre'ls amb terreny no combustible convertiria mitja illa en tallafocs.

---

## 4. Coneixement tècnic adquirit

Troballes que han costat temps i que convé no redescobrir.

**L'ordre de les tessel·les d'Esri.** El servei REST d'ArcGIS fa servir
`{z}/{y}/{x}`, amb la fila abans que la columna, i no el `{z}/{x}/{y}` habitual
de MapLibre. Amb l'ordre equivocat el mapa carrega tessel·les reals però
col·locades al lloc que no toca: sembla que funcioni.

**El *worker* de MapLibre.** MapLibre tria el nom del fitxer del seu *worker* en
temps d'execució, cosa que ni Vite ni esbuild poden seguir, de manera que el
compilat no inclou cap *worker* i **el mapa no carrega ni una tessel·la**. A
Angular es resol copiant el fitxer des de `node_modules` com a recurs estàtic
(`angular.json`) i apuntant-hi amb `setWorkerUrl('maplibre-gl-worker.mjs')`.

**El cel no es pot declarar dins de l'objecte d'estil.** MapLibre 6 rebutja un
membre `sky` a l'estil, i en rebutjar-lo tomba l'estil sencer sense avisar:
mapa en blanc i càmera congelada a la posició inicial. Va amb `map.setSky()`
després de carregar.

**Un gestor d'`error` al mapa val el minut que costa.** Totes les fallades
anteriors es manifesten igual —mapa negre— i el gestor les distingeix a la
consola en lloc de deixar-te endevinar.

**Capa de fons i terreny 3D.** Amb terreny activat, el terra és la malla del
terreny i una capa `background` no el pinta. Per a un mapa de relleu cal el
tipus de capa `color-relief`, que sí que es drapeja sobre el terreny.

**El `localhost` a Windows.** Vite escolta per defecte només a `::1`, de manera
que `127.0.0.1` rebutja la connexió. Convé fixar `host: '127.0.0.1'`.

---

## 5. Fonts de dades

| Font | Dada | Cobertura | Estat |
| --- | --- | --- | --- |
| Esri World Imagery | Imatgeria | Global | En ús |
| Mapzen Terrain Tiles | Elevació (Terrarium) | Global | En ús |
| NASA FIRMS (VIIRS 375 m) | Focus actius | Global | Investigada |
| IDEIB — IV Inventari Forestal | Model de combustible | Balears | Investigada |
| MFE25 (MITECO) | Espècies i estructura | Espanya | Pendent |
| COS (DGT) | Ús i ocupació del sòl | Portugal | Pendent |
| AEMET OpenData | Meteorologia | Espanya | Pendent |
| IPMA | Meteorologia | Portugal | Pendent |

### 5.1. Focus actius — NASA FIRMS

L'API d'àrea és
`/api/area/csv/[MAP_KEY]/[FONT]/[oest,sud,est,nord]/[DIES]`, amb **un màxim de
cinc dies** per consulta i un límit de **5.000 transaccions cada deu minuts** per
clau. Cal una `MAP_KEY` gratuïta.

Les tres plataformes VIIRS en temps gairebé real (S-NPP, NOAA-20 i NOAA-21) donen
375 m, la millor resolució disponible operativament. La confiança ve codificada
com a lletra (`l`/`n`/`h`) a VIIRS i com a percentatge a MODIS.

Observació de camp: a l'octubre, les deteccions sobre la Península tenen potències
radiatives d'entre 0,4 i 19 MW, que són cremes agrícoles i de rostoll, no incendis
forestals. Per provar el simulador amb foc de debò cal esperar a l'estiu.

### 5.2. Combustible — IDEIB

El IV Inventari Forestal de les Illes Balears publica el camp `MODCOMB` amb el
model d'**Anderson 13** ja assignat pels autors de l'inventari. Fer-lo servir en
lloc de reclassificar les espècies del MFE25 pel nostre compte és important per al
treball: el simulador hereta una classificació oficial i no una d'inventada.

Es descarrega per pàgines del servei ArcGIS amb `outSR=4326` i
`maxAllowableOffset=0.0001` (uns 11 m, per sota de la precisió de 1:25.000), cosa
que redueix cada polígon de 14 kB a 1,5 kB.

La península i Portugal no porten el model assignat, de manera que caldrà definir
i documentar una reclassificació a partir de l'espècie i l'estructura. Serà la
part metodològicament més discutible del treball.

---

## 6. Canvis de rumb

| Data | De | A | Motiu |
| --- | --- | --- | --- |
| 19/10/2026 | Prototips a `Codex/` i `Claude/` | Projecte nou a `Pere/Final` | Els prototips servien de referència, no de base |
| 19/10/2026 | React + Vite | Angular 22 zoneless | Comprensió: cal poder defensar el codi |
| 19/10/2026 | Monorepo amb espais de treball | `web/` i `api/` separats | Els espais de treball només gestionaven la meitat JavaScript |
| 19/10/2026 | Zoom lliure | Enquadraments fixos fins al municipi | El simulador necessita un domini acotat |
