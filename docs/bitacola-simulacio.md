# Bitàcola tècnica — IgnisLab · Fase 2: el simulador i la vista 3D

Registre de **decisions preses**: què s'ha decidit i per quins motius. Material
de base per a la memòria del TFG.

Continuació de [bitacola.md](bitacola.md), la fase 1 —el mapa i el formulari—,
tancada el 5 de novembre de 2026.

Darrera actualització: 13 de novembre de 2026.

Les seccions van numerades **des del §10**. El codi cita les decisions pel seu
número als comentaris —§2.29, §3.4— i dos documents que comencessin tots dos a
§1 farien ambigua qualsevol referència. Res d'aquí no renumera res d'allà.

---

## 10. Abast

El que ha de fer aquesta fase: propagar un foc sobre el domini que el formulari
deixa triat, i mostrar-lo. Fins ara el quart pas acaba en un botó desactivat i
una frase —«el simulador encara no existeix»— i això és exactament el forat que
s'obre aquí.

El que hereta de la fase 1, i que no es torna a discutir:

- **El domini** (§2.5, §2.27): 1024 × 1024 cel·les de 30 m, 30,7 km de costat,
  retallat al voltant del punt d'ignició i sense seguir cap línia
  administrativa. Són tres números lligats: la graella és el que la GPU aguanta,
  la cel·la el que les dades resolen honestament, i el costat el que surt de
  multiplicar-los.
- **El punt d'ignició a la URL** (§2.26): una simulació sencera és un enllaç, i
  l'estat no viu dins de cap component.
- **L'elevació i la pendent del domini, llegides al navegador** (§2.28) de
  tessel·les Terrarium, ja per cel·la, amb el relleu ombrejat que el quart pas
  dibuixa com a comprovació que el terreny llegit és el de sota.
- **El mapa per sobre de les rutes** (§2.20): MapLibre i el seu context WebGL
  sobreviuen cada pas, de manera que la vista de simulació no comença amb un
  mapa nou ni amb una càmera per col·locar.

El que no entra: res del mapa. Les pendents 3.4, 3.7 i 3.11 es queden a la
fase 1, obertes, i no toquen el simulador.

---

## 11. Decisions preses

### 11.1. Els tallafocs construïts no entren, i el motiu és la cobertura

Preguntat el 5/11/2026: es poden ensenyar al quart pas els tallafocs ja
construïts del municipi? Es pot, i hi ha servei per fer-ho, però no amb una
cobertura que canvia de territori en territori.

El que hi ha, comprovat contra els serveis i no només llegit:

| Font | Què dona | Com va |
| --- | --- | --- |
| Diputació de Barcelona, `incendis.diba.cat` | Franges **executades** amb any d'obra (`EXECUCIO`, `Any_treballs`), àrees de gestió prioritària, xarxa viària bàsica | ArcGIS REST, GeoJSON per bbox, CORS, CC0. Un domini sencer: 3.317 polígons i 940 kB filtrant per executat i generalitzant a 11 m |
| ICNF, `si.icnf.pt/wfs/bdg` | Rede primária de faixas de gestão de combustível, 7.229 trams | WFS 2.0, GeoJSON, CORS, bbox. Només la xarxa **primària**, i sense simplificació en servidor: 6,3 MB per domini |
| Generalitat Valenciana, `terramapas.icv.gva.es` | Cortafuegos, fajas, punts estratègics | WFS i WMS, CC BY, però el WFS **només dona GML** |
| REDIAM (Andalusia) | Inventari d'infraestructures preventives en monte públic | Diu WMS-WFS; l'endpoint no surt a la pàgina, que el pinta amb JS |
| OpenStreetMap | `man_made=cutline` + `cutline=firebreak` | Overpass, CORS, universal. 3.745 vies a la caixa ibèrica, 686 a Portugal continental i **9** a la província de Barcelona |

No hi ha capa estatal espanyola: el borrador del Plan Forestal Español 2050
encara proposa elaborar-ne una d'harmonitzada. A Galícia hi ha visor de faixes
secundàries però no servei.

Decidit: **no s'hi posen**. El problema no és tècnic —la via de la Diputació
entra en 940 kB per domini i distingeix l'executat del planificat, que és
justament el que es volia— sinó que la cobertura és parcial i desigual. Un mapa
que dibuixa tallafocs on hi ha dades i no en dibuixa on no n'hi ha **afirma que
allà no n'hi ha**, i no és això el que se sap. Mentre la font sigui una comarca
aquí i una xarxa primària allà, el silenci és més honest que la mitja veritat.

Queda escrit per si algun dia la cobertura canvia, i perquè la part de fons
—els tallafocs com a cel·les sense combustible a la malla de 30 m— és una
pregunta del model i no del mapa: tornarà amb la 12.5.

### 11.2. La vista 3D és el terreny de MapLibre, i no un segon motor

Decidit el 5/11/2026, després de comprovar-ho i no abans. La pregunta era la
12.4 —amb què es dibuixa el 3D— i la va obrir la revisió del prototip FireCast,
que fa la mateixa feina amb Three.js i un quadtree propi.

El que es va comprovar al codi de `maplibre-gl` 6.15.0:

- `LAYERS_TO_TEXTURES` és `{background, fill, line, raster, hillshade,
  color-relief}`: totes aquestes capes es drapegen soles sobre el terreny.
- `CustomLayerInterface.renderToTerrainTile` (experimental, amb
  `terrainTileRevision` per invalidar) drapeja **també una capa WebGL pròpia**,
  amb l'espai de retall (-1, -1) al racó sud-oest de la tessel·la i (1, 1) al
  nord-est.

Per tant el foc podrà anar sobre el relleu tant si és una capa `fill` o
`raster` com si acaba sent un *shader* nostre, i la 12.3 —que donava per fet
que drapejar un `CustomLayer` era més feina que pintar sobre un pla— ja no
descriu aquesta versió de la biblioteca.

Decidit: **el 3D són dues línies sobre el que ja hi ha**. `setTerrain` amb el
`raster-dem` que la capa d'ombrejat llegeix des del primer estil, la imatgeria
d'Esri que ja és al mapa, i les vores i el quadrat del domini drapejats de
franc. Ni Three.js, ni tessel·les pròpies, ni un segon llenç.

El que es va mesurar el mateix dia, amb el domini de Sóller i el d'Espot:

| | FireCast | Aquí |
| --- | --- | --- |
| Cobertura | Sóller, 45 × 45 km | qualsevol domini de la jerarquia |
| Preparació | 661 tessel·les cuites, 161 MB al disc | cap |
| Imatgeria | mosaic z14 amb centre z16 | Esri en viu fins a z19 |
| Elevació | Terrarium z12 amb centre z14 | Terrarium fins a z15 |
| Codi afegit | Three.js, ≈2 MB | **+0,4 kB** a la xarxa |
| Fotogrames | — | 62/s amb el domini sencer a la vista |

Dues coses que se'n deriven i que no són òbvies:

- **Exageració vertical 1× i no 1,6×**, que és el que fa servir el prototip. La
  pendent de cada cel·la és una entrada del model (§2.28): una muntanya inflada
  per a la foto seria un segon terreny, diferent, sota els mateixos números.
- **La inclinació viatja dins de l'enquadrament**, no en un moviment de càmera a
  part (§13.2), i el 3D l'encén el `LevelsService` com qualsevol altra cosa d'un
  nivell (§2.29): només el darrer pas trepitja un tros de terra prou petit
  perquè el relleu vulgui dir res. Comprovat que tornant enrere el mapa torna a
  ser pla, amb el terreny a `null` i la inclinació a zero.

El que no dona i el prototip sí: copes d'arbre en 3D, oclusió dels valls i fum
de partícules. Si algun dia es volen, són feina a part i no surten d'aquí.

Esmena del mateix dia, i de fons: **el 3D és del simulador, no del mapa**. El
formulari torna a ser pla a tots els passos, el d'ignició inclòs. El relleu
inclinat ajuda a entendre per on correrà un foc i no ajuda gens a assenyalar un
lloc, que és l'única cosa que es demana mentre es tria: un terreny en
perspectiva mou el punt sota el cursor i amaga el que queda darrere d'una
carena.

El que es va construir no es llença, canvia de mà: `setTerrain3D()` i
`setOrbit()` es queden al `MapService`, i qui els encendrà és la vista de
simulació. El `LevelsService` els apaga a tots els nivells, que és la mateixa
regla de sempre (§2.29) aplicada a una capacitat que ara viu en una altra
pantalla. El que es comprova aquí —que el drapejat existeix, que va a 62
fotogrames, que no cal Three.js i que surt per 0,4 kB— es comprova igual.

### 11.3. Al relleu es gira, i només es gira

Decidit el 5/11/2026, que tanca la 12.6. Es va decidir per al quart pas del
formulari i, amb l'esmena de la §11.2 del mateix dia, **val per a la vista de
simulació**, que és on el relleu ha acabat. Un relleu que només es pot mirar des
d'un angle és una fotografia cara, i la pregunta que la §11.2 deixava oberta
era si el ratolí hi podia entrar, quan el mapa es crea amb
`interactive: false` perquè la portada és una imatge per clicar (§2.9).

Decidit: **el gir i la inclinació sí; el desplaçament i el zoom no.** L'enquadrament
és de cada pas (§2.8) i el domini és el subjecte; poder-se'n allunyar amb la
roda convertiria el quadrat en una cosa que es perd de vista.

El detall que fa que no hi hagi cap conflicte a resoldre: **MapLibre gira amb el
botó dret i amb Ctrl**, no amb l'esquerre. De manera que el botó esquerre
continua volent dir «el foc comença aquí» (§2.26) sense desambiguar res, i es
pot girar el terreny amb el punt posat. Comprovat les dues direccions: una
arrossegada amb el botó dret no mou el punt, i un clic esquerre el torna a
col·locar mentre el mapa està girat 99°.

Tres decisions petites a dins:

- **Gir lineal i no el circular de MapLibre.** El predeterminat segueix el
  punter al voltant del centre com una roda, de manera que la mateixa
  arrossegada gira cap a un costat per sobre del centre de la pantalla i cap a
  l'altre per sota. Sobre un plànol amb el nord amunt s'entén; sobre un relleu
  desorienta.
- **L'enquadrament respecta l'angle triat.** Moure el punt reenquadra el domini
  (§2.27), i tornar el nord amunt desfaria la vista que l'usuari acabava de
  buscar. Pla, el nord torna amunt tot sol.
- **Amb els dits, dos dits inclinen.** Girar-hi voldria dir encendre el gestor
  del pessic, i aquell porta el zoom a sobre.

El que queda fora i convé dir-ho: **amb el teclat no es gira**. El gestor de
teclat de MapLibre no separa el gir del desplaçament i del zoom, de manera que
encendre'l obriria les dues portes que aquesta decisió tanca. L'òrbita és, per
ara, només de punter.

### 11.4. El simulador és una pantalla, amb ruta pròpia i pestanya pròpia

Decidit el 5/11/2026. El botó «Obrir la simulació» del quart pas estava
desactivat des que existeix; ara porta a `/simulador/:region/:province/:municipality/:point`
i s'obre en una pestanya nova.

**Els mateixos quatre segments que el formulari**, perquè les dues pantalles
anomenin igual la mateixa simulació: el que §2.26 va guanyar —que una simulació
sencera és un enllaç— val per a les dues, i una adreça es pot copiar d'una
barra a l'altra.

**Fora del `MapShell` i no a dins.** El `MapShell` existeix perquè el mapa
sobrevisqui els passos del formulari (§2.20), i això aquí no val res: en una
pestanya nova no hi ha cap mapa calent per heretar. A canvi, a dins arrossegaria
el que la pantalla no vol —la barra de dalt i la capa de deteccions—, de manera
que la ruta del simulador és germana i no filla. Va declarada primera per la
mateixa raó que `simulacio`: si quedés per sota, el paràmetre `:scope` es
menjaria la paraula.

**Pestanya nova i no la mateixa**, que és el que demana el que hi ha a l'altra
banda: tornar enrere no pot voler dir perdre el punt que s'acabava de triar
després de baixar quatre nivells. `target="_blank"` amb `rel="noopener"`.
Navegar-hi dins de la mateixa pestanya també funciona —l'encaminador destrueix
el `MapShell`, que s'emporta el seu mapa, i la pantalla en crea un de seu—,
cosa que és el que passa si algú enganxa l'adreça a mà.

**La barra de dalt desapareix** mentre la pantalla hi és. Els seus botons
d'àmbit farien volar la càmera fora del domini i «Crear simulació» en començaria
una segona a sobre de la primera. Ho demana un senyal d'arrel, `Chrome`, que la
pantalla apaga en entrar i torna a encendre quan es destrueix —la mateixa forma
que fa servir el formulari per apagar les deteccions (§2.21), i pel mateix
motiu: cobreix el botó de tornar, la creu i tancar la pestanya sense que cap
dels tres ho hagi de recordar.

El que la pantalla ensenya el primer dia: el domini en relleu, a 1× i orbitable
(§11.2, §11.3), amb el punt d'ignició, el quadrat del domini i el contorn del
municipi com a context —que el foc creuarà—, els tres números del domini, i una
frase dient que el model encara no existeix. No s'hi inventa cap control:
mentre no hi hagi §12.5 no hi ha res a controlar.

Comprovat el mateix dia: el botó obre l'adreça correcta, la pantalla surt sense
barra, el terreny i l'òrbita hi són, i tornant al formulari la barra hi torna.

### 11.5. El terreny porta noms, i els noms surten d'un fitxer per província

Decidit el 5/11/2026. Un relleu sense topònims és una maqueta: el que converteix
una vall en un lloc és que es digui Sóller. FireCast en posa sis, escrits a mà i
només per a Sóller —el seu README ho diu: les referències urbanes són
sintètiques.

**D'on surten.** Els fitxers administratius porten polígons i cap nucli de
població: el centre del terme de Sóller és una muntanya, no el poble, de manera
que una etiqueta al centroide posa el nom al lloc equivocat. Els nuclis i els
cims són d'OpenStreetMap.

**Preparats fora de línia, un fitxer per província** (`npm run data:places`),
com els municipis i per la mateixa raó (§2.25), més una de nova: Overpass és un
servei públic que pot anar lent o dir que no, i una pantalla no pot dependre
d'això per obrir-se.

**Retallats per extensió i no pel límit provincial**, amb un marge de 0,2°: el
domini fa 30,7 km i creua fronteres contínuament, i un fitxer tallat pel límit
deixaria mitja vista sense noms.

Què s'hi posa, mesurat sobre un domini de la Serra de Tramuntana:

| | dins de 30 × 30 km | |
| --- | --- | --- |
| `place` = city, town, village | 19 | tots |
| + hamlet, suburb, locality | 1.250 | fora: és soroll |
| `natural` = peak amb nom i cota | 357 | els **12** més alts |

Les capes són `symbol`, que és una de les coses que MapLibre **no** drapeja
(§13.1): el text es queda dret sobre el relleu en lloc d'embolcallar la
carena, que és el que faria una capa d'etiquetes ràster.

Dues coses apreses pel camí, totes dues per haver-ho mirat:

- **Els cims van fer fora els pobles.** Amb els 357 a la capa, la col·lisió
  d'etiquetes es resolia a favor seu i Sóller, Deià i Valldemossa
  desapareixien darrere d'una paret de «Puig de… 1.113 m». El tall a dotze no
  és estètica: és el que torna a deixar els pobles a la vista.
- **Tallar al domini és part de la decisió.** Amb la província sencera a la
  capa, la meitat inferior de la pantalla era el pla de Mallorca escrit a sobre
  d'una vista que parla de la serra. Es retalla al client abans de pintar,
  perquè cada nom descartat és també una etiqueta menys per encaixar.

**Esmena del 5/11/2026: com es trien els cims.** Una província no hi cap
sencera —Lleida en té 7.833 i el fitxer passa del megabyte—, i la primera
versió es quedava amb els 600 més alts. Triar per alçada és triar per lloc:
els 600 més alts de Lleida passen tots dels 2.000 m i per tant són tots del
Pirineu, de manera que 844 dels seus 1.187 dominis possibles es quedaven sense
cap cim, i 479 dels 687 de Barcelona, on guardant-ho tot no n'hi ha ni un. El
29% dels dominis sortien muts, en una pantalla que existeix per ensenyar el
pendent.

Ara la tria es reparteix: una graella de 5 km sobre la província i el cim més
alt de cada cel·la. És el que el client ja fa dins de la vista, però fet abans
i sobre tot el territori, de manera que el que domina una comarca sobreviu a
600 m igual que a 2.900.

| tria | cims | MB | dominis sense cap cim |
| --- | --- | --- | --- |
| els 600 més alts | 39.125 | 5,6 | 29,0% |
| **graella de 5 km, 1 per cel·la** | **32.066** | **4,6** | **5,6%** |
| graella de 5 km, 2 per cel·la | 53.591 | 7,7 | 5,5% |
| tot, sense tria | 129.655 | 18,5 | 5,5% |

Guanya en els tres eixos alhora: menys cims, fitxers més petits i sis vegades
menys dominis muts. El 5,6% és el terra —amb tots els cims que OSM té encara
és el 5,5%, perquè Tierra de Campos i la campinya de Còrdova no en tenen amb
nom, i això és una dada certa i no una llacuna—, i les variants de dos per
cel·la o de 3 km paguen 3,4 MB per donar al client més candidats dels que una
pantalla pot escriure, que en són dotze.

La cel·la és quadrada a terra i no en graus: a 42° un grau de longitud són
83 km, i un pas fix en graus aprimaria Galícia més que Andalusia.

**Les 81 províncies, preparades.** 73.126 topònims —41.060 nuclis i 32.066
cims— en 11,2 MB; el fitxer més gros són 384 kB, Saragossa, que pel marge
porta també Pamplona i Osca. Refer-ho no costa xarxa: les respostes senceres
queden a `scripts/.cache` i el script les reaprofita, de manera que canviar el
criteri és un minut de CPU i cap consulta. El script també és tolerant: una
província que Overpass rebutgi s'anota i no s'emporta les altres vuitanta —a
la primera passada en van caure cinc, i repetir-les va ser una ordre.

Si algun dia cal densitat de llogarets, el pas no és un altre servei: és
afegir `hamlet` al script i tornar-lo a passar.

### 11.6. Corbes de nivell, tretes del relleu que ja hi és

Decidit el 5/11/2026, tancant el que faltava per igualar el mode Relleu de
FireCast. Una fotografia d'una muntanya diu on és la roca i no diu res de com
és de dreta, i la inclinació és precisament el que aquesta pantalla existeix
per ensenyar. El mapa de corbes és la resposta més antiga a aquesta pregunta i
encara la única que no s'ha d'explicar a ningú.

**Cap dada nova i cap proveïdor nou.** `maplibre-contour` (0.1.1, BSD-3-Clause,
sense dependències) registra un protocol, pren les mateixes tessel·les
Terrarium que l'ombrejat i el terreny ja llegeixen, traça les isolínies en un
worker i torna una tessel·la vectorial. El que l'estil demana és una URL. Costa
**9 kB** per la xarxa: de 319,35 a 328,29 kB.

**L'equidistància depèn del zoom**, perquè una sola no serveix per a les dues
escales d'aquesta pantalla:

| zoom | menor | major |
| --- | --- | --- |
| 10 (el domini sencer) | 200 m | 1.000 m |
| 12 | 100 m | 500 m |
| 14 | 50 m | 250 m |

Cent metres és l'equidistància d'un full 1:25.000 i és el que es llegeix bé a
dins del domini; estesa sobre els 30,7 km sencers, la mateixa xifra és una
madeixa.

Són capes `line`, que MapLibre **sí** que drapeja (§13.1), i és el que han de
ser: una isolínia que no seguís el terra seria el dibuix d'un altre turó.

Dues coses que només es veuen mirant-ho:

- **Dibuixades i invisibles.** La primera versió les va posar a 0,22
  d'opacitat: el mapa en renderitzava vint-i-cinc i a la pantalla no n'hi havia
  cap. Les xifres d'un `queryRenderedFeatures` diuen que una capa funciona, no
  que es vegi.
- **La badia venia amb isòbates.** Terrarium porta el fons del mar com a
  elevació negativa i el traçador no hi té cap opinió, de manera que el mar
  sortia amb corbes a −200 m: cert, i no té res a veure amb un incendi. Les
  capes filtren per `ele > 0`.

Les cotes només s'escriuen a partir del zoom 12 i cada 320 px de línia: tres o
quatre xifres en una vista, que és el que fa falta per saber a quina alçada
s'està sense convertir el vessant en una graella numerada.

### 11.7. El simulador és una consola, i la referència és el prototip FireCast

La pantalla era un mapa a tota sagnia amb un panell de 320 px al costat. Per a
ensenyar el terreny està bé; per a una pantalla que ha de portar entrades
meteorològiques, una línia temporal i uns resultats, no hi ha on posar-ho.

La referència és el prototip **FireCast** del directori
`Codex/incendios/firecast`, i el que se'n copia és la geometria: barra de
75 px, graella de `255px / 1fr / 304px` amb 12 px de separació, el mapa com a
targeta amb cantonada arrodonida i barra pròpia, i una barra d'estat de 34 px
a sota.

**La paleta ja era la mateixa.** El `--panel` del prototip és `#161d25` i el
d'aquí també, exactament; la resta balla un punt —`--line` `#29313b` contra
`#262f3a`, el taronja `#fa8848` contra `#ff7a3c`. Aquesta aplicació es va fer
mirant allò, de manera que la feina no era repintar sinó estructurar. Els
valors del prototip viuen a `:host` de la pantalla i no als àmbits globals: són
d'aquesta pantalla, i la portada no ha demanat moure's.

**La tipografia sí que calia.** DM Sans per al text i Manrope per als títols i
les xifres grans són bona part de com es llegeix aquella pantalla. Són al
repositori i no a Google Fonts: quatre fitxers variables de 95 kB en total, amb
l'OFL al costat (§6). Un fitxer variable per família i subconjunt cobreix tots
els gruixos, i el `latin-ext` només es baixa si la pàgina el necessita.

**El que no s'ha copiat, i per què.** El prototip porta pestanyes —Panel,
Escenarios, Resultados—, cercador, notificacions i un avatar. Són el moble d'un
producte que no existeix. La barra d'aquí porta el que hi ha: la marca, quina
simulació s'està mirant i la sortida cap al formulari. La caixa d'eines del
mapa tampoc no porta els botons de zoom del prototip, perquè a aquesta pantalla
desplaçar i fer zoom estan apagats per decisió (§11.3): els quatre controls que
hi queden —relleu, vista plana, tornar a enquadrar i capes— fan cosa.

**Les xifres de la columna dreta són inventades, totes.** El model de
propagació encara no existeix (§12.5) i la columna existeix per ensenyar on
aniran els resultats. Viuen en una sola constant anomenada `SAMPLE`, perquè un
número que surti d'allà no pugui passar per un que surti d'un càlcul, i la
pantalla ho diu **tres vegades**: a la capçalera, sota els números i a la barra
d'estat. Tres i no una perquè una captura de pantalla només se'n porta una.
El dia que hi hagi model, el que desapareix és aquella constant.

La columna esquerra és diferent i per això és de debò: vent, direcció, humitat,
temperatura i combustible són **entrades** que el model necessitarà igualment,
i construir-les ara no inventa res —simplement encara no alimenten ningú. El
botó d'iniciar és a lloc i desactivat, amb el punt d'estat en ambre en comptes
de verd: no hi ha res corrent i no n'hi haurà fins que hi hagi model.

**Un defecte que va sortir pel camí i val per a tota la casa.** En passar el
mapa a viure dins d'una targeta, l'enquadrament va deixar de funcionar i la
càmera ensenyava Mallorca sencera. Dues causes alhora:

- `goToBounds(..., true)` demana el farciment que esquiva el panell del
  formulari, que tapa la dreta del llenç. Aquí el mapa té columna pròpia i no
  hi ha res a esquivar: reservar 320 px en una targeta de 450 d'ample deixava
  el domini en una cinquena part de l'amplada.
- El relleu s'encenia en un efecte posterior al de la càmera. La §13.2 ja ho
  diu: la inclinació ha d'anar **dins** de l'enquadrament, de manera que
  `setTerrain3D()` ha de córrer abans i al mateix efecte. Separar les capes en
  un efecte propi semblava més net i trencava justament això.

El pressupost d'estils per component d'`angular.json` passa de 4/8 kB a
20/28 kB. El full d'aquesta pantalla en fa 17: és un tauler de tres columnes
amb una vintena de blocs, i no un component qualsevol que se n'ha anat de mare.
El límit segueix sent un límit.

Comprovat al navegador el 13/11/2026 a 1680 × 945: la consola enquadra el
domini de Sóller amb el relleu inclinat, els topònims i el contorn del
municipi; el commutador Relleu/Pla torna la càmera a zenital i el nord amunt;
les capes apaguen corbes i topònims; i la llegenda s'aixeca per sobre dels
crèdits d'Esri i de l'escala, que són seus i no nostres de moure.

### 11.8. El mapa del simulador és només el domini

El que es simula és el quadrat. El que hi ha a fora no el toca el model, i un
mapa que el segueix ensenyant convida a llegir-hi un incendi que no s'hi
calcula mai —la muntanya del costat es veu igual de bé, i no hi ha res que
digui que allà no hi passa res.

Decidit: a la pantalla del simulador, **fora del requadre no es veu res**. És
un sol polígon, al mateix origen que el quadrat, amb l'anella exterior ampla i
el domini com a **forat**. Un forat i no un segon polígon, perquè una anella
dins d'una altra és el que el GeoJSON entén per forat i el que el renderitzador
ja sap deixar buit.

Funciona en relleu perquè és una capa `fill`, que MapLibre **sí** que drapeja
(§13.1): la pintura segueix el terra en comptes de surar-hi per sobre, de
manera que el quadrat en perspectiva es llegeix com un bloc de terreny i no com
una finestra retallada al davant.

L'anella exterior són **tres graus** de marge —uns 330 km— i no el món sencer.
La càmera d'aquesta pantalla no es pot desplaçar ni allunyar (§11.3), de manera
que tres graus són molt més enllà de l'horitzó; el món sencer seria un polígon
que cobreix totes les tessel·les de tots els zooms per a terreny que no surt
mai a la pantalla.

**La línia del domini ha baixat per sota de la màscara.** El contorn va
exactament damunt de la vora del forat: dibuixat abans, la màscara li menjava
la meitat de l'amplada. Ara va just després, que a més és on li toca —és el
límit del que es mira.

Els topònims no han calgut tocar-los: el servei que els carrega ja els retalla
a l'extensió del domini (§11.5), i com que el domini és un quadrat alineat amb
els eixos, aquella extensió i el quadrat són la mateixa cosa.

**El contorn del municipi, en canvi, s'ha tret.** Hi era perquè aquesta
pantalla era el mapa d'un lloc, i el comentari del codi ho deia: el municipi és
context i no un límit de la simulació. Dins del sandbox la frase es gira sola —
l'única vora que vol dir res és la del domini, i una línia administrativa que
el travessa és justament l'única cosa dibuixada a terra que el foc no veu. El
fitxer de municipis se segueix llegint, perquè el nom és el que diuen la barra
i la fitxa; el que no es dibuixa és la ratlla.

Apagada per defecte, i el formulari no l'encén. Allà la pregunta és on cau el
quadrat, i per respondre-la cal veure justament el que aquí s'amaga.

Comprovat al navegador el 13/11/2026: el simulador ensenya el bloc de Sóller
amb tots els noms a dins i res a fora, i el quart pas del formulari segueix amb
la Serra sencera a la vista.

### 11.9. El relleu del sandbox s'il·lumina, i la muntanya no s'infla

Comparat el sandbox amb el prototip, la diferència no era de dades:

| | FireCast | Aquí |
| --- | --- | --- |
| exageració vertical | 1,6× | **1×** |
| llum | hemisfèrica 0,75 i direccional 2,0, amb Three.js | ombrejat de MapLibre a 0,3 |
| imatgeria | Esri z16, retallada per a Sóller | Esri fins a z19, en directe |
| elevació | Terrarium z12, amb el centre a z14 | Terrarium fins a z15 |

**El que fa que el seu es vegi així no és haver-lo precuinat.** La seva
imatgeria és z16 preparada i la nostra arriba a z19 en directe; el seu DEM és
z14 al centre i el nostre z15. A l'escala d'un domini de 30 km, el que servim
és igual o millor. La diferència són dos ajustos, i per tant es reprodueix a
qualsevol punt de la península sense preparar-hi res.

Dels dos, **l'exageració no es toca**: la §11.2 ja va decidir 1× perquè la
pendent de cada cel·la és una entrada del model (§2.28), i el panell del quart
pas publica una pendent màxima. Amb 1,6× la imatge ensenyaria una muntanya que
no és la que ha donat aquell número, i la pantalla diria dues coses alhora. El
model no se n'assabentaria —llegeix el DEM i no la malla—, però això no és un
argument a favor: és el motiu pel qual l'engany no es notaria.

L'altre sí. L'ombrejat puja de 0,3 a 0,62 **només al simulador**, amb l'ombra
més fonda i la llum alta en el mateix to càlid que fa servir el prototip,
`#fff0d3`, i la fotografia guanya un punt de saturació i de contrast. Res
d'això toca la geometria: mou llum i color, i la pendent segueix sent la que
és.

Per què aquí sí i a la portada no: la §2.6 va decidir que sobre una fotografia
l'ombrejat havia de ser un suggeriment, i tenia raó per al mapa d'un país, que
porta la seva pròpia llum. Trenta quilòmetres de serra és l'altre cas —a
aquesta mida la fotografia s'aplana, els valls es tanquen i cap a on mira un
vessant, que és per on corre un foc, deixa de llegir-se.

El que segueix sense donar-se i el prototip sí: copes d'arbre en 3D, oclusió
dels valls i fum. Són d'un renderitzador propi i la §11.2 ja les va deixar
fora.

---

### 11.10. Al sandbox es desplaça i s'hi fa zoom, fins a la paret

La §11.3 va decidir que al relleu es gira i només es gira, i el motiu era que
l'extensió la tria el pas (§2.8): un mapa del qual es pot sortir respon una
altra pregunta de la que el formulari ha fet. **El que ho canvia és el
sandbox** (§11.8): fora del quadrat ja no es dibuixa res, de manera que
allunyar-se'n no és una altra vista, és una de buida.

Amb això, moure's a dins no té cap inconvenient i sí un avantatge —mirar un
vessant de prop és justament el que demana una pantalla sobre pendents—, així
que s'encenen l'arrossegament i la rodeta. **El quadrat és la paret:**

- **El centre de la càmera es manté dins del domini amb un domini de marge**
  a cada banda. És espai de sobres i no un ajust estret: el quadrat es pot
  empènyer fins a sortir de la targeta. El límit no hi és per impedir-ho
  —ningú que faci servir aquesta pantalla per al que és l'hi traurà— sinó
  perquè el moviment s'acabi en algun lloc en comptes de continuar sobre
  terreny buit indefinidament. El botó de tornar a enquadrar és el camí de
  tornada.

  Dos intents anteriors, perquè el següent que hi toqui no els repeteixi.
  `maxBounds` **no serveix amb la càmera inclinada**: demana que la *vista*
  càpiga a dins, i una de 55° cobreix molt més terreny que el quadrat que
  enquadra, de manera que MapLibre ho complia de l'única forma que podia
  —acostant-se fins que el trapezi visible hi cabia, i el domini s'obria a
  500 m d'amplada en comptes de trenta quilòmetres. Després, fixar el centre al
  quadrat **menys mitja pantalla** mantenia el bloc omplint la targeta, però al
  zoom que enquadra el domini no deixava res a moure: correcte i incòmode. La
  comoditat guanya, perquè el que hi havia en joc era una vista lletja i no una
  manera d'equivocar-se.
- El **zoom mínim és el que enquadra el domini**, demanat a `cameraForBounds()`
  amb els mateixos límits en comptes d'endevinar-lo: allunyar s'atura
  exactament quan el quadrat sencer és a la pantalla i no ensenya mai una vora
  de no-res.
- El **màxim és 16**, que són uns trenta metres de terra per píxel: la mida de
  la cel·la de la graella (§2.27). Més a prop, la fotografia són píxels
  engrandits i la malla és més fina del que el DEM pot alimentar.

Girar segueix on era, al `setOrbit()`: allò és del relleu i això és de
l'enquadrament. El botó de tornar a enquadrar de la caixa d'eines és la sortida
quan un s'ha arraconat.

Comprovat al navegador el 13/11/2026: la rodeta acosta fins a Sóller i s'atura;
arrossegant s'arriba a la vora del domini i la màscara apareix sense que la
càmera la travessi; i allunyant a fons es torna al bloc sencer sense marge buit.

### 11.11. El darrer pas del formulari tria el centre, no on comença el foc

El quart pas demanava «fes clic al mapa per marcar on comença el foc», i el
quadrat es retallava al voltant d'aquell punt. Les dues coses anaven juntes
perquè la pantalla no en sabia fer dues.

Ara sí. El clic del formulari **tria el centre del domini** i prou; on
s'encén, o on s'encenen, es decideix a dins del simulador, amb l'eina
d'ignició que hi ha a la columna de configuració.

El motiu és on es pren cada decisió amb la informació a la vista:

- **El centre és una pregunta de mapa pla.** El domini fa 30,7 km i el que es
  tria és quin tros de territori s'estudia. Per a això el formulari és el bon
  lloc: el municipi sencer a la vista, el nord amunt i cap perspectiva movent
  el punt sota el cursor (§11.2).
- **On comença el foc és una pregunta de terreny.** Depèn del vessant, de la
  carena que el pararà i de per on puja. Demanar-ho sobre una fotografia plana
  d'un municipi sencer és demanar-ho sense ensenyar el que ho decideix, i el
  simulador ja té el relleu, la inclinació i l'eina.
- **I no n'hi ha un de sol.** Un incendi pot tenir més d'un focus, i un camp a
  la URL amb un punt no ho podia dir mai.

Canvia el text i prou. Els identificadors segueixen dient `ignition` —el pas,
la font, les capes, `setIgnition()`— i el segment de la URL segueix sent el
mateix `@lon,lat`, que ara vol dir el centre. **El canvi de nom és una feina
seva**, mecànica i ampla, i barrejar-la amb aquest text hauria amagat l'un dins
de l'altre.

**I no s'insisteix.** Hi va haver una versió amb un bloc destacat, a tots dos
estats del panell, explicant que allò no era el punt d'ignició. Va durar poc i
el motiu per treure'l és bo: qui llegeix «fes clic al mapa per marcar el centre
de la simulació» no entén que estigui marcant un foc. Una frase que diu què és
una cosa no necessita una segona que digui què no és; afegir-la és tractar el
lector de distret i omplir el panell de lletra que no es llegirà.

La llegenda del simulador sí que ho diu, perquè allà la marca conviu amb la
resta: «Centre del domini» on deia «Punt d'ignició». El que encara no ho diu és
la marca del mapa, que segueix sent el punt taronja amb halo que es va dibuixar
quan volia dir un incendi; canviar-la per una marca de centre és feina de la
12.7, amb el canvi de nom.

### 11.12. El sandbox diu el terreny que ensenya

La pantalla que existeix per ensenyar la pendent (§11.6, §11.9) no en donava
cap xifra: l'elevació del domini només la llegia el quart pas del formulari
(§2.28), i el simulador dibuixava el relleu sense dir-ne res.

Decidit el 13/11/2026: la columna de configuració porta, sota l'àrea d'estudi,
**l'altitud mínima i màxima i la pendent mitjana i màxima del domini**. Motius:

- **És l'única part de la consola que es pot omplir de veritat sense model.**
  La columna dreta surt de `SAMPLE` (§11.7); aquestes tres línies surten del
  DEM, i per això són a l'esquerra, amb les coses que són de debò.
- **La mateixa lectura i el mateix arrodoniment que el formulari**, amb el
  mateix `TerrainService`: les dues pantalles anomenen el mateix quadrat
  (§11.4), i una pendent que digués 25,8° a l'una i 26° a l'altra serien dos
  terrenys.
- **Es torna a llegir en obrir la pantalla.** El simulador viu en una pestanya
  pròpia i no hereta res; les tessel·les són les que el mapa ja baixa per al
  relleu.

Comprovat al navegador el 13/11/2026 amb el domini de Sóller
(`@2.71500,39.76700`): altitud −24–1.438 m, pendent mitjana 9,1°, màxima 76,2°.

**El que la comprovació ha fet visible:** el mínim és **−24 m**. Mig domini de
Sóller és mar, i Terrarium porta el fons marí com a elevació negativa —el
mateix que va fer sortir isòbates a la §11.6. El formulari dona el mateix
número pel mateix motiu. No s'ha tocat: què són les cel·les de mar per al
domini és la pendent 12.8.

**I sota el cursor, la cel·la.** La barra de la targeta del mapa deia les
coordenades del centre i prou. Ara, mentre el punter és sobre el quadrat, diu
on és, a quina alçada i amb quina pendent —«Cursor · 39.7191° N, 2.8033° E ·
234 m · pendent 5,6°»— i en sortir-ne torna a dir «Centre · …». Cadascuna porta
la paraula al davant perquè les dues lectures comparteixen lloc i no s'han de
poder confondre.

- **Es llegeix de la graella i no del mapa.** L'altitud i la pendent són les
  dues matrius de 1024² que el model rebrà (§2.28), i no una consulta a la
  malla del terreny de MapLibre: el que es llegeix és el que tindrà una cel·la,
  no el que ensenya la imatge. `groundAt()` és la inversa del mostreig de
  `readTerrain()` i viu al seu costat.
- **On és el punter ho publica el `MapService`**, com a senyal `pointer`, pel
  mateix motiu que `picked`: el mapa és seu (§2.4). Amb el relleu encès,
  MapLibre respon amb el terra de sota del punter i no amb el pla del darrere.
- **A la vora, la pendent és la de la cel·la de dins.** `slopeOf()` no calcula
  la primera i l'última fila i columna —no hi ha veí per diferenciar— i les
  deixa a zero; la lectura pren la cel·la veïna en lloc d'afirmar un pla que no
  hi és. Les estadístiques no ho noten: ja es feien només amb l'interior.

Comprovat al navegador el 13/11/2026 a 1680 × 945, amb Sóller: sobre terra,
234 m i 5,6°; sobre el mar, 0 m i 0°; fora del quadrat, torna al centre.

### 11.13. La pendent és una capa, en cinc trams i en violeta

Decidit el 13/11/2026. Les xifres de la §11.12 diuen com és el domini sencer i
com és una cel·la; el que no deien és **on** són els vessants drets, que és la
pregunta que es fa mirant un mapa. El menú de capes porta ara «Pendents»,
apagada per defecte, amb la seva llegenda quan s'encén.

**Cinc trams: 0–5°, 5–15°, 15–25°, 25–35° i més de 35°.** Són d'aquest treball
i de presentació, com els talls de potència de la §2.17: **no hi ha cap
classificació normalitzada de pendent per a incendis**, i el model no en veurà
mai cap —rep la pendent de cada cel·la com a número. Cinc perquè és el que es
distingeix en una llegenda i el que permet dir «aquest vessant passa de 25°».
Descartada la rampa contínua: és més fidel a la dada i no dona cap llegenda
que es pugui llegir en veu alta.

**Un sol to, violeta, de clar a fosc.** Un sol to perquè l'ordre sobrevisqui a
una impressió en gris (el mateix criteri que la §2.16). I violeta per
eliminació: el taronja i el vermell volen dir foc (§2.22), el verd és de què
està feta la fotografia de sota i el blanc és una línia administrativa.

**Apagada per defecte**, perquè tapa la fotografia i la fotografia és com es
reconeix el lloc. És una capa per fer una pregunta, no per deixar posada.

Com està feta:

- **Una imatge d'un píxel per cel·la**, pintada de la mateixa graella de 1024²
  que les xifres i la lectura del cursor, i posada com a font `image` sobre
  l'extensió del domini. No polígons: la graella ja és un ràster, i un milió
  de cel·les traçades serien megabytes de geometria per dir el mateix.
- **És una capa `raster`, que MapLibre drapeja** (§13.1): en relleu cada tram
  queda sobre el vessant que descriu. Va per sota de les corbes, de la màscara
  i del contorn del domini.
- **`raster-resampling: nearest`.** El suavitzat per defecte barrejaria dos
  trams en un color que la llegenda no té.
- **S'afegeix i es treu, no s'amaga**: una font d'imatge no pot existir sense
  imatge, i no val la pena guardar una textura d'un megapíxel per a una capa
  que gairebé sempre és apagada. Per això no és a l'estil inicial.
- **Un error conegut i petit:** la imatge s'estira linealment entre les quatre
  cantonades en Mercator, i la graella és regular en latitud. Al llarg de
  30 km la diferència al mig del domini és d'uns 15 m, mitja cel·la.

El que es veu i és de la 12.8: **el mar surt pintat del tram més clar**, perquè
per a la graella és terreny de 0°.

Comprovat al navegador el 13/11/2026 amb Sóller: en relleu la Serra surt en
violeta fosc i el pla i les valls en clar; en vista plana, igual; apagant-la,
la capa i la llegenda desapareixen; cap error a la consola.

### 11.14. Repàs del sandbox: l'agulla del vent i els botons de zoom

Fet el 13/11/2026, repassant el codi del sandbox contra el que aquesta bitàcola
diu que fa.

**L'agulla del vent assenyalava d'on ve i no cap on va.** El comentari de la
plantilla deia que apunta cap on va el vent —l'origen més 180°— i el `rotate`
feia servir l'origen tal qual: amb vent del nord-oest, la fletxa mirava al
nord-oest mentre el text del costat deia «cap a SE». Ara gira amb `towards()`,
que és el mateix càlcul que escriu aquell text, de manera que no poden tornar a
discrepar. Importa més del que sembla: les dues lectures de «vent del
nord-oest» estan a 180° l'una de l'altra, i la del foc és només una.

**El zoom té botons.** La §11.7 no en va posar perquè el zoom era apagat
(§11.3); la §11.10 el va encendre i la caixa d'eines es va quedar com estava,
de manera que només s'hi arribava amb la rodeta. Ara hi ha «Acostar» i
«Allunyar» a dalt de la caixa, que mouen un nivell cada cop. No porten límits
propis: el terra i el sostre són els de `setSandboxBounds()` (§11.10) i
MapLibre s'hi atura sol. És també l'única via per a qui no té rodeta, perquè
el gestor de teclat segueix apagat (§11.3).

**Dos comentaris que descrivien una versió anterior**, corregits: el de la
caixa d'eines, que encara deia que desplaçar i fer zoom eren apagats, i un
bloc duplicat a `setSandboxBounds()` que explicava la versió estricta del
límit al costat de la que hi ha.

Comprovat al navegador: l'agulla a 135° amb vent del NO; dos clics a «Acostar»
porten a Sóller i quatre a «Allunyar» tornen al bloc sencer i s'hi aturen.

**La línia temporal espera el model, com la resta.** El lliscador es podia
moure i canviava el «T + 02:00» del mapa i de la columna, mentre «Reproduir»
i la velocitat eren desactivats: un rellotge que es pot arrossegar sense res
corrent és l'hora de res. Ara és desactivat i a zero, i les dues lectures
diuen «T + 00:00». Descartat deixar-lo mòbil com a mostra de com es farà
servir: de tots els controls que esperen el model, era l'únic que feia veure
que no.

**La llegenda del mapa puja sota el xip de temps.** La §11.7 la va deixar a
baix a l'esquerra, 74 px per sobre de la vora, que és l'alçada de dues línies
de crèdits i l'escala. Els crèdits no fan dues línies: es parteixen en tantes
com estreta és la targeta —tres a 1680 × 945, sis en un panell de 370 px— i la
llegenda quedava a sobre seu. Els crèdits són condició de llicència i no es
mouen (§6); el que es mou és la llegenda, a l'únic racó on res més canvia de
mida. La de pendents (§11.13) va a sota de l'altra.

Comprovat al navegador amb la capa de pendents encesa: les dues llegendes
queden sota el xip i els crèdits, sencers i sense res al damunt.

### 11.15. L'eina d'ignició posa focus, i el focus és una marca dreta

Decidit el 13/11/2026. La §11.11 va deixar dit que on comença el foc es tria
dins del simulador, amb l'eina d'ignició, i l'eina només canviava de color.
Ara, amb l'eina encesa, **un clic al terreny hi posa una ignició**, i n'hi pot
haver més d'una.

**La marca és un «punt d'aparició» en tres peces:**

- **Un anell lluminós a terra, que batega.** Diu *on*, exactament.
- **Una agulla que flota a sobre, amb un rebot suau.**
- **Una etiqueta flotant** —«Ignició 1», «Ignició 2»— sobre l'agulla.

Com està fet, i per què:

- **Són marcadors DOM de MapLibre i no capes de l'estil.** El moviment és el
  sentit d'aquesta marca, i animar una capa vol dir repintar el mapa sencer
  —terreny inclòs— seixanta cops per segon; una animació CSS mou un element i
  res més. MapLibre col·loca el marcador a l'alçada del terreny i l'atenua
  quan una carena li passa pel davant.
- **Dos marcadors per marca, perquè no miren cap al mateix lloc.** L'anell va
  amb `pitchAlignment: 'map'`, que és el que l'estira a terra en lloc
  d'aixecar-lo cap a la càmera; l'agulla i l'etiqueta miren l'espectador, com
  fa un `symbol` (§13.1), i es llegeixen des de qualsevol angle de l'òrbita.
- **Batega, i aquí sí.** La §2.22 va treure el parpelleig de la navegació
  perquè en un mapa d'incendis el que parpelleja vol dir foc. Això és l'única
  cosa de la pantalla que ho vol dir. Amb `prefers-reduced-motion` s'atura
  tot i la marca conserva la forma, amb dos anells quiets.
- **Els estils són a `styles.css` i no al component**: MapLibre posa l'element
  dins del seu contenidor, fora de la plantilla, i una regla amb àmbit no hi
  arribaria.
- **Les marques no són clicables.** Un marcador és a sobre del llenç i es
  menjaria el clic que posa la ignició següent. Es treuen des de la llista.

**La llista és a la columna esquerra, sota les eines**: cada ignició amb les
coordenades i amb l'altitud i la pendent de la seva cel·la, llegides de la
graella (§11.12), i un botó per treure-la. En treure'n una, les de darrere es
renumeren.

**Només dins del domini.** Un clic fora del quadrat no posa res: allà no hi ha
cel·la per encendre (§11.8).

La primera versió, del mateix dia, les guardava a la memòria de la pantalla i
recarregar les perdia; ho tanca la §11.16. El canvi de nom de la 12.7 no s'ha
fet: el mètode nou es diu `setFireStarts()` perquè `setIgnition()` encara vol
dir el centre.

Comprovat al navegador amb Sóller: dos clics posen «Ignició 1» (731 m, 38,9°)
i «Ignició 2» (911 m, 28,1°), amb l'anell estirat a 55° sobre el relleu;
treure la primera deixa l'altra com a «Ignició 1»; un clic sobre els crèdits
del mapa no posa res.

### 11.16. Les ignicions viatgen a la URL, en un paràmetre

Decidit el 13/11/2026, i tanca la 12.9. Eren l'única cosa d'una simulació que
no era a l'enllaç (§2.26):
`/simulador/ES53/ES532/ES_07061/@2.71500,39.76700?ignicions=2.66240,39.72760;2.80224,39.78268`.

- **La URL és l'únic lloc on són**, com el centre: la pantalla dibuixa el que
  diu l'adreça i no en guarda cap còpia, de manera que obrir un enllaç i
  clicar donen el mateix estat sense cap camí de codi que els separi.
- **Un paràmetre de consulta i no un cinquè segment.** Els quatre segments
  anomenen el domini, i són els mateixos que el formulari (§11.4); les
  ignicions són el que s'hi fa a dins, opcionals i en nombre variable. És la
  mateixa tria que les dates de la portada (§2.31). Sense cap ignició el
  paràmetre desapareix i l'adreça és la de sempre.
- **El mateix format que el punt**, longitud primer i cinc decimals (§2.26),
  sense l'`@` —dins d'un paràmetre amb nom no cal distingir res— i amb punt i
  coma entre punts, perquè la coma ja és de dins de cadascun. L'encaminador
  no escapa cap dels dos i l'adreça es pot llegir.
- **Posar-ne o treure'n una substitueix l'entrada de l'historial**, com moure
  el centre (§2.26): altrament el botó enrere recorreria cada punt posat en
  lloc de sortir de la pantalla.
- **El que no s'entén o cau fora del quadrat es descarta**, en llegir. Un
  enllaç tocat a mà no pot encendre una cel·la que no existeix (§11.8), i és
  la mateixa regla per a un clic que per a un enllaç.

El que queda fora: «Tornar al formulari» porta els quatre segments i no el
paràmetre, de manera que anar al formulari i tornar-ne perd les ignicions. El
formulari tria el centre i no en sap res (§11.11).

Comprovat al navegador: un enllaç amb dues ignicions bones, una a 45° N i un
`xx` en dibuixa dues; treure'n una deixa `?ignicions=2.66240,39.72760`; un
clic n'hi afegeix una altra; i `history.length` no es mou de 2.

---

## 12. Decisions pendents

- **12.7. El canvi de nom d'«ignició» a «centre».** Ve de la §11.11: el text ja
  diu centre i els identificadors encara diuen ignició —`IgnitionStep`,
  `IGNITION_SOURCE`, `setIgnition()`, `LAYERS.ignitionDot`— i el que és
  realment el punt d'ignició encara no existeix. Convé fer-ho el dia que
  l'eina del simulador col·loqui focus de debò, perquè llavors els dos
  conceptes hauran de conviure i els noms hauran de distingir-los.

- **12.8. Les cel·les de mar dins del domini.** Ve de la §11.12. Un domini
  costaner inclou mar, i Terrarium hi dona el fons marí: l'altitud mínima surt
  negativa i la mitjana i la màxima de pendent compten talussos submarins. Cal
  decidir si el mar s'exclou de les xifres —i amb quin criteri: elevació ≤ 0 o
  una línia de costa— i el mateix criteri servirà al model, on el mar és
  no combustible.

- ~~**12.9. Les ignicions a la URL.**~~ Resolta el 13/11/2026 a la §11.16: un
  paràmetre de consulta, `?ignicions=`, i cada canvi substitueix l'entrada de
  l'historial.

La primera que toca és la 12.4, perquè condiciona on viu la resta: si el foc es
pinta dins de MapLibre o en un segon canvas, el model no escriu al mateix lloc.

- **12.1. Model digital d'elevacions.** Ve de la 3.2 de la fase 1. Terrarium per
  comoditat; l'estat de l'art cita el Copernicus DEM GLO-30, de més qualitat.
  Des del 29/10/2026 Terrarium ja no és només el relleu ombrejat: és la font de
  la pendent que alimenta el model, de manera que la pendent pesa més.
  Canviar-lo voldria dir servir les tessel·les nosaltres, perquè el GLO-30 no es
  distribueix com a tessel·les obertes.
- **12.2. Polígons sense model de combustible.** Ve de la 3.3 de la fase 1.
  `MODCOMB = 0` són 5.471 d'11.654 polígons a l'inventari balear. Confondre'ls
  amb terreny no combustible convertiria mitja illa en tallafocs.
- ~~**12.3. Terreny 3D a la vista de simulació.**~~ Venia de la 3.6 de la fase 1
  i la tanca la §11.2: la premissa —que drapejar és més feina que pintar sobre
  un pla— no es compleix en aquesta versió de MapLibre.
- ~~**12.4. Amb què es dibuixa la vista 3D.**~~ Resolta el 5/11/2026 a la §11.2:
  el terreny de MapLibre. El que es plantejava, escrit perquè la decisió es
  pugui llegir sencera —tres camins:
  el terreny de MapLibre (`setTerrain` sobre el DEM que ja és a l'estil) amb
  l'estat del foc com una capa a sobre; un segon canvas —WebGL propi o
  Three.js— que tingui la graella com a malla i l'estat com a textura; o mapa
  pla amb inclinació opcional i el 3D només com a decoració.
  - La hipòtesi era que MapLibre drapeja les fonts *raster* però no els
    `CustomLayer`. Comprovada el mateix dia, i surt millor: drapeja les dues
    coses (§11.2).
- ~~**12.6. Si el mapa del darrer pas s'ha de poder orbitar.**~~ Resolta el
  5/11/2026 a la §11.3: sí, girar i inclinar; desplaçar i fer zoom, no.
- **12.5. El model de propagació.** Encara sense investigar. És el centre de la
  fase i condiciona les 12.1 i 12.2: quines dades demana el model —pendent,
  combustible, vent, humitat— és el que diu quines fonts calen i amb quina
  resolució.

---

## 13. Troballes tècniques

Coses que costen temps i convé no redescobrir. La de la fase 1 és al §4 de
l'altre document.

### 13.1. Què drapeja MapLibre sobre el terreny, exactament

A `maplibre-gl` 6.15.0, `isRenderedToTexture()` ho decideix amb dues regles: per
a una capa normal, `LAYERS_TO_TEXTURES[layer.type] === true`, i la taula és
`{background, fill, line, raster, hillshade, color-relief}`; per a una capa
pròpia, que implementi `renderToTerrainTile`. Les capes `symbol` i `circle` no
hi són: no es drapegen, se situen a l'alçada del terreny i es dibuixen dretes,
que és el que es vol d'una marca.

Les capes consecutives que es drapegen es renderitzen juntes en una pila
(`getRenderStacks`), de manera que una que no es drapeja —un `symbol` al mig—
parteix la pila en dues i costa una passada més. Ordenar l'estil pensant-hi
estalvia passades.

### 13.2. Dues animacions de càmera al mateix fotograma: la segona talla la primera

La primera versió del 3D inclinava la càmera amb un `easeTo` en encendre el
terreny, i el pas enquadrava la seva extensió amb un `fitBounds` immediatament
després. El resultat no era ni una cosa ni l'altra: la segona animació avortava
la primera on fos, i el mapa es quedava a **9°** d'inclinació, que sembla un
error de càlcul i no un punt de vista.

La inclinació ha d'anar **dins** de l'enquadrament: `fitBounds` accepta `pitch`
perquè `FitBoundsOptions` estén `CameraOptions`, i així una sola animació fa les
dues coses. Com a efecte secundari, cada pas pla torna a posar la càmera a zero
sense que ningú ho hagi de recordar: la inclinació surt de l'estat del servei i
no d'una crida a part.

---

## 14. Fonts de dades

Les que ja s'usen són al §5 de la fase 1, amb els crèdits al §6, i no es
repeteixen aquí: l'elevació Terrarium i la cartografia base hi són des del
primer dia.

Les que la fase 2 necessitarà i encara no estan triades —combustible o coberta
del sòl, vent— esperen la 12.5, perquè és el model qui diu què li cal.
