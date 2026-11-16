# Bitàcola tècnica — IgnisLab · Fase 2: el simulador i la vista 3D

Registre de **decisions preses**: què s'ha decidit i per quins motius. Material
de base per a la memòria del TFG.

Continuació de [bitacola.md](bitacola.md), la fase 1 —el mapa i el formulari—,
tancada el 5 de novembre de 2026.

Darrera actualització: 16 de novembre de 2026.

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

### 11.17. La columna de configuració, sencera: què hi haurà i què no es tria

Decidit el 13/11/2026. La columna esquerra era la de la §11.7 —vent, humitat,
temperatura, un desplegable de combustible, tres escenaris de mostra i dues
eines— i ara porta tot el que el simulador tindrà, **maquetat i sense
funcionar** llevat del que ja funcionava. Cada bloc que no fa res ho diu al
costat, amb l'etiqueta «AVIAT», «EXEMPLE» o «SENSE CONNEXIÓ».

**Meteorologia: en directe o manual.** Un commutador de dues posicions.

- **Manual** és el que hi havia: les quatre entrades, editables. És la
  posició per defecte perquè és l'única que avui és certa.
- **En directe** ensenya d'on vindran les dades i res que no s'hagi llegit:
  el servei, l'estació més propera i la darrera observació amb un guió, i les
  entrades bloquejades. Diu, amb aquestes paraules, que els valors que es
  veuen són els manuals i no una observació.
- **Qui es consulta ho decideix el país**, pel primer segment de l'adreça: un
  codi NUTS comença pel país. **AEMET OpenData** a Espanya, que demana clau i
  per tant passarà pel servidor (§2.1); **IPMA** a Portugal.
- **L'API de Portugal existeix i és oberta.** Comprovat el 13/11/2026:
  `api.ipma.pt/open-data/observation/meteorology/stations/observations.json`
  respon sense clau, hora a hora i per estació, amb `intensidadeVentoKM`,
  `idDireccVento`, `temperatura` i `humidade` —les quatre entrades d'aquí— i
  `stations.json` en dona les coordenades. La direcció és un índex de rumb i
  no graus; caldrà la taula.

**El combustible no es tria.** El desplegable «coberta predominant» es treu:
el combustible és del terreny, cada cel·la de 30 m porta el seu model i la
seva càrrega, i un selector per a tot el domini deia el contrari. El bloc
ensenya com es reparteix el domini entre models, amb la càrrega de cadascun,
què té la cel·la de sota del cursor, i de quina cartografia sortirà segons el
territori (§5): IDEIB a Balears, MFE25 a la resta d'Espanya, COS a Portugal.
**El repartiment és d'exemple** i surt de `SAMPLE`, amb l'etiqueta al costat:
la cartografia encara no es llegeix (§12.2) i els números no són d'aquest
domini.

**Els escenaris es desen i es carreguen.** Es treuen els tres botons —Base,
Vent fort, Humitat alta—, que eren escenaris inventats per la pantalla. Un
escenari és ara el que l'usuari ha posat: **on són les ignicions i quina
meteorologia hi ha**. El bloc ensenya què es desaria ara mateix, llegit de
l'estat real, i porta el nom, «Desar» i «Carregar» desactivats i la llista
buida. La comparació d'escenaris de la columna dreta segueix sent de mostra.

**Dues menes d'eines.**

- **D'ignició**, que funcionen: el punt d'ignició (§11.15) i «Treure-les
  totes». «Mesurar» es treu: no feia res i no és de cap de les dues menes.
- **Contramesures**, que no: les que els serveis d'extinció fan servir de
  debò, en dos grups perquè per a un model són dues coses diferents. Les
  **terrestres** canvien el combustible d'una franja de cel·les i es queden
  —línia de defensa amb eines manuals, tallafoc amb maquinària, tala i
  desbrossament, línia d'aigua amb autobomba, contrafoc—; les **aèries**
  mullen o cobreixen una àrea una estona i es gasten —helicòpter, avió amfibi,
  retardant. Tornen aquí els tallafocs que la §11.1 va deixar per al model.

**L'evolució temporal arriba a 12 hores**, i no a 6. El motiu és el domini:
del centre a la vora hi ha 15,4 km (§2.27), i un front a 20 m/min —ràpid, i
no excepcional en un incendi mediterrani empès pel vent— els fa en poc menys
de tretze hores; més enllà, un foc que importi ja és fora del terreny que el
model coneix. I és, a més, un període de crema: el que es pot sostenir
honestament amb una sola meteorologia.

El que això obre, i no es decideix aquí: on es desen els escenaris, com
s'enllaça l'estació amb el domini, i què fa cada contramesura a una cel·la.
Són les 12.10, 12.11 i 12.12.

Comprovat al navegador amb Sóller: el commutador bloqueja i desbloqueja les
entrades; el bloc d'escenaris diu «1 ignició · vent 22 km/h NO · 28 % ·
32 °C» i canvia en moure el vent; «Treure-les totes» buida la llista i
l'adreça; la línia temporal marca de dues en dues hores fins a +12 h.

### 11.18. La meteorologia en directe: l'estació més propera, i prou

Decidit el 13/11/2026, i tanca la part de la 12.10 que es podia tancar. El mode
«En directe» de la §11.17 era una targeta amb guions; ara demana l'observació.

**Un sol endpoint al servidor, `/api/weather?country=&lon=&lat=`**, que respon
igual per als dos països: estació, hora, vent en km/h, d'on ve en graus,
humitat i temperatura, i a quina distància és l'estació.

- **AEMET va pel servidor perquè demana clau** (§2.1), que viu a `api/.env`
  com la de FIRMS i no surt mai cap al navegador. **IPMA no en demana i té el
  CORS obert** —comprovat—, de manera que el navegador l'hi podria demanar
  directament; passa igualment pel servidor perquè els dos països responguin
  amb una sola forma i des d'una sola memòria cau.
- **El país el diu el client**, pel codi NUTS de l'adreça, i no es dedueix de
  les coordenades: el servidor no té les fronteres.

El que s'ha après de cada servei, mirant les respostes i no la documentació:

| | AEMET | IPMA |
| --- | --- | --- |
| Petició | Dues: la primera torna l'adreça de les dades | Una, més la llista d'estacions |
| Mida | 3,5 MB: totes les estacions d'Espanya, unes 12 hores | Un dia, hora a hora |
| Estacions | 855 | 227 |
| Vent | `vv` en **m/s**, `dv` en graus | `intensidadeVentoKM` en km/h, `idDireccVento` en **vuit rumbs** |
| Paranys | El cos és **ISO-8859-15** i no UTF-8; els errors arriben dins d'un 200 | `-99` vol dir sense dada; rumb `0` és calma; `9` és nord, com l'`1` |

La codificació d'AEMET es desfà a mà amb `TextDecoder`: `response.json()`
ignora la capçalera i «SÓLLER» arriba trencat.

**Quina estació parla pel domini: la més propera al centre que tingui les
quatre dades, i res més.** Sense interpolar entre estacions i sense corregir
per l'altitud. Una vall i la carena de sobre no comparteixen vent, i un número
barrejat de tres estacions ho amagaria darrere d'un decimal. El que es fa és
**dir a quina distància és** —la targeta ho escriu— i dir, amb aquestes
paraules, que una sola estació parla per tot el domini. Una estació que dona
temperatura i no vent se salta: no pot dir com correria un foc.

**Memòria cau de vint minuts**, i dada vella abans que cap dada, que és el
mateix tracte que els focus (§2.15): els dos serveis publiquen un cop per hora,
i la petició d'AEMET són 3,5 MB que no es repeteixen per visitant. La pantalla
no refresca sola: es demana en entrar al mode, en canviar de domini i amb
«Actualitzar».

**L'observació no trepitja els valors manuals.** Un sol lloc, `now()`,
decideix quina meteorologia mana —la de l'estació o la dels lliscadors— i tot
el que la mostra o la farà servir llegeix d'allà. Tornar a «Manual» troba els
lliscadors on s'havien deixat. Si l'estació no respon, la targeta diu «SENSE
CONNEXIÓ» i que els valors de sota són els manuals; si respon amb una dada
vella, «DADA ANTIGA».

Comprovat contra el servidor el 13/11/2026: Sóller dona l'estació d'AEMET
«SÓLLER» a 3,8 km (4,7 km/h de 183°, 57 %, 21,2 °C); Coimbra, la d'IPMA
«Coimbra, Bencanta» a 4,9 km; la Cruz de Tejeda, la seva a 0,8 km; un país que
no és ES ni PT, un 400; i la segona petició surt de la memòria cau en 2 ms.
**A la pantalla només s'ha comprovat el camí d'error** —«SENSE CONNEXIÓ» amb
els valors manuals—, perquè el servidor que corria era la versió d'abans i
calia reiniciar-lo.

El que queda de la 12.10: què es fa quan l'estació més propera és lluny —no
hi ha cap llindar— i si el vent d'una estació de fons de vall s'ha de corregir
per al relleu.

---

### 11.19. El primer simulacre: Rothermel sobre combustible suposat

Decidit el 14/11/2026. Obre la 12.5 —el model de propagació— amb una primera
versió que corre, i tanca la 12.8. **És un simulacre i no una predicció**, i la
pantalla ho diu a la capçalera, a la columna d'anàlisi i a la barra d'estat.

**Què es calcula.** Amb almenys una ignició posada (§11.15), «Iniciar
simulació» calcula a quin minut arriba el foc a cada cel·la del domini durant
dotze hores (§11.17), el pinta sobre el relleu i el reprodueix. La columna
dreta deixa de ser de mostra: `SAMPLE` desapareix, com la §11.7 deia que
passaria.

**La velocitat de propagació és la de Rothermel** (1972), amb les esmenes
d'Albini (1976), escrita seguint Andrews (2018, RMRS-GTR-371) i amb els noms
de variables d'aquell informe. Tres decisions a dins:

- **En les unitats en què es va publicar** —peus, lliures, minuts, BTU— i
  convertint només a les vores. Les constants del model són ajustos empírics
  en aquestes unitats; reescriure-les en SI és una segona oportunitat
  d'equivocar-ne cadascuna.
- **Amb la ponderació per superfície** entre classes de partícula, mortes i
  vives, que és la part del model que més sovint se simplifica.
- **El que no hi és:** foc de capçades, focus secundaris i el límit de vent de
  Rothermel. És el foc de superfície i res de sobre.

**Comprovat abans de fer-lo servir**, i és el que permet defensar-lo:

| Contra què | Resultat |
| --- | --- |
| Les velocitats de referència d'Anderson (1982) per a onze models —mort al 8 %, viu al 100 %, 5 mi/h a mitja flama, sense pendent | Nou dins del 10 %; totes les longituds de flama dins de mig peu |
| Els dos que no: model 5 (−19 %) i model 7 (+30 %) | Vegeu la fila següent |
| Les taules de referència del Southwest Coordination Center per al model 7 —humitat d'1 h del 6, 9 i 12 %, vent de 4 i 6 mi/h, viu del 90 al 120 % | **Reproduïdes cel·la per cel·la**: 17–20 on la taula diu 17–20, 29–33 on diu 29–33 |

La xifra que Anderson va imprimir per al model 7 el 1982 és la que ha envellit,
no les equacions.

**El combustible és un sol model per a tot el domini, i és un supòsit.** No hi
ha cartografia de combustible (§12.2), i un model que en demana un a cada
cel·la no pot esperar-la per provar-se. El **model 7 d'Anderson**, matollar
sota arbrat, per ser el més proper dels tretze a una pineda mediterrània amb
sotabosc. La secció de combustible de la columna esquerra porta l'etiqueta
«SUPÒSIT» i deixa d'ensenyar el repartiment inventat de la §11.17.
**Esmenat el mateix dia per la §11.21**: el combustible ja és de cada cel·la.

**El mar no crema: altitud ≤ 0.** Tanca la 12.8 amb el mateix criteri que les
corbes de nivell (§11.6). Terrarium dona el fons marí negatiu i la superfície
a zero. A Sóller pot cremar el 64 % del quadrat. Les xifres d'altitud i
pendent del domini (§11.12) **encara compten el mar**: no s'han tocat.

**De la meteorologia al model**, tres passos que són tres supòsits:

- **Humitat del combustible mort fi**: el contingut d'humitat d'equilibri de
  Simard (1968), el del NFDRS, a partir de la temperatura i la humitat
  relativa. És la humitat a què s'estabilitza el combustible si l'aire es
  queda com està: sense sol damunt, sense pluja d'ahir. Les classes de 10 i
  100 hores, un i dos punts més humides, que és una regla i no una mesura.
- **Humitat del combustible viu**: 100 %, constant. No es mesura ni es deriva
  de res.
- **Vent a mitja flama**: l'estació mesura a 10 m i el foc el nota a l'alçada
  de la flama. De 10 m a 20 peus (÷ 1,15) i de 20 peus a mitja flama amb
  l'ajust **sense abric** d'Albini i Baughman (1979). Sota una capçada tancada
  el vent a terra és una fracció d'això, i aquí res no sap de la capçada. Amb
  22 km/h a l'estació, són 8,4 a mitja flama.

**La propagació és un temps mínim de viatge, no un autòmat que fa passos.**
Cada cel·la té una velocitat en cada direcció —la de Rothermel per a la seva
pendent i el vent, estirada en el·lipse— i el foc arriba a una cel·la pel camí
que hi arriba abans. És el camí més curt de Dijkstra amb temps per distància,
la idea del *Minimum Travel Time* de Finney (2002). Motius:

- **El resultat no depèn de cap pas de temps** i **és el mateix cada vegada**:
  un enllaç reprodueix un incendi i no només el descriu (§2.26, §11.16).
- **El que en surt és un número per cel·la**, el minut d'arribada. Tota
  l'evolució és en aquella graella: el foc a l'instant T són les cel·les amb
  un número per sota de T, de manera que la línia temporal és un llindar i no
  una nova execució.
- **Vent i pendent se sumen com a vectors** (Rothermel 1983): un vent de
  través a un vessant dona un foc que corre en diagonal a tots dos. La forma
  de l'el·lipse és la d'Anderson (1983), amb la relació llarg-ample tallada a 8.

**Corre al navegador, al fil de la pàgina i a trossos**, i no en un *worker*
com s'havia proposat: un milió de cel·les triguen **0,2 segons**, i això no
justifica la configuració de compilació d'un *worker*. La GPU (§2.1) queda
per quan el combustible variï i calgui.

Dues coses que només van sortir provant-ho sobre terreny pla, on la resposta
exacta és una el·lipse:

- **Un arrodoniment aturava el foc.** La graella d'arribades és de 32 bits i
  la cua de prioritats guardava els temps en 64: la meitat de les entrades
  semblaven més velles que la cel·la a què pertanyien i es llençaven. El front
  avançava 450 m on n'havia de fer 1.244. Ara el temps s'arrodoneix abans
  d'entrar a la cua.
- **Vuit veïns fan un foc massa prim.** Amb un vent fort l'el·lipse és
  estreta i el camí més ràpid cap al flanc surt deu o vint graus de l'eix; si
  no hi ha cap pas en aquella direcció, el camí fa ziga-zaga i arriba tard.
  Mesurat contra l'àrea de l'el·lipse exacta (1.352 ha, 22 km/h, dotze hores):

  | Passos fins a | Direccions | Àrea | Error |
  | --- | --- | --- | --- |
  | 2 cel·les | 16 | 874 ha | −35 % |
  | 3 | 32 | 1.070 ha | −21 % |
  | 4 | 48 | 1.181 ha | −13 % |
  | **5** | **80** | **1.245 ha** | **−8 %** |

  El cap del foc és correcte a qualsevol abast, amb un error d'una cel·la; el
  que millora és el flanc. Es queda en cinc: més enllà els passos són més
  llargs que les formes del terreny que saltarien. **L'àrea surt, doncs, un
  8 % curta amb vent fort**, i és un error conegut i no amagat. Un pas llarg
  no pot saltar una cel·la que no crema: la del mig també ha de cremar.

**Les mètriques, i d'on surten.** Totes es treuen de la graella d'arribades,
minut a minut i d'un sol cop:

- **Superfície cremada**: cel·les per 0,09 ha, i el ritme dels darrers 30 min.
- **Perímetre**: costats entre una cel·la cremada i una que no, per 30 m i
  per **π/4**. Una línia dibuixada a graons és més llarga que la que
  representa, 4/π de mitjana en totes les direccions; sense la correcció un
  foc rodó donaria el perímetre del quadrat que l'envolta.
- **Velocitat i direcció del front**: les de les cel·les que el foc ha
  assolit en els darrers deu minuts, no una mitjana de tot l'incendi.
- **Arribada a la vora del domini**: quan el foc toca el límit del quadrat,
  que és quan el càlcul deixa de veure'l sencer.
- **Sense vent ni pendent**: el que fa el combustible sol, com a referència.

El que la columna **ja no diu**, perquè no es pot calcular: risc, contenció,
arribada a zona urbana, habitatges exposats i comparació d'escenaris. Eren de
`SAMPLE`, i demanen dades —on hi ha cases— o un model d'extinció que no hi són.

**El resultat respon per les entrades amb què es va calcular.** Canviar una
ignició, la meteorologia o el domini el treu de la pantalla en lloc de
deixar-lo sota uns lliscadors que ja diuen una altra cosa.

**El foc es pinta en tres edats** —front, flames i cremat— en un `canvas`
d'un píxel per cel·la que MapLibre llegeix com a font i drapeja com a capa
`raster` (§13.1), per sota de les corbes i del contorn.

Comprovat el 14/11/2026 amb Sóller, una ignició a 39,745° N, 2,720° E i la
meteorologia manual (22 km/h del NO, 28 %, 32 °C): el càlcul triga 0,2 s; a
T + 09:05 hi ha 789 ha cremades, 12,4 km de perímetre i un front de
15,3 m/min cap al sud-est, que és cap on el vent el porta; en dotze hores no
arriba a la vora. **El que no s'ha pogut comprovar és el dibuix del foc sobre
el mapa**: el navegador de proves no pintava el relleu aquell dia. Les xifres
i la reproducció, sí.

El que queda obert de la 12.5: el combustible real per cel·la (§12.2), la
humitat del viu, l'abric del vent sota capçada, i validar un incendi sencer
contra un de real, que és l'única comprovació que encara no s'ha fet.

---

### 11.20. El foc es veu com un foc: brasa a terra, flames i fum a l'aire

Decidit el 14/11/2026. El simulacre de la §11.19 pintava tres colors plans
sobre el relleu: es llegia on havia cremat i no semblava un foc. La referència
és l'animació del prototip FireCast (§11.7), i la pregunta era si es podia
igualar. Es pot igualar l'aspecte, i el que hi ha a sota és millor: allà les
flames segueixen una el·lipse dibuixada, i aquí segueixen el front que el
model ha calculat.

**Dues capes, perquè el foc és dues coses.** El que ha cremat és a terra i una
flama no: pintada a la capa drapejada (§13.1) quedaria ajaguda sobre el
vessant.

**El terra és el pintor de Codex**, `fire-appearance.ts`, fet a petició de Pere
i documentat a [ajuda-foc-codex.md](ajuda-foc-codex.md); s'ha connectat tal com
aquell document proposa, i substitueix el `paintFire` de la §11.19, que es
treu. Del front groc a la brasa i al carbó amb transicions suaus, una textura
de cendra que no canvia en tornar enrere per la línia temporal, i un
parpelleig desfasat cel·la a cel·la. Porta set proves, que passen.

**Esmena del mateix dia: el terra passa a ser un camp continu.** Vist a la
pantalla, el pintor per cel·les no donava la fluïdesa del prototip: el foc
**s'estenia per quadrats**, una cel·la encenent-se darrere de l'altra. És
exacte i sembla un full de càlcul cremant. Un front és una línia que es mou, i
el que el fa moure bé és que tot el que es pinta sigui continu. El nou pintor
és `fire-field.ts`:

- **Continu en l'espai.** La distància d'una cel·la al front es mesura en
  cel·les: el temps que li falta, dividit pel que el front triga a travessar-la
  allà —el gradient del temps d'arribada, calculat un cop. Una cel·la no
  s'encén: s'escalfa quan el front s'acosta, fa el màxim quan passa i es
  refreda al darrere. Amb el filtre lineal de la capa —que substitueix el
  `nearest`— la línia brillant queda *entre* cel·les i llisca.
- **Continu en el temps.** Els colors són funcions de l'edat sense cap graó.
- **Continu en el parpelleig.** És un soroll suau sobre el terreny, més ample
  que una cel·la i que deriva, en lloc d'un escaquer de píxels independents.

L'aspecte és el del *shader* del prototip —una resplendor, una línia calenta
fina i carbó amb brases— refet sobre els temps d'arribada del model.

**El que es paga, i s'ha de dir:** el dibuix **ja no és la petjada exacta**.
Hi ha resplendor unes quantes cel·les *per davant* del front, on encara no ha
cremat res. Les xifres de la columna d'anàlisi no surten del dibuix i no
canvien. El pintor exacte de Codex, `fire-appearance.ts`, es queda al
repositori amb les seves set proves, sense fer-se servir: és el que caldria
si mai es vol ensenyar la petjada cel·la a cel·la.

Una passada sencera del pintor són 7 ms, i un fotograma amb el minut aturat,
0,2 ms; el ràster puja de 20 a 30 fotogrames per segon.

**I les flames ja no parpellegen.** També vist a la pantalla: apareixien i
desapareixien. Dues causes. Cada partícula buscava el seu emissor a cada
fotograma, i la llista d'emissors es refà diverses vegades per segon: saltava
a un altre tros del front a mig vol. Ara **una partícula conserva el lloc on
neix** durant tota la vida i en tria un de nou només en renéixer, de manera
que les flames segueixen el front d'un naixement en un altre. I l'altitud de
la partícula ve de la graella de la simulació mentre que el relleu de la
pantalla és la malla de MapLibre, més grollera al zoom d'obertura: en un
vessant dret difereixen de desenes de metres i la flama s'hi enfonsava. Ara
s'acosta una mica a la càmera abans de la prova de profunditat. A més,
s'encén de mica en mica en lloc d'aparèixer de cop.

**L'aire són partícules**, `fire-particles.ts`, una capa pròpia de MapLibre
(`CustomLayerInterface`, en mode `3d`) que dibuixa punts en el mateix espai
que el terreny —coordenades Mercator amb l'altitud per tercera— de manera que
comparteixen càmera i profunditat, i una carena que queda al davant les tapa.

- **1.400 flames**: punts brillants que pugen, s'inclinen cap on bufa el vent
  i s'apaguen, amb mescla additiva perquè on se superposen facin resplendor.
- **220 de fum**: grans, grises, amb soroll, que deriven a favor del vent i
  pugen fins a uns 500 m.
- **Neixen a les cel·les que el model acaba d'assolir**, les dels darrers sis
  minuts —les mateixes que el ràster pinta com a front. Un front més ràpid és
  una banda més ampla de cel·les joves i en rep més sense que ningú ho hagi
  dit. Quina cel·la munta cada partícula la fixa el seu número, de manera que
  quan el front es mou la partícula el segueix en lloc de saltar.
- **`towardsDeg` ja és cap on va el vent** i no es torna a girar: és
  l'advertència del document de Codex, i és l'error de l'agulla de la §11.14.

**Un rellotge per a la simulació i un altre per a l'aspecte.** La línia
temporal decideix quines cel·les han cremat i res més; el parpelleig i les
flames es mouen sols, també en pausa, perquè un foc aturat i immòbil es
llegeix com una fotografia. Cap de les dues capes canvia quines cel·les han
cremat ni alimenta cap xifra de la columna d'anàlisi.

**És presentació, i s'ha de dir.** L'alçada, la mida i la vida d'una partícula
es trien perquè es vegin des de trenta quilòmetres: una flama real a aquesta
escala fa menys d'un píxel, i per això cap partícula baixa de tres. **No són
longituds de flama calculades per Rothermel**, i els colors del ràster són
edats des de l'arribada, no temperatures.

El que es respecta:

- **`prefers-reduced-motion`**: el parpelleig es congela i les partícules no
  es dibuixen; la línia temporal segueix funcionant.
- **Pestanya amagada**: no es puja cap textura.
- **El cost**: el ràster es repinta a 20 fotogrames per segon —és una textura
  d'un megapíxel cada vegada— i les partícules fan que el mapa es redibuixi a
  cada fotograma mentre hi ha foc, i només llavors.
- **Si un *shader* no compila** en alguna targeta, es perden les flames i no
  el mapa: la capa no dibuixa res i el ràster de sota segueix dient on és el
  foc.

El que el prototip té i aquí encara no: les isòcrones de predicció a +30, +60
i +90 minuts. Aquí sortirien del model i no d'una el·lipse, i són el pas
següent natural. **Fet el mateix dia, a la §11.22**, que també substitueix
`fire-field.ts` per un pintor a la GPU.

Comprovat, pel pintor continu: renderitzat fora del mapa sobre un terreny
ondulat, el front surt com una línia incandescent contínua amb resplendor i
sense cap quadrat, a l'escala del mapa i ampliat nou vegades.

Comprovat el 14/11/2026: compila, les set proves del pintor passen, i els dos
*shaders* compilen i dibuixen en un llenç WebGL2 a part —un punt de prova dona
el groc de flama al centre i res a la vora, sense errors de GL. **No s'ha
pogut veure sobre el mapa**: el navegador de proves tenia el panell amagat i
el relleu no s'hi carrega. Queda per mirar amb el mapa a la vista: que les
partícules caiguin sobre el front i no desplaçades, que el relleu les tapi, i
el rendiment amb el foc gran.

---

### 11.21. El combustible és de cada cel·la: cartografia oficial on n'hi ha, coberta del sòl on no

Escrit el 14/11/2026, **després de fer-ho i no abans**: la integració és de
Codex, a petició de Pere, i aquesta secció la recull un cop revisada contra el
codi. El detall d'operació —com s'arrenca, com s'importa una entrega nova, què
respon l'API— és a
[combustibles/IMPLEMENTACION.md](combustibles/IMPLEMENTACION.md), i la recerca
de fonts a [combustibles/README.md](combustibles/README.md). Aquí hi ha el que
s'ha decidit i el que encara s'ha de decidir.

Tanca el supòsit de la §11.19 —un sol model 7 per a tot el domini— i la part
de la 12.2 que es podia tancar. Cada cel·la de 30 m porta ara el seu model
d'Anderson, i Rothermel es calcula amb el d'aquella cel·la.

**Dues fonts, amb prioritat, i cada cel·la recorda d'on ve.**

- **Cartografia oficial on n'hi ha.** Avui, Balears: l'inventari de l'IDEIB,
  que publica `MODCOMB` amb el model ja assignat pels autors (§5). 11.654
  polígons, dels quals 6.183 porten model.
- **Coberta del sòl a tot arreu més.** ESA WorldCover 2021 (v200, 10 m,
  CC BY 4.0), convertida a model d'Anderson amb una taula que és d'aquest
  treball. Cobreix Espanya i Portugal sencers, illes incloses, sense clau i
  sense preparar res.
- **L'oficial trepitja l'estimat**, cel·la a cel·la, i la resposta porta una
  segona graella amb la procedència: oficial, estimat o desconegut. La
  pantalla en diu els percentatges i l'etiqueta de la secció —«CARTOGRAFIAT»,
  «MIXT», «ESTIMAT», «INCOMPLET»— surt d'aquí. **Un model estimat no es pot
  fer passar per un de cartografiat**, que és el mateix tracte que `SAMPLE`
  va tenir mentre va existir (§11.7).

**El zero de l'IDEIB vol dir «no ho sabem», i així es tracta.** És la 12.2.
Els 5.471 polígons amb `MODCOMB = 0` —el 46,95 %— porten al camp `M_COMBU` el
text «No se dispone de información»; n'hi ha d'agrícoles i d'artificials, però
el codi no diu quins. No s'importen com a no combustible, que hauria convertit
mitja illa en tallafocs: es deixen com a desconeguts i la coberta del sòl de
sota hi respon. A Sóller, d'un milió de cel·les, 410.097 surten de l'inventari
i 638.479 de WorldCover (xifra de Codex, no repetida).

**Tres estats que no són el mateix**, i tres números per dir-los: de l'1 al 13
un model; **0, no combustible** amb evidència —construït, aigua, neu—; **255,
desconegut**. Un codi de coberta que la taula no reconeix és 255 i mai 0.

**La taula de conversió, i el que val.** WorldCover diu què cobreix el terra,
no què hi crema:

| WorldCover | Model | Supòsit |
| --- | --- | --- |
| Arbres | 8 | Fullaraca compacta; no se sap res del sotabosc |
| Matollar | 5 | Matollar baix |
| Herbàcies, conreus | 1 | Combustible fi curat; no sap de fenologia ni de collita |
| Molses i líquens | 1 | Gairebé absent a l'àmbit |
| Aiguamoll herbaci | 3 | Herba alta; la humitat no s'observa |
| Sòl nu o vegetació esparsa | 0 | Menys d'un 10 % de coberta: no porta un foc de superfície |
| Construït, neu, aigua | 0 | No combustible a aquesta resolució |

La pantalla ho escriu amb aquestes paraules quan hi ha cel·les estimades. La
taula porta versió (`anderson13-worldcover2021-v2`), i canviar-ne una fila ha
de canviar la versió, perquè és el que invalida les respostes desades.

**L'arbrat és el model 8, i no el 7.** Decidit el 14/11/2026, i tanca la
12.13. La §11.19 havia triat el 7 per a la pineda mediterrània amb sotabosc,
però allà era un supòsit dit en veu alta per a tot un domini; aquí és una
fila que s'aplica a cada cel·la que un satèl·lit ha vist amb arbres, sense
saber què hi ha a sota. El 8 és el que no afirma un sotabosc que la dada no
ha vist. **El preu:** el 8 és el més lent dels models de bosc, de manera que
fora de Balears un foc sota arbrat correrà menys que amb el 7, i en una
pineda amb matollar de debò quedarà curt. La pantalla diu «bosc → model 8»
al costat de cada resultat estimat.

**El sòl nu no crema.** Decidit el 14/11/2026, i tanca la 12.14. La primera
versió de la taula el posava al model 1, herba fina contínua, i s'ha canviat:

- **La font el defineix sense vegetació.** El manual de WorldCover (v2.0,
  taula 3) diu de la classe 60: terres amb sòl, sorra o roca a la vista que
  **no passen mai del 10 % de coberta vegetal** en cap moment de l'any. Amb
  això no hi ha continuïtat perquè un foc de superfície avanci.
- **El model 1 era l'error cap al costat dolent.** És dels més ràpids amb
  vent: el simulador feia córrer el foc per una carena de roca o una platja,
  que és on de debò s'atura.
- **És el que fan les cartografies de combustible**: Scott i Burgan (2005)
  porten una classe de sòl nu no combustible.

**El preu:** un pedregar amb una mica de càrritx, o un terreny acabat de
cremar que el satèl·lit ha vist nu, passa a ser barrera. Una cel·la sola
s'envolta; el que atura un front són les taques grans, que són justament roca
o sorra. Els guarets no hi entren: el manual els posa a herbàcies o a
conreus, no aquí.

La versió de la taula passa a `v2`, que invalida les respostes desades amb
l'altra. Les molses i líquens es queden al model 1: a Ibèria gairebé no n'hi
ha i no val una decisió.

**Al servidor i no al navegador**, al revés que l'elevació (§2.28). Les
tessel·les Terrarium són PNG petits i oberts; WorldCover són GeoTIFF de 3° de
costat que es llegeixen per rangs HTTP, i la cartografia oficial són fitxers
preparats al disc. `/api/fuels?bbox=&size=` torna la graella sobre **la
mateixa extensió i orientació que el relleu**, comprimida per ratxes, i la
desa trenta dies. Una resposta amb forats —WorldCover caigut— no es desa: un
error ha de poder-se reintentar, no durar un mes.

**Es mostreja el centre de cada cel·la, sense interpolar.** Un model és una
categoria: la mitjana d'un 4 i un 8 no és un 6. Les tessel·les oficials es
rasteritzen a uns 20–27 m; la precisió temàtica segueix sent la de la font
—tessel·les d'una hectàrea a l'MFE, 10 m a WorldCover— i no la de la graella.

**El que canvia al model.**

- **Els tretze models**, amb les càrregues, fondàries i humitats d'extinció
  d'Anderson (1982). N'hi havia quatre.
- **Cada cel·la, el seu llit**: velocitat base, factor de vent i de pendent
  surten del model de la cel·la. El vent a mitja flama també, perquè l'ajust
  depèn de la fondària del combustible.
- **Un pas llarg paga cada cel·la que travessa.** Els passos de fins a cinc
  cel·les (§11.19) prenien la velocitat de l'origen; amb combustible variable
  això saltaria una franja lenta. Ara el temps és la suma dels trossos dins de
  cada cel·la creuada, amb la velocitat de cadascuna.
- **Una barrera d'una cel·la atura el foc**, també en diagonal: un pas que
  passa exactament per un vèrtex toca les dues cel·les del costat, i si una no
  crema, no passa. És el que farà falta per als tallafocs (§11.1, 12.12).
- **No es calcula sobre el que no se sap.** Amb terreny sense dada, o una
  ignició sobre una cel·la sense combustible, el botó no s'encén i la pantalla
  diu per què. Tractar el desconegut com a barrera faria un foc més petit del
  que toca sense dir-ho.

**El que no canvia**, i segueix sent supòsit (§11.19): meteorologia uniforme i
constant, humitat del viu al 100 %, humitat del mort estimada, sense capçades
ni focus secundaris. Un mapa de combustible real no converteix res d'això en
una observació.

**El que costa i el que es deixa.**

- Quatre dependències noves al servidor —`geotiff`, `proj4`, `shapefile`,
  `fflate` (§6)—, que és la feina per lots que la §2.12 deia que cabria en
  scripts a part i que aquí ha entrat a l'API.
- **Les dades preparades no són al repositori.** `api/data/fuels` és fora de
  Git, i l'entrega balear es va importar d'un fitxer del projecte anterior
  (`Pere/Code`), que simplifica la geometria a 0,0001°. En una altra màquina,
  sense copiar-les, tot surt estimat. La pantalla ho diria —«ESTIMAT»— però
  convé saber-ho abans d'una demostració.
- **MFE25 i Portugal segueixen pendents.** El documentador de l'IFN4 defineix
  `ModComb` per a la península, de manera que la frase del §5 de la fase 1
  —que caldria reclassificar a partir de l'espècie— era massa general i s'ha
  esmenat; però cap entrega peninsular s'ha baixat ni auditat, i la descarrega
  de MITECO respon amb un CAPTCHA. El servei portuguès de FIRE-MODSAT II
  donava 503 el dia de la recerca.

Comprovat el 14/11/2026: les sis proves del servidor i les quinze del client
passen —barreres d'una cel·la i en diagonal, franges lentes travessades,
ignicions invàlides, forats i coordenades negatives en rasteritzar, i les
velocitats de referència d'Anderson dins del 10 % per als vuit models només
de mort— i TypeScript no dona errors. **No s'ha mirat al navegador**, ni
s'han repetit les consultes reals ni els temps que dona el document de Codex.

---

### 11.22. El terra del foc es pinta a la GPU, i porta la previsió a +1, +3 i +6 hores

Escrit el 14/11/2026, **després de fer-ho**, com la §11.21: és feina de Codex a
petició de Pere, documentada a
[propagacion-firecast.md](propagacion-firecast.md), i aquí se'n recull el que
és decisió. Tanca el que la §11.20 deixava com a «pas següent natural» —les
isòcrones de previsió— i canvia amb què es pinta el terra.

**El terra passa de `fire-field.ts` a `fire-surface.ts`.** La idea és la de la
§11.20 —un camp continu i no cel·les que s'encenen— i el que canvia és on es
calcula: un *shader* en un llenç WebGL2 propi, que MapLibre segueix llegint com
a font i drapejant com a capa `raster` (§13.1).

- **S'interpola el temps d'arribada, i després es pinta.** La graella puja a
  la GPU com una textura de dos canals —el minut d'arribada i el que el front
  triga a travessar la cel·la— i cada píxel interpola el temps entre les
  quatre cel·les veïnes abans de triar color. Interpolar colors donaria una
  taca difuminada; interpolar temps dona una línia que llisca.
- **No s'interpola a través del que no crema.** Una cel·la que el foc no
  assoleix no entra a la mitjana i no es pinta: el dibuix no omple una barrera
  per fer una figura més rodona.
- **La resolució es gasta on hi ha foc.** La textura és de 2048 × 2048 i
  cobreix només el rectangle que el foc assoleix en dotze hores, amb marge, i
  no els 30 km sencers. Un foc de 40 ha es dibuixa amb molt més detall que un
  píxel per cel·la sense tocar la malla de càlcul, que segueix sent de 30 m.

**La previsió són tres llindars sobre la mateixa graella.** Carbó és el que té
un minut d'arribada per sota del cursor; previsió a +1 h és el que el té per
sota del cursor més seixanta. No hi ha cap segon càlcul ni cap el·lipse: és el
que la §11.19 ja deia de la línia temporal —un llindar i no una nova
execució— aplicat tres vegades cap endavant.

- **Tres bandes**, vermella, taronja i groga, cadascuna amb el seu contorn
  de ratlles.
  Per sobre del que ja ha cremat no es pinten.
- **Les xifres surten de la sèrie d'àrea**, la mateixa de la columna
  d'anàlisi: la superfície a +1, +3 i +6 hores i quant creix cadascuna.
- **Una previsió que cau fora del càlcul no es dibuixa** ni s'etiqueta. Amb
  el marge de l'esmena de sota ja no passa mai, però la regla es queda.
- **Encesa per defecte**, i s'apaga al menú de capes. Un botó nou, «Veure el
  foc i la previsió», enquadra el conjunt sense moure la inclinació ni el gir.

**Què és i què no és aquesta previsió.** És el mateix simulacre vist uns
minuts més enllà, amb la meteorologia quieta. **No és una probabilitat ni un
interval d'incertesa**, i la paraula no ha de fer-ho semblar: si el vent
canvia, la banda no ho sap.

**Les flames neixen sobre el contorn interpolat.** La §11.20 les feia néixer
al centre de les cel·les assolides en els darrers sis minuts. Ara el front es
traça —triangles sobre la graella, tallats al minut del cursor— i les
partícules es reparteixen al llarg d'aquella línia, de manera que no s'apleguen
en uns quants centres de cel·la. Retrocedir o saltar a la línia temporal les
reinicia: altrament quedava fum de l'instant anterior.

**El que es paga, i és el mateix que a la §11.20:** el dibuix interpolat pot
diferir una mica de la petjada discreta amb què es compten les hectàrees. Les
xifres no surten del dibuix.

**Esmena del mateix dia, vista a la pantalla per Pere: tres defectes del
primer dibuix.**

- **En acabar, el foc quedava a quadrats.** A les dotze hores la vora del foc
  era la vora del que s'havia calculat: les cel·les de fora no tenien minut
  d'arribada i el *shader* les descartava senceres. Ara **es calcula sis hores
  i mitja més enllà de la línia temporal**, que segueix arribant a dotze: el
  contorn final és una isòcrona interpolada com qualsevol altra. El que el
  foc faci en aquell marge no es diu enlloc llevat de la previsió —l'arribada
  a la vora del domini només compta fins a les dotze.
- **Les vores del que no crema també eren graons.** Si una cel·la es pot
  assolir s'interpola igual que el temps, i el dibuix s'acaba on aquella
  cobertura creua la meitat: una barrera o un forat surten amb els cantons
  tallats i no amb escales. El temps segueix sense interpolar-se a través.
- **Les línies de previsió no es veien, i +30, +60 i +90 minuts quedaven
  enganxades.** Passen a **+1, +3 i +6 hores**, que és el que demana un foc
  que sota arbrat avança un metre per minut (§11.21): a noranta minuts les
  tres bandes cabien en dues cel·les. I les línies **mantenen el gruix a la
  pantalla**, menys de dos píxels i de ratlles: la imatge va drapejada i
  s'estira amb el terra, de manera que un gruix en cel·les era un fil amb el
  domini sencer a la vista i una franja de prop. El mapa diu quants metres fa
  un píxel i el pintor en treu el gruix. Una primera versió les feia de tres
  píxels, contínues i amb una vora fosca; es veien, i tapaven massa. Fines i
  discontínues diuen el que són —una previsió i no un perímetre— i la vora
  fosca sobra. Les ratlles es compten al llarg de la línia, per l'eix al qual
  s'acosta més, i la seva llargada és un múltiple del gruix.
- De passada: el ritme local —minuts per cel·la— tenia un sostre de 25, i un
  front lent en passa. Allà totes les línies sortien de diverses cel·les
  d'ample. El sostre és ara 240.

El marge són sis hores i mitja i no sis: amb sis justes, la línia de +6 h al
final de la línia temporal cau sobre la vora del càlcul i en surt mig tallada.

Comprovat al navegador amb Sóller, en relleu i en pla, a T + 01:00 i a
T + 12:00: contorn final corb, les tres línies tancades i del mateix gruix en
acostar i allunyar, i cap error a la consola. Les línies fines i de ratlles,
mirades a T + 06:00.

**El que queda al repositori sense fer-se servir**, i ara són dos: el pintor
exacte per cel·les, `fire-appearance.ts`, i el camp continu de la §11.20,
`fire-field.ts`. Cap dels dos el crida ningú. És la 12.15.

Dues coses que han sortit pel camí:

- **El relleu no repintava el foc**, i és la troballa §13.3. Explica el que la
  §11.19 i la §11.20 van deixar escrit com a no comprovat.
- **La memòria cau del navegador servia combustibles vells.** Amb la taula a
  `v2` (§11.21), una resposta `v1` desada pel navegador feia que el domini no
  carregués. La petició ara revalida sempre, i «Torna a carregar» la força.

Comprovat el 14/11/2026: les 21 proves de `src/app/simulation` passen —contorn
continu, fronts desconnectats, cel·les inassolibles, retrocés, retall de
l'extensió i els límits de la previsió— i la compilació de producció surt
dins de pressupost. **Al navegador ho ha mirat Codex i no s'ha repetit**: el
seu document dona, per a Sóller amb una ignició a 39,755° N, 2,704° E i la
meteorologia manual, 35,5 ha a T + 10:00 i 39,1, 43,1 i 54,8 a +30, +60 i +90,
que eren els horitzons d'abans de l'esmena.

**Una xifra que convé mirar abans de creure-se-la.** La §11.19 donava 789 ha a
T + 09:05 amb el model 7 a tot el domini; aquí en surten 35,5 a T + 10:00. La
ignició no és la mateixa i no són comparables cel·la per cel·la, però un factor
vint és el que s'espera de passar del 7 al combustible cartografiat i al
model 8 sota arbrat (§11.21). És la conseqüència d'aquella decisió vista en un
número, i el motiu pel qual la 12.5 segueix demanant un incendi real contra el
qual comparar.

---

### 11.23. La direcció del vent és una brúixola que es gira

Decidit el 14/11/2026, a petició de Pere. La rosa dels vents de la columna
esquerra era un dibuix amb una agulla, i la direcció es triava en un
desplegable de vuit rumbs. Ara **la rosa és el control**: s'agafa l'agulla i
es gira.

- **L'agulla assenyala cap on va el vent**, com des de la §11.14, i això és el
  que es mou amb la mà: es posa l'agulla cap on ha de córrer el foc. El que es
  desa és l'oposat, d'on ve, que és com es diu un vent i com el dona una
  estació. El text del costat diu les dues coses —«Des de NO (315°) → cap a
  SE»— perquè les dues lectures estan a 180° i no s'han de poder confondre.
- **De cinc en cinc graus**, i no els vuit rumbs. Més fi que això és més del
  que una mà pot voler dir sobre un dial de 92 px, i més del que una sola
  estació sap (§11.18). El desplegable de vuit rumbs es treu: eren dos
  controls per a una sola dada, i el nord exacte és la tecla Inici.
- **Amb el teclat es fa el mateix.** La rosa és un `slider` per a la
  tecnologia d'assistència, sobre el rumb d'origen: les fletxes mouen cinc
  graus, Re Pàg i Av Pàg un rumb sencer, i Inici torna al nord. És el criteri
  de la §2.22 —el teclat fa exactament el que fa el ratolí— i aquí a més es
  podia, perquè no depèn del gestor de teclat del mapa (§11.3).
- **Amb el dit també**: el gest és de la rosa i no fa desplaçar la columna.
- **Bloquejada en mode «En directe»**, com la resta d'entrades (§11.17): allà
  l'agulla ensenya el que diu l'estació.
- Girar-la, com moure qualsevol entrada, treu el resultat de la pantalla
  (§11.19).

De passada: «Vent del est» i «Vent del oest» passen a «de l'est» i «de
l'oest».

El que no s'ha fet: la direcció no viatja a l'adreça, com la resta de la
meteorologia. És la 12.11.

Comprovat al navegador: arrossegant l'agulla cap a l'est queda «Vent de
l'oest, 270°» i cap a l'oest «Vent de l'est, 90°»; fletxa dreta suma cinc
graus i Re Pàg quaranta-cinc; el full d'estils de la pantalla segueix dins del
pressupost de 20 kB (§11.7), que ha calgut vigilar. Les lletres de la rosa no
es poden seleccionar: arrossegant l'agulla s'emportaven la selecció.

### 11.24. Les seccions de la configuració es pleguen

Decidit el 14/11/2026, a petició de Pere. La columna esquerra porta sis
seccions (§11.17) i no caben en una pantalla: per arribar a les eines
d'ignició calia desplaçar-se per sobre del combustible.

Cada secció és ara un `<details>` del navegador, amb el títol com a `summary`
—el mateix element que els països del primer pas del formulari (§2.18), i pel
mateix motiu: plegar i desplegar, el teclat i el que en diu un lector de
pantalla ja venen fets. El títol segueix sent un `h3` a dins.

- **Obertes d'entrada: àrea d'estudi, meteorologia i eines d'ignició**, que
  són el que cal per posar un foc i engegar-lo. **Plegades: combustible,
  escenaris i contramesures**: la primera és una lectura llarga i les altres
  dues encara no fan res (§11.17).
- **Una fletxa a l'esquerra del títol** diu si és oberta; la icona o
  l'etiqueta de la secció queden a la dreta.
- **No es recorda entre visites.** Recarregar torna a l'estat d'entrada.

De passada s'han tret del full d'estils set blocs que ja no pintaven res
—risc, contenció, comparació d'escenaris—, restes de quan la columna dreta
sortia de `SAMPLE` (§11.19). Són 1,4 kB i deixen el pressupost amb marge.

Comprovat al navegador: les sis seccions es pleguen i es despleguen, amb tres
obertes d'entrada, i ja no hi ha cap desplegable a la columna.

### 11.25. La columna d'anàlisi es plega, es tria, i diu com es comporta el front

Decidit el 14/11/2026, a petició de Pere, que també va deixar afegir les dades
que fossin pròpies de l'estudi d'incendis.

**Es plega com l'altra columna** (§11.24): indicadors, les dues gràfiques, la
propagació prevista, el combustible cremat i les condicions del càlcul són
cadascun un `<details>`. D'entrada són oberts els indicadors, la gràfica de
superfície i la previsió; les condicions del càlcul s'obren soles mentre no hi
ha resultat, que és quan són l'única cosa a llegir.

**I es tria què s'hi veu.** El botó «Dades» de la capçalera obre una llista
amb una casella per indicador i per bloc. El que es desmarca desapareix, i la
tria **es desa al navegador** (`localStorage`), perquè és una preferència de
qui mira i no part de la simulació: no viatja a l'adreça, i un enllaç
compartit s'obre amb la columna de qui el rep. Si el navegador no deixa
desar, val per a la visita i prou.

**Quatre dades noves, i d'on surten.** La columna deia quant crema i cap on;
no deia **com** crema, que és el que es mira per saber si un front es pot
atacar.

- **Intensitat del front**, en kW/m: la de Byram (1959), la calor que allibera
  cada metre de front per segon. És la calor per unitat de superfície —la
  intensitat de reacció de Rothermel sostinguda durant el temps de residència,
  384/σ minuts (Anderson 1969)— per la velocitat de propagació. Es calcula a
  la velocitat **de cap** de cada cel·la i es dona la més alta de les cel·les
  assolides en els darrers deu minuts, com la velocitat (§11.19): el tram més
  dur del front, no una mitjana.
- **Longitud de flama**, en metres: també de Byram, 0,0775 · I^0,46.
- **Dificultat de control**: la banda del *fire characteristics chart*
  (Andrews i Rothermel 1982) en què cau aquella flama, amb els talls a 1,2,
  2,4 i 3,4 m (4, 8 i 11 peus): atac directe amb eines manuals, cal maquinària
  o mitjans aeris, l'atac al cap deixa de ser efectiu, i fora de capacitat
  d'extinció. A diferència dels trams de potència de la §2.17 i de pendent de
  la §11.13, **aquests talls no són d'aquest treball**: són la referència del
  sector.
- **Avanç màxim**, en km: fins on ha arribat el foc des de la ignició més
  propera a cada cel·la, en línia recta.

I un bloc: **combustible cremat**, la superfície per model d'Anderson fins al
minut del cursor. Diu de què viu el foc, i és el que fa llegible un resultat
que surt de combustible cartografiat i estimat (§11.21). És una passada per la
graella, de manera que només es fa mentre el bloc és a la pantalla.

**El que cal dir d'aquestes xifres:**

- **Són de foc de superfície.** Sense capçades (§11.19), una flama de quatre
  metres sota arbrat ja seria un altre foc, i el model no ho sap. La banda
  «Extrema» vol dir que la superfície sola ja no es pot aturar, no que s'hagi
  calculat què passa després.
- **La intensitat és la de cap**, encara que la cel·la hagi cremat de flanc:
  és un sostre, com la velocitat que l'acompanya.
- **La dificultat de control és una lectura de la flama, no una tàctica.** La
  nota de sota de la columna ho diu, al costat del «no serveix per prendre
  decisions d'emergència» de sempre.

Comprovat: les longituds de flama dels vuit models només de mort surten **a
menys d'un peu** de les que imprimeix Anderson (1982), en les mateixes
condicions de referència que les velocitats —és la comprovació que la §11.19
esmentava i que no tenia prova escrita—, i hi ha prova de l'avanç i de la
intensitat sobre una graella petita. Passen les 23 proves de simulació i la
compilació. **Al navegador no s'ha mirat**: ho prova Pere.

De passada surten cinc icones i el bàner de risc que ja no feia servir ningú:
el paquet inicial tocava el pressupost d'1,6 MB.

### 11.26. Els escenaris són fitxers de text, i la reproducció va més a poc a poc

Decidit el 14/11/2026, a petició de Pere, i tanca la 12.11.

**Un escenari és un fitxer `.txt` que es desa i es carrega.** La 12.11
plantejava dues vies —tot a l'enllaç, o desat al navegador— i deia que sense
base de dades no n'hi havia cap altra. N'hi ha una, i és la més vella: un
fitxer. «Desar» en baixa un i «Carregar» en llegeix un.

- **Es pot compartir i es pot guardar**, que és el que l'enllaç dona i el
  navegador no, i a més té nom, es pot adjuntar a un informe i no depèn que
  aquesta aplicació segueixi a la mateixa adreça.
- **Text pla i no JSON**: una línia `clau = valor` per dada, en català i amb
  les unitats escrites als comentaris. És un fitxer que algú obrirà d'aquí a
  un any amb un bloc de notes, i ha de dir què és a qui l'obre i aguantar que
  l'editin a mà: finals de línia de Windows, espais, una coma decimal.
- **Què porta**: el domini —els quatre segments de l'adreça (§11.4)—, les
  ignicions amb el format de sempre (§11.16) i la meteorologia. Res calculat:
  el terreny i el combustible es tornen a llegir, i el foc és el mateix
  perquè el càlcul no té atzar (§11.19).
- **La meteorologia que es desa és la que mana**, vingui dels lliscadors o
  d'una estació (§11.18), i **es carrega sempre com a manual**. «El que deia
  l'estació aquell dia» no és cosa que un fitxer pugui tornar a demanar, i un
  escenari ha de donar el mateix foc.
- **Carregar passa per l'adreça.** La meteorologia va als valors manuals i la
  resta es navega: un escenari carregat i un enllaç enganxat acaben en el
  mateix estat, sense un segon camí (§2.26).
- **Estricte amb el que cal i tolerant amb la resta.** Sense domini o sense
  meteorologia el fitxer es rebutja dient què hi falta. Una clau desconeguda
  se salta, una ignició que no s'entén es descarta, i un valor fora del que
  admeten els lliscadors es retalla. Els codis del domini només poden ser
  lletres, xifres i guió baix: van a parar a una adreça.

El que no fa: no hi ha llista d'escenaris desats, perquè són a la carpeta de
baixades de qui els desa i no aquí. I un escenari d'una altra versió del
model donarà un altre foc; el fitxer porta `versio` per poder-ho dir algun
dia.

**La reproducció passa a trenta segons de foc per segon**, dotze hores en
vint-i-quatre minuts a 1×. Eren dos minuts, i el foc s'acabava abans de poder-lo llegir:
sota arbrat un front fa unes quantes cel·les per hora (§11.21). El selector
guanya 30× i 60× per a qui vol el resum: a 60× les dotze hores són 24 segons,
i a 10×, poc menys de dos minuts i mig. Una primera versió del mateix dia ho
deixava en una hora de foc cada trenta segons, per haver llegit malament la
xifra que es demanava.

**La pantalla del simulador es carrega quan s'obre.** Amb els escenaris el
paquet inicial passava d'1,6 MB, i el que calia no era apujar el límit sinó
mirar què hi feia: el model, els *shaders* i una consola de tres columnes
viatjaven amb la portada, que no en dibuixa res. Ara la ruta `simulador` és un
tros a part de 104 kB i **el paquet inicial baixa d'1,60 a 1,50 MB**. La
pantalla s'obre en una pestanya pròpia (§11.4), de manera que no hi ha cap
espera nova al mig d'una navegació. La §3.8 de la fase 1 deixava dit que
partir el paquet quedava per si algun dia es mesurava; s'ha mesurat.

Comprovat: sis proves del format —anada i tornada, edició a mà, límits,
ignició il·legible, fitxers que no ho són, nom del fitxer—, les 29 proves de
simulació i la compilació sense avisos. **Al navegador no s'ha mirat**: ho
prova Pere.

### 11.27. Les contramesures canvien la velocitat, no el combustible

Decidit el 15/11/2026, i tanca la 12.12. El detall tècnic complet —taula
d'efectes, límits, format— és a [contramesures.md](contramesures.md); aquí
queda el que es va decidir i per què.

**Com es va fer.** En paral·lel i amb dos agents: Codex el model i els
escenaris (`countermeasures.ts`, `fire-spread.ts`, `scenario.ts`), Claude el
panell i el mapa (`countermeasure-plan.ts`, `countermeasure-display.ts`). El
contracte entre les dues meitats —el tipus `Countermeasure` i la
rasterització— es va fixar primer, en un commit propi (`e3d6abd`), perquè cap
de les dues bandes l'hagués d'endevinar. La coordinació va viure en un fitxer
fora del repositori.

**La resposta a la 12.12: es toca la velocitat de propagació.** Les tres vies
que plantejava —treure combustible, apujar-ne la humitat, aturar el front—
es redueixen a dues operacions sobre el camp de velocitats que el Dijkstra ja
recorre (§11.19):

- **Barrera**: la cel·la no propaga. És la línia de defensa (30 m) i el
  tallafoc (60 m).
- **Multiplicador**: la velocitat es multiplica per `1 − reducció`. Permanent
  per a la tala i desbrossament (50 %); amb caducitat per a la línia d'aigua
  (70 %, 30 min), l'helicòpter (70 %, 20 min), l'avió amfibi (80 %, 30 min) i
  el retardant (60 %, 180 min).
- **Contrafoc**: no frena res, encén. Són ignicions noves al minut del
  desplegament, i per això **pot augmentar** l'àrea cremada.

> **Revisat el 16/11/2026** (§11.31): la tala, l'aigua, els mitjans aeris i
> el retardant ja no es creen com a multiplicadors sinó com a mesures
> físiques —combustible retirat i litres descarregats— que sí que recalculen
> Rothermel a la cel·la. Els multiplicadors segueixen sent vàlids als
> escenaris que els porten. I les barreres ja no són absolutes: amb les brases
> activades (§11.30) un focus pot saltar-les.

No es reescriu el llit de Rothermel: el combustible original no es modifica
mai, i la intensitat de Byram (§11.25) baixa perquè surt de la velocitat ja
reduïda. Desbrossar no reconstrueix el model d'Anderson de la cel·la; n'és una
aproximació. Era la via que no obligava a recalcular Rothermel per a cada
mesura, i la que manté separats el terreny i el que s'hi fa a sobre.

**Els números són paràmetres, no rendiments.** Els valors de la llista són
il·lustratius i es poden editar al panell; cap no surt d'una calibració amb
brigades o aeronaus. El catàleg ho porta escrit al codi, i el document de les
contramesures també.

**Les barreres són ideals.** Sense salt de brases, sense capçades i sense
probabilitat de fallada, una línia que el model no deixa travessar no
demostra que una de real aguantés. És la mateixa frontera de la §11.19 i de
la §11.25: foc de superfície i prou.

**Geometria a la graella de 30 m.** Una franja o un disc agafen totes les
cel·les que toquen, amb la distància exacta del quadrat al segment. És
conservador: la petjada pot sortir més ampla que el traç, sobretot en línies
de 30 m. Els salts llargs del Dijkstra comproven les cel·les travessades i els
contactes en diagonal, perquè una barrera prima no es pugui saltar pel
vèrtex. On dues mesures se solapen mana la reducció més forta, i no es
multipliquen: dues del 70 % no fan una del 91 %.

**El temps es talla per trams.** Una reducció temporal només frena el tros de
trajecte que cau dins de la seva finestra, tant en activar-se com en caducar.
Això conserva l'ordre d'arribada que el Dijkstra necessita. La caducitat és
discreta —a `startMin + durationMin` l'efecte desapareix—, no una evaporació.

**Al mapa són eines, com la d'ignició** (§11.15). Els botons desactivats que
la §11.17 havia deixat a la columna de configuració passen a ser el catàleg.
Una franja es fa clicant vèrtexs i es tanca amb un botó explícit; una
descàrrega és un clic; Escape deixa l'eina. El pla és una classe de
*signals* que es prova sense mapa, i es dibuixa sobre el relleu amb l'amplada
real. Una franja a mitges no deixa calcular ni desar.

**Els escenaris passen a la versió 3** (§11.26): una línia
`contramesures = [...]` amb JSON dins del text. Les versions 1 i 2 s'obren
igual. Aquí, a diferència de la resta del fitxer, **un pla mal format es
rebutja sencer**: perdre una barrera en silenci canviaria la pregunta que es
fa al model, i això és pitjor que no obrir el fitxer.

### 11.28. Les contramesures es despleguen amb el foc en marxa

Decidit el 15/11/2026. La primera versió del pla (§11.27) només deixava
preparar mesures abans de calcular. Ara cada mesura porta **el minut en què
es desplega**, `startMin`, i es pot posar durant la reproducció.

- **Triar una eina pausa el rellotge.** En col·locar la descàrrega o tancar la
  franja es registra el minut del cursor i es recalcula la previsió. El foc
  anterior al desplegament **es conserva idèntic**: les proves comproven que
  les arribades i totes les sèries d'abans no canvien, per a les vuit eines.
- **El desplegament és instantani.** No es modelen ni el temps de construir
  una línia ni el que triga un mitjà a arribar. És una simplificació
  conscient: el que es pregunta és què fa la mesura, no si arriba a temps.
- **El que ja ha actuat no s'edita.** Una mesura del passat queda bloquejada
  —la llista diu «Programada», «Desplegada» o «Caducada»—; tornar a l'inici
  permet revisar tot el pla. Si el recàlcul falla, es recuperen el pla i el
  resultat anteriors.
- **Una barrera tardana no apaga el que ja crema**, i el contrafoc es
  comprova contra les barreres actives en aquell minut.

Comprovat: 82 proves (56 de simulació i 26 d'Angular) i la compilació de
producció sense avisos. Aquesta vegada **sí que s'ha mirat al navegador**, amb
Sóller i dades reals de l'API: un helicòpter a T+3 h conserva les 5,9 ha
cremades i baixa la previsió d'una hora de 10,6 a 9,6 ha. La captura és fora
del repositori.

### 11.29. El vent pot canviar durant la simulació

Decidit el 15/11/2026, fet per Codex. Fins ara el vent era un de sol per a
les dotze hores (§11.18), i un canvi de vent és precisament el que gira un
incendi. Ara l'escenari pot portar **fins a cent canvis**, cadascun amb el
minut, la velocitat a 10 m i la direcció d'origen.

- **Cada canvi és instantani i es manté fins al següent.** No hi ha
  interpolació entre dos canvis: és el mateix tipus de simplificació que la
  caducitat discreta de les contramesures (§11.27), i fa que el temps es pugui
  tallar per trams exactes.
- **El model ho integra per trams.** Un trajecte que travessa un canvi de vent
  es calcula amb l'el·lipse de cada tram, com ja es feia amb els tractaments
  temporals, i l'ordre d'arribada del Dijkstra es conserva. El vent a mitja
  flama es recalcula per a cada model de combustible.
- **Viatja a l'escenari**, i el fitxer passa a la versió 4. Els límits són els
  dels lliscadors: 0–60 km/h, minuts únics i ordenats entre 0 i 720.

### 11.30. Focus secundaris per brases, opcionals i reproduïbles

Decidit el 15/11/2026, fet per Codex. La §11.27 deixava les barreres ideals
perquè el model no tenia salt de brases, i la §11.25 recordava que el foc és
només de superfície. Les brases són la primera escletxa en aquella frontera.

- **Desactivades per defecte.** Es configuren abans d'iniciar, amb una
  casella i una llavor. Sense activar-les, el resultat és el de sempre. La
  llavor per defecte és **1** des del 16/11/2026: era 2026, i a la pantalla
  es llegia com un any. Un escenari que ja la porta escrita no canvia.
- **Com funciona**: cada cel·la que crema pot emetre una brasa amb una
  probabilitat que creix amb la intensitat de Byram (§11.25) i és més alta
  sota combustible llenyós. La brasa vola amb el vent —integrant-ne els
  canvis (§11.29)—, una distància que també depèn de la intensitat, entre
  30 m i 2 km. On cau s'encén segons la humitat del combustible fi, la càrrega
  i la temperatura. Si encén, és una ignició nova dins del mateix Dijkstra.
- **Atzar reproduïble.** El número aleatori surt d'un *hash* de la llavor i de
  la cel·la, no d'una seqüència. Això vol dir que el mateix escenari dona el
  mateix foc, que era una premissa des de la §11.19, i que editar una cosa
  lluny no canvia les brases de la resta del domini.
- **No és la taula operativa.** La probabilitat d'ignició és experimental i no
  la de NWCG; ho diu el codi i ho diu la pantalla.
- **Una brasa pot saltar un tallafoc.** És la conseqüència buscada: ara una
  barrera de la §11.27 ja no és absoluta. Les cel·les amb un tractament que
  atura el foc tampoc no s'encenen per brasa.

La columna d'anàlisi llista els focus secundaris —origen, hora i distància— i
el mapa els dibuixa.

### 11.31. Les contramesures es tornen físiques: litres i combustible retirat

Decidit el 15/11/2026, fet per Codex. Revisa la §11.27, que reduïa tot a un
multiplicador de la velocitat amb percentatges inventats. Ara les mesures que
ho permeten es descriuen amb **el que es fa** i el model en treu l'efecte.

- **Descàrregues en litres.** Aigua, helicòpter, avió amfibi i retardant es
  defineixen amb litres per passada, nombre de passades (1–20) i minuts entre
  passades (1–120). La capacitat màxima per passada és la d'un aparell de
  referència amb font citada al codi: **Bell 412** amb dipòsit ventral,
  1.350 L; **Canadair CL-415**, 6.137 L; **Air Tractor AT-802F**, 3.104 L. No
  és la capacitat de tots els aparells, sinó d'un de concret i nomenat.

  > **Revisat el 16/11/2026** (§11.44): l'amfibi de referència és ara el
  > **DHC-515**, 7.000 L, i l'interval entre passades d'un mitjà aeri ja no
  > s'escriu: surt d'on carrega.
- **L'aigua mulla el combustible mort fi.** Els litres es reparteixen sobre la
  petjada, se'n reté un 30 % i aquesta aigua s'afegeix a la humitat de
  1 h, que s'asseca amb una constant d'una hora. Amb la nova humitat **es
  recalcula Rothermel** a la cel·la, i si supera la d'extinció el foc no hi
  passa. El combustible viu no es toca. El retardant només es representa com a
  humectació equivalent: no hi ha el residu químic.
- **La tala retira càrrega.** Es defineix amb el percentatge de combustible
  que queda (per defecte el 20 %, mínim el 5 %), i el llit de la cel·la es
  recalcula amb aquesta càrrega. Ja no és una aproximació de la velocitat.
- **El combustible original segueix sense modificar-se.** Els tractaments
  són un historial per cel·la que es consulta minut a minut; la humitat es
  pren constant a trams de cinc minuts perquè el Dijkstra pugui integrar
  cada tram exactament.
- **Les mesures noves es creen físiques; els multiplicadors queden.** Un
  escenari antic amb reduccions en percentatge s'obre i calcula com abans. Les
  dues coses no es barregen en una mateixa mesura.

De passada, un error de Rothermel: el factor d'amortiment per humitat és un
polinomi que, amb humitats prou altes, donava negatiu i hauria donat una
intensitat de reacció negativa. Ara es retalla a zero. Amb el combustible
xop per les descàrregues, aquesta situació havia deixat de ser teòrica.

**El que segueix sent hipòtesi**: el 30 % de retenció, l'hora d'assecat i
les probabilitats de les brases no surten de cap calibració. Ho diu la nota
de la pantalla, i passa a la 12.16.

Comprovat: les 72 proves de simulació i les 28 d'Angular, i la compilació de
producció sense avisos, amb proves noves per al vent, les brases i els
tractaments. **Al navegador, no consta que s'hagi mirat**: el fitxer de
coordinació no en diu res.

### 11.32. Un escenari és una entrada de fora, i es llegeix com a tal

Decidit el 16/11/2026, a petició de Pere, després de preguntar si un fitxer
d'escenari podia servir per colar codi maliciós. La resposta és que no: res
del fitxer no s'executa —`JSON.parse` només fa dades, no hi ha `eval` ni
`innerHTML` amb dades seves, Angular escapa el nom en mostrar-lo i els codis
del domini que van a l'adreça només admeten lletres, xifres i guió baix. Però
la revisió va deixar tres retocs:

- **La mida es mira abans de llegir.** El límit d'1 MB es comprovava sobre el
  text, és a dir, després de carregar el fitxer sencer: un de diversos GB
  penjava la pestanya abans de ser rebutjat. Ara la pantalla mira
  `file.size` primer, i el límit és una constant compartida amb el lector.
- **Una contramesura amb un camp desconegut es rebutja.** Abans el lector
  copiava els camps que coneixia i perdia la resta en silenci. És el mateix
  criteri que ja tenia el pla (§11.27): un camp que aquesta versió no entén
  pot ser un que canviï el foc, i perdre'l sense dir-ho canvia la pregunta.
  El missatge diu quin camp és.
- **El comentari de `parseScenario` deia una cosa que el codi no feia**: que
  les claus desconegudes se salten «perquè un fitxer més nou s'obri en una
  pantalla més antiga». Des que hi ha `versio` (§11.26), un fitxer més nou es
  rebutja abans. Ara diu el que hi ha: versió nova rebutjada sencera, estricte
  amb el que canvia el foc, tolerant amb línies desconegudes, que és el que
  permet que un fitxer editat a mà porti notes.

El que no es toca: un escenari amb tots els màxims pot fer el càlcul lent, i
el nom pot dir qualsevol cosa. Cap de les dues coses fa mal fora de la
pestanya.

Comprovat: una prova nova del camp desconegut, les 73 proves de simulació i
les 28 d'Angular, i la compilació sense avisos. **Al navegador no s'ha
mirat**: ho prova Pere.

### 11.33. Un escenari antic s'actualitza, no es perd

Decidit el 16/11/2026, a petició de Pere: un escenari antic no s'ha de perdre
per culpa d'una clau que encara no existia quan es va desar, i les claus noves
importants s'hi han d'afegir.

- **Una clau que falta pren el valor per defecte, i es diu.** El lector
  (`readScenario`) torna l'escenari, la versió que diu ser —o la 1 si no ho
  diu— i la llista de claus que ha hagut d'omplir. Els valors per defecte són
  els de la pantalla quan s'obre (`SCENARIO_DEFAULTS`, que ara comparteixen
  el lector i els lliscadors): sense pla, vent constant, sense brases, i la
  meteorologia dels lliscadors.
- **La meteorologia que falta ja no fa rebutjar el fitxer.** S'omple, i
  l'avís ho diu. **El domini, sí**: res no pot fer de valor per defecte d'on
  és el foc. I una clau que hi és però no es pot llegir —«humitat = molta»—
  segueix rebutjant el fitxer: no falta, és errònia.
- **En carregar un escenari antic, la pantalla ho diu i ofereix «Desar
  actualitzat»**: quina versió era i què s'hi ha afegit. Desar-lo escriu la
  versió 4 amb totes les claus.
- **Desar escriu ara totes les claus, també les buides** —`contramesures =
  []`, `canvis_vent = []`—. Abans s'ometien perquè un escenari sense pla fos
  el fitxer de sempre (§11.26); però llavors un fitxer actual semblaria
  antic en llegir-lo, i el fitxer ja diu sol tot el que val.
- **No es converteix res que ja hi sigui.** Les contramesures antigues amb
  percentatges es queden com són (§11.31): passar-les a litres inventaria una
  dada que ningú no va decidir i canviaria el foc.

El mateix mecanisme serveix per a les versions que vinguin: si una clau canvia
de forma, el lector la convertirà i ho afegirà a la llista, en comptes de
rebutjar el fitxer. Una versió més nova que l'aplicació es continua
rebutjant (§11.32).

Comprovat: dues proves noves —un fitxer sense versió, humitat ni temperatura,
i un de complet que no ha d'omplir res—, les 75 proves de simulació i les 28
d'Angular, i la compilació sense avisos. **Al navegador no s'ha mirat**: ho
prova Pere.

### 11.34. La pantalla no explica: ho farà el manual d'usuari

Decidit el 16/11/2026, a petició de Pere. Cada secció de la consola havia anat
acumulant paràgrafs que explicaven el model —què fa una contramesura, d'on surt
el combustible, què és una brasa—, i un usuari que obre la pantalla els rep tots
de cop, els vulgui o no. **Les explicacions aniran a un manual d'usuari**, que
es farà més endavant; la pantalla queda per treballar.

Surten:

- les introduccions de les seccions de combustible, escenaris i contramesures,
  i la nota de WorldCover;
- les notes fixes de sota del vent, dels escenaris, de les brases i del pla de
  contramesures —la més llarga, amb les hipòtesis de retenció i assecat—;
- l'ajuda de cada eina de contramesura mentre està a la mà, que repetia el que
  fa el model (el text era a `countermeasure-plan.ts` i també surt);
- «Primera passada al desplegament» al costat del total de litres;
- **l'avís «Un simulacre, no una predicció»** del peu de la columna d'anàlisi,
  amb el seu estil. El botó ja diu «crear simulació»; el descàrrec de
  responsabilitat que portava, «no serveix per prendre decisions
  d'emergència», haurà d'anar al manual.

Es queden:

- els **avisos d'estat i d'error** —«Previsió actualitzada…», «N focus per
  brases…», el resultat de desar o carregar—, que diuen què acaba de passar i
  no com funciona res;
- les **instruccions mínimes d'una eina activa** —«Fes clic al terreny…»,
  «prem Finalitzar»—, sense les quals l'eina no es pot fer servir;
- les **dades**: la llista de models de combustible, el total de litres,
  l'aparell de referència amb el seu enllaç, i les fonts del combustible amb
  l'atribució, que és obligatòria per llicència (§6 de la fase 1);
- a la columna d'anàlisi, la nota de la propagació prevista —«les bandes són
  temps d'arribada, no probabilitats»—, que és el que cal per llegir bé la
  gràfica.

Això reobre una cosa que la §11.25 i la §11.31 deien: que les hipòtesis del
model «ho diu la pantalla». Ara ho diuen la bitàcola i
[contramesures.md](contramesures.md), i ho dirà el manual. Queda com a
pendent 12.18.

Comprovat: les 75 proves de simulació i les 28 d'Angular, i la compilació
sense avisos. **Al navegador no s'ha mirat**: ho prova Pere.

### 11.35. Les flames fan la mida de la intensitat, i un front aturat no en té

Decidit el 16/11/2026, a petició de Pere. Fins ara les flames (§11.20) sortien
repartides per igual al llarg del front, totes de la mateixa mida a l'atzar, i
seguien enceses on el front esperava: un helicòpter a l'inici de la simulació
deixava una corona de flames quieta durant una hora i mitja.

Abans d'això es va comprovar què feia aquell helicòpter, amb una graella de
prova: 1.350 L sobre 11 cel·les d'herba (model 1) pugen la humitat fina del 6
al 31 %, per sobre del 12 % d'extinció. El foc s'atura mentre l'aigua no
s'asseca —unes 1,5 h amb la constant d'una hora— i després es reprèn: a les
4 h, 88 ha en comptes de 142. No és un error, sinó la §11.31 fent el que diu;
sobre matollar la mateixa aigua quasi no fa res.

**La intensitat de cada punt del front** és la de Byram (§11.25), però amb
dues diferències que la fan servir per dibuixar:

- **La velocitat és la real**, la que surt dels temps d'arribada: el pendent
  del pla que passa pels tres vèrtexs de cada triangle del front
  (`activeFront`, que ara en dona el ritme en minuts per cel·la). Així hi
  entren totes les coses que alenteixen el foc —barreres, multiplicadors,
  aigua, esperes—, i no la velocitat de cap teòrica de la cel·la.
- **La calor és la de la cel·la on el front entra**, tractada si una
  contramesura l'ha mullada o n'ha tret combustible. El resultat del càlcul
  porta ara `heat`, la calor per superfície de cada cel·la sense tractar; la
  tractada surt de l'historial de tractaments. Amb el combustible per sobre de
  la humitat d'extinció, Rothermel no hi dona calor.

**De la intensitat a la flama dibuixada**: la longitud de flama de Byram i,
d'aquí, una mida entre 0 i 1 en escala logarítmica, de 0,3 a 12 m.

- **Per sota de 0,3 m no hi ha flama.** El front s'arrossega o espera, i el
  que queda és la brasa de terra, que ja s'apagava sola amb el temps (§11.20).
  Una herba que espera una hora i mitja dona uns 0,2 m: sense flames. Un foc
  lent sota arbrat (model 8) fa mig metre: amb flames petites.
- **La flama més petita és un quart de la més gran**, perquè es vegi a 30 km.
- **Més alçada i amplada com més intensa**, i **més flames on el front és més
  intens**: cada partícula tria on néixer amb una probabilitat proporcional al
  quadrat de la mida. El nombre total de partícules no canvia.

Segueix sent una imatge, com deia la §11.20: una flama de tres metres no ocupa
ni un píxel. El que és nou és que la seva mida relativa surt del model.
Només canvia el dibuix: ni els temps d'arribada ni cap xifra de l'anàlisi.

Comprovat: cinc proves noves —el ritme del front, la corba de mida, que un
front més ràpid fa flames més grans, que un front aturat o mullat no en fa, i
que les flames van on el front és més calent—, les 80 proves de simulació i les
28 d'Angular, i la compilació sense avisos. **Al navegador no s'ha mirat**: ho
prova Pere.

### 11.36. Cada contramesura costa el que fa, i no tota la graella

Decidit el 16/11/2026, després que Pere notés que cada contramesura afegida
feia més lent el càlcul. Cada desplegament torna a calcular el foc sencer des
del minut 0 (§11.28), de manera que el que costa una mesura es paga a cada
desplegament següent.

**Mesurat**, sobre la graella real de 1024 × 1024, herba sota arbrat (model 2),
vent de 20 km/h i 18 h de càlcul, amb descàrregues d'helicòpter de 1.350 L:

| Descàrregues | Abans | Ara |
| --- | --- | --- |
| 0 | 0,59 s | 0,58 s |
| 1 | 1,51 s | 0,74 s |
| 5 | 1,81 s | 0,80 s |
| 10 | 2,27 s | 0,89 s |
| 20 | 3,23 s | 1,10 s |

I els temps d'arribada **són idèntics** cel·la per cel·la als del codi
anterior, amb 1 i amb 20 descàrregues. Al navegador les xifres seran més altes,
però en la mateixa proporció.

D'on venia el cost, i què s'hi ha fet:

- **Una sola mesura física passava tota la graella al camí lent.** Amb vent
  canviant o tractaments (§11.29, §11.31), cada pas de Dijkstra anava pel càlcul
  dependent del temps, també a les cel·les que cap mesura no toca. Ara només hi
  van les cel·les tractades —o totes, si el vent canvia—; la resta llegeix
  l'el·lipse de sempre, que és exactament el que el camí lent els hauria donat.
- **Dues consultes a un `Map` per cada tram de cada pas**: si la cel·la tenia
  tractament de combustible, i si un cantó tenia un tractament temporal. Són
  milions de consultes per càlcul. Ara són dues màscares d'un byte per cel·la,
  fetes una vegada.
- **L'aigua no s'assecava mai.** L'excés d'humitat decau exponencialment i no
  arriba a zero, de manera que una cel·la mullada es recorria a trams de cinc
  minuts fins al final del càlcul, cada vegada que un pas la travessava. Ara,
  quan l'aigua que queda és de menys d'**una dècima de punt** d'humitat
  (`WETTING.driedMoisture`) i no ve cap altra passada, la cel·la torna a ser el
  seu combustible. Amb la constant d'una hora, uns cinc o sis hores després de
  la descàrrega. Aquella dècima mou la velocitat de Rothermel bastant menys
  d'un 1 %, i en les proves no ha canviat cap arribada.
- **L'estat d'una cel·la tractada es desa per a cada tram**, i no només el
  darrer: Dijkstra hi passa en ordres de temps diferents i el desat únic es
  refeia a cada consulta.
- **Al mapa, les mesures es tornaven a generar a cada minut de la
  reproducció.** La llista de mesures visibles depenia del cursor, i cada
  minut en sortia una de nova encara que fos igual: totes les franges i els
  discos es refeien i MapLibre tornava a trossejar el GeoJSON. Ara la llista
  només canvia quan hi entra o en surt una mesura, i el mateix per als focus
  per brases.

El que no es fa, i per què: **calcular només a partir del minut del
desplegament**. El foc d'abans no canvia, però els passos que travessen aquell
minut s'han de tornar a calcular des de totes les cel·les ja cremades, i el
guany seria de la part cremada abans del desplegament, que sol ser petita.

Comprovat: una prova nova de l'assecat, les 81 proves de simulació i les 28
d'Angular, i la compilació sense avisos. **Al navegador no s'ha mirat**: ho
prova Pere.

### 11.37. Una brúixola que només indica

Decidit el 16/11/2026, a petició de Pere. En relleu la vista es gira (§11.3), i
amb el mapa girat no hi havia res que digués on és el nord.

- **A baix a la dreta del mapa**, el racó lliure: la barra d'eines és a dalt a
  la dreta, el temps i la llegenda a l'esquerra, i l'escala i els crèdits a
  baix a l'esquerra.
- **Una agulla amb la N** que gira el contrari del que gira la vista. El servei
  del mapa porta l'orientació com a senyal (`bearing`), que MapLibre actualitza
  a cada gir.
- **Només indica, no es clica.** Ho va triar Pere entre això i un botó que
  tornés el nord amunt; girar la vista es fa al mapa.
- L'estil és el de la barra d'eines, en un disc, i el nord en el taronja del
  foc.

Comprovat: les proves i la compilació sense avisos. **Al navegador no s'ha
mirat**: ho prova Pere.

### 11.38. Decidir al passat esborra les mesures posteriors, amb avís

Decidit el 16/11/2026, a petició de Pere. Si una mesura no ha funcionat, s'ha de
poder tornar enrere i provar-ne una altra sense que en quedi rastre. La primera
idea —esborrar una mesura en portar el cursor abans del seu desplegament— es va
descartar perquè moure el cursor és sobretot mirar: arrossegar la línia de temps
per comparar, tornar a reproduir des del minut 0 o carregar un escenari haurien
esborrat mesures sense voler-ho.

El que es fa és el «desfer» d'un editor: **mirar el passat no esborra res;
decidir-hi alguna cosa nova, sí.**

- **Amb un foc calculat i el cursor abans d'alguna mesura, triar una eina de
  contramesura avisa abans**: «Si modifiques l'escenari, les N mesures
  posteriors que estaven guardades s'eliminaran», amb «Continuar» i
  «Cancel·lar».
- **Les mesures no s'esborren en acceptar, sinó en afegir la nova.** Si es
  deixa l'eina sense dibuixar res —Escape, una altra eina, moure el cursor,
  reproduir—, no es perd res. En afegir-la, la nota ho diu: «S'han eliminat N
  mesures posteriors».
- **Posterior vol dir desplegada després del minut del cursor**; les del mateix
  minut es queden. Les d'abans ja estaven bloquejades (§11.28).
- **El recàlcul és el de sempre** (§11.28): el foc d'abans del cursor no canvia,
  el de després es torna a calcular sense les mesures esborrades. Si el càlcul
  falla, tornen totes.
- **Abans de calcular no hi ha avís**: un pla encara no és un passat, i un
  escenari carregat pot portar mesures programades per a més tard.

El que no fa: editar o suprimir una mesura programada no esborra les altres,
perquè és tocar aquella mesura i prou. I **els canvis de vent posteriors no
s'esborren**: l'avís és de les contramesures, que és el que es va demanar.

Comprovat: una prova nova del pla —sense acceptar no es perd res, acceptar i
deixar l'eina tampoc, i acceptar i afegir n'esborra exactament les
posteriors—, les 81 proves de simulació i les 29 d'Angular, i la compilació
sense avisos. **Al navegador no s'ha mirat**: ho prova Pere.

### 11.39. Una contramesura es configura en un modal i es posa amb el ratolí

Decidit el 16/11/2026, a petició de Pere. Cada mesura de la llista portava els
seus camps —amplada, litres, passades, interval, combustible restant,
reducció, durada—, i amb unes quantes mesures la columna esquerra era sobretot
caselles. **Els valors es trien una sola vegada, en prendre l'eina, i la llista
només els mostra.**

- **Prendre una eina obre un modal** amb els camps d'aquella mesura: amplada o
  diàmetre, i per a les descàrregues litres per passada, passades i interval
  —amb l'aparell de referència i la seva capacitat—, o el combustible restant
  per a la tala. Tres botons: **Restablir** (els valors del catàleg),
  **Cancel·lar** i **Aplicar**. Aplicar passa els valors per la mateixa
  validació del model (`checkSettings`, sobre `parseCountermeasures`) i, si no
  els accepta, el modal diu per què i no es tanca.
- **El modal recorda els darrers valors de cada eina** durant la sessió, de
  manera que tres descàrregues iguals no demanen tres vegades el mateix.
- **Amb l'eina a la mà, el ratolí porta l'àrea**: el disc de la descàrrega amb
  el seu diàmetre, o per a una línia un disc de la seva amplada fins al primer
  vèrtex i després la franja fins al punter.
- **Descàrregues**: clic esquerre l'aplica on és el punter; clic dret la
  cancel·la.
- **Línies**: clic esquerre afegeix un vèrtex; clic dret treu l'últim, i quan
  no en queda cap la mesura es cancel·la. Es tanquen amb **Aplicar**, un botó
  al centre de la part de baix del mapa, que diu quants vèrtexs hi ha i només
  s'activa amb dos.
- **Una mesura per eina presa.** Aplicada la mesura, l'eina es deixa. Abans es
  quedava a la mà per a la següent; amb un modal pel mig, cada mesura passa per
  ell.
- **El clic dret i el gir del relleu** fan servir el mateix botó (§11.3). Un
  clic és prémer i deixar anar al mateix lloc —menys de 4 píxels—, i qualsevol
  cosa que s'hagi mogut era un gir. Es jutja en deixar anar el botó i no amb
  `contextmenu`, que alguns sistemes disparen en prémer, abans de cap
  moviment. Mentre hi ha una eina a la mà, el menú del navegador no surt.
- **L'avís de la §11.38 va abans del modal**: primer es diu què es perdrà, i
  després es configura.

El que es perd: **una mesura ja posada no es pot editar.** Per canviar-la, se
suprimeix —si encara no ha actuat— i se'n posa una altra. Els mètodes del pla
que editaven una mesura (`setWidth`, `setLiquid`…) es queden, amb les seves
proves, però la pantalla ja no els fa servir. Les mesures d'escenaris antics
amb reducció i durada es mostren igual i tampoc no s'editen.

Comprovat: dues proves noves del pla —els valors triats arriben a la mesura i
es validen abans, i el clic dret treu vèrtexs fins a cancel·lar— i les que
suposaven que l'eina es quedava a la mà, adaptades; les 81 proves de simulació
i les 31 d'Angular, i la compilació sense avisos. **Al navegador no s'ha
mirat**: ho prova Pere. En particular, que MapLibre faci arribar el `mousedown`
i el `mouseup` del botó dret amb el gir del relleu activat no s'ha pogut
comprovar sense navegador.

### 11.40. Les descàrregues fetes s'aparten, i les brigades apaguen les restes

Decidit el 16/11/2026, a petició de Pere. Dues coses que van juntes: un cop
l'helicòpter ha fet les passades i el front s'ha aturat, el que ve després són
les brigades.

**Les descàrregues acabades s'aparten.** Una descàrrega està acabada quan el
cursor ha passat la darrera passada (`lastPass`: inici més passades menys una
per interval). Llavors surt del mapa i, a la llista, va a un grup plegat
«Acabades (N)», amb el nom, l'efecte i l'hora i res més. **Continua al pla i al
fitxer**, i el model en segueix comptant l'aigua fins que s'asseca (§11.36): el
que s'aparta és la imatge, no la mesura. Esborrar-la canviaria el foc ja vist
el pròxim cop que es recalculés (§11.38).

**Una eina nova: extinció de restes.** Les brigades entren on el foc s'ha
aturat i apaguen el que queda encès, perquè no torni a arrencar quan l'aigua
s'assequi.

- **Què fa al model.** Des del minut del desplegament, les cel·les de la franja
  no cremen ni deixen passar el foc, com un tallafoc tardà (§11.28). I a més
  —el que la fa diferent— **el foc que ja havia sortit d'una d'aquestes
  cel·les però encara no havia arribat a la següent s'apaga.** Dijkstra parteix
  cada pas en el tros dins la cel·la d'origen i el tros dins la de destinació;
  quan la destinació espera —combustible mullat, una pujada lenta—, el tros
  d'origen ja s'ha fet abans del desplegament i un tallafoc no el pot aturar. La
  regla és: un pas que surt d'una cel·la apagada abans de l'hora i arribaria
  després, no arriba. Comprovat amb la mateixa franja i el mateix minut: el foc
  s'escapa d'un tallafoc i no d'una extinció de restes.
- **Quan es pot fer servir.** Amb un foc calculat, sobre cel·les que ja hagin
  cremat —sense res cremat, seria un tallafoc gratuït—, i on el front no faci
  flames de més d'**1,2 m**: el límit de l'atac directe amb eines manuals, la
  primera banda del *fire characteristics chart* (Andrews i Rothermel 1982), el
  mateix tall que la columna d'anàlisi fa servir per a la dificultat de
  control (§11.25). La intensitat es llegeix com la de les flames (§11.35): la
  velocitat real del front a la franja i la calor de la cel·la on entra. Un
  front aturat per l'aigua fa ben poca intensitat i es pot apagar; un cap de
  foc en herba, no.
- **Com es rebutja.** El pla demana l'última paraula a qui coneix el foc abans
  d'afegir una mesura (`guard`), i la pantalla hi respon per a l'extinció de
  restes. Si la refusa, la nota diu les flames que fa el front i el límit, i la
  línia es queda dibuixada per poder-la moure o cancel·lar.
- **Al fitxer** és un tipus de mesura nou, `mop-up`, i els escenaris passen a la
  **versió 5**. Les versions 1 a 4 s'obren igual; una aplicació anterior que
  obri un fitxer de la 5 dirà que la versió no és compatible, en lloc d'un
  error estrany sobre un tipus desconegut.

El que no fa: no té temps de feina ni nombre de persones —l'extinció és
instantània a tota la franja, com la resta de desplegaments (§11.28)—, i no mira
si la franja és accessible.

Comprovat: tres proves noves del model —la compilació, que apaga el que un
tallafoc deixaria passar, i la lectura d'intensitat del front— i dues del pla
—quan una descàrrega queda acabada, i que una mesura refusada no entra i la
línia es conserva—; les 84 proves de simulació i les 33 d'Angular, i la
compilació sense avisos. **Al navegador no s'ha mirat**: ho prova Pere.

### 11.41. Parcs, punts d'aigua i aeròdroms al mapa, de la font oficial on n'hi ha

Fet la nit del 16/11/2026, sense Pere, a la branca `senyals-mapa` (12.23). Al
simulador, dins del domini i només dins, hi ha marques verdes per a tres coses:
**parcs de bombers**, **punts d'aigua per als mitjans aeris** i **aeròdroms**.
Es distingeixen pel dibuix —una casa, una gota, un avió— i el nom surt de prop
(zoom 13). Es poden amagar al menú de capes, com els topònims.

**Les fonts, i el que no s'ha trobat.** La premissa de la 12.23 era fer servir
la font oficial i dir-ho quan no n'hi ha:

| Què | Font | Cobertura | Oficial |
| --- | --- | --- | --- |
| Punts d'aigua | ICNF, `sigservices.icnf.pt/.../BDG/Pontos_agua/MapServer/0`, classes «Aéreo» i «Misto» | Portugal continental (17.112 punts, tots els tipus) | Sí |
| Aeròdroms | ENAIRE, `servais.enaire.es/insignia/.../Aero_SRV_VIGOR_V2/FeatureServer/3`, tipus `AD` i `AH` | Espanya | Sí |
| Aeròdroms (Portugal) | OpenStreetMap, `aeroway=aerodrome`, **només si ENAIRE no en dona cap** | On no arriba ENAIRE | No |
| Parcs de bombers | OpenStreetMap, `amenity=fire_station` | ES i PT | No |

- **Punts d'aigua de Balears: no s'han trobat.** L'IDEIB no té cap capa de punts
  d'aigua entre els serveis públics (`geoserveis/rest/services/public`), ni el
  seu catàleg en torna cap. El que hi ha són els manuals de la Generalitat de
  Catalunya sobre com s'inventarien. Ni la resta de comunitats s'han mirat una
  per una. **A Espanya, de moment, no surt cap punt d'aigua.** Al
  Mediterrani, el punt de càrrega de l'helicòpter sovint és la mar, i això cap
  capa ho diu. Queda a la 12.24.
- **Parcs de bombers: cap capa oficial nacional** ni a Espanya (la BTN de l'IGN
  no els porta com a classe) ni a Portugal (el cens de la ANEPC no és obert; hi
  ha capes municipals, com Cascais o Lisboa). OpenStreetMap, dient-ho.
- **Bases de mitjans aeris contra incendis** (MITECO i comunitats): les bases es
  citen a notes de premsa, però no s'ha trobat cap capa. Un aeròdrom d'ENAIRE no
  diu si hi ha retardant: és on podria carregar un avió, no on carrega.
- **Les llicències de l'ICNF i d'ENAIRE no s'han pogut confirmar**: els serveis
  no en publiquen cap. Es dona el crèdit que declaren (§6 de la fase 1).

**Del navegador, sense ruta pròpia.** Els tres serveis responen amb CORS
(comprovat amb l'origen de desenvolupament), de manera que no cal tocar l'API.
Cada font falla per separat: si una no respon, el menú de capes ho diu —«Sense
resposta: ICNF»— i les altres es dibuixen igual. Una resposta completa es guarda
per domini durant la sessió. Overpass és un servei públic que limita la taxa
(§5 de la fase 1); amb una consulta per domini n'hi ha prou, però si es fes
servir molt caldria preparar els parcs fora de línia, com els topònims.

**Al mapa**, una capa `symbol` (no es drapeja, §13.1): les marques queden dretes
sobre el relleu. El verd és el de qui apaga, lluny del taronja del foc. Les
icones es dibuixen en un llenç en carregar l'estil; tres dibuixos no valen un
*sprite*.

**El que encara no fan**: no s'usen per a res més que mirar. Que una brigada
surti del parc més proper o que l'helicòpter carregui al punt d'aigua més
proper és la 12.20 i la 12.22.

Comprovat: set proves noves de la lectura de les tres fonts —la consulta que es
fa, què es descarta, les respostes que no són el que s'esperava—, les 91 proves
de simulació i les 33 d'Angular, i la compilació sense avisos. Les consultes
reals s'han provat des de la línia d'ordres (entorn de Palma: dos parcs a OSM i
tres aeròdroms a ENAIRE —Palma, Son Bonet i Binissalem—; entorn de Lousã: 130
punts d'aigua aeris o mixtos a l'ICNF). **Al
navegador no s'ha mirat**: ho prova Pere.

### 11.42. Les brigades arriben, són tantes i fan tants metres per hora

Fet la nit del 16/11/2026, sense Pere, a la branca `brigades` (12.19). La
numeració deixa la §11.41 per als parcs i punts d'aigua de la branca
`senyals-mapa`, que es va fer la mateixa nit.

**Com es va fer.** Com les contramesures (§11.27): primer el contracte, en un
commit propi (`a692131`) —els tres camps nous, els valors per defecte amb font i
la fórmula de cada cel·la—, i després Codex el model a `brigades-model` i Claude
la pantalla a `brigades`. La coordinació va viure fora del repositori, a
`COORDINACIO_NIT/`. El *sandbox* de Codex no el deixava escriure les metadades
de git del worktree, i el seu commit (`358d111`) el va fer Claude després de
revisar-ne el diff.

**Tres camps, tots tres o cap**: `arrivalMin` (minuts des de la decisió fins que
la brigada treballa al lloc), `crewSize` (efectius) i `ratePerPerson` (metres de
línia per hora i efectiu; hectàrees per hora a l'extinció de restes). Només per a
les mesures que fa una brigada: línia de defensa, tallafoc, tala, línia d'aigua
i extinció de restes. **El contrafoc i els mitjans aeris segueixen
instantanis**. Sense els camps, una mesura és la de sempre: els escenaris antics
donen exactament el mateix foc (Codex ho va comprovar byte a byte en quinze).

**Cada cel·la es fa quan la brigada hi arriba**, des del primer vèrtex i en
l'ordre del dibuix: inici + arribada + recorregut ÷ (efectius × rendiment). A
l'extinció de restes, el recorregut es converteix en àrea amb l'amplada. Cent
efectius fan la línia en la meitat de temps que cinquanta: és lineal, sense
fatiga ni relleus.

**La parada de seguretat** (§11.40): si el foc arriba a una cel·la encara no
feta mentre la brigada hi treballa, amb flames de més d'1,2 m, la brigada
s'atura en aquell minut i el que falta no es fa. Amb flames més baixes segueix:
és atac directe. Com que una parada treu barreres que el càlcul ja havia comptat,
el model **torna a calcular** amb la parada fixada, fins que no n'apareix cap de
nova; el foc d'abans de cada parada no canvia. Amb poques brigades són pocs
recàlculs.

**Els rendiments per defecte, i d'on surten**:

- **Línia de defensa: 40,2 m/h per efectiu** —0,67 m/min—, d'Ortega, Rodríguez y
  Silva i Molina (2023), mesurat en incendis reals d'Andalusia, Castella-la
  Manxa i el País Valencià, en matoll i atac directe. És la font més propera al
  domini que s'ha trobat.
- **Línia d'aigua: 80,5 m/h per efectiu**, de les taules del NWCG (2021):
  autobomba amb quatre persones en matoll, 16 cadenes per hora. La taula avisa
  que és d'atac inicial i no de feina sostinguda.
- **Tallafoc, tala i extinció de restes: provisionals.** Un tallafoc de 60 m és
  feina de maquinària i la taula de la línia manual no hi val; de la liquidació
  no s'ha trobat cap taula (Ortega et al. ho exclouen explícitament). Es fan
  servir 40,2 m/h i 0,05 ha/h, i el modal diu «Rendiment provisional, sense font
  publicada». Queda a la 12.25.
- **20 efectius**, la brigada de referència de les taules del NWCG, i **arribada
  0**, fins que la 12.22 la tregui del parc més proper (§11.41).

Una diferència que convé tenir present: el NWCG, per a brigades de vint en
feina sostinguda, dona 471 peus per hora en matoll, uns 7 m/h per efectiu. És
cinc vegades menys que Ortega et al. Mesuren coses diferents —línies d'uns 0,5 m
en atac directe als incendis espanyols, contra línies sostingudes als Estats
Units—, i per això el valor és editable.

**A la pantalla.** El modal de les eines de brigada (§11.39) porta tres camps
més: arribada, efectius i rendiment, amb la font enllaçada o la marca de
provisional. La llista hi afegeix una línia —«20 efectius × 40,2 m/h · arribada
0 min»— i l'estat segueix la feina: «En camí», «En construcció · 45 %», «Feta» o
«Aturada per seguretat · 45 %». L'extinció de restes es comprova al minut en què
la brigada comença, no al de la decisió.

El que no fa: el rendiment no depèn del combustible ni de la pendent —les taules
hi són, i seria el pas següent—, no hi ha accessos, i una brigada aturada no torna.

Comprovat: les proves de Codex —validació, calendari, cap de la feina, línia
lenta que el foc travessa i ràpida que el conté, parades, reproducció exacta amb
les parades fixades, escenaris de la 6 i de la 5— i dues del pla —la brigada per
defecte i els estats de la llista—; les 107 proves de simulació i les 35
d'Angular, i la compilació sense avisos. **Al navegador no s'ha mirat**: ho
prova Pere.

### 11.43. Qui treballa es veu: la brigada al cap de la línia, l'aeronau anant i tornant

Fet la nit del 16/11/2026, sense Pere, a la branca `agents-visuals` (12.20),
que surt de `brigades` i porta també `senyals-mapa`: els agents necessiten el
cap de la línia (§11.42) i els llocs de càrrega (§11.41).

**Són dibuixos del que el model ja ha calculat, i no canvien el foc.** Al minut
del cursor, i només amb un foc calculat:

- **Una brigada** és al cap de la seva línia (`crewHead`), des que comença a
  treballar fins que l'acaba. Si s'ha aturat per seguretat (§11.42), desapareix:
  on va després és la 12.22.
- **Una aeronau** fa el calendari de la descàrrega (§11.31): la passada k és a
  inici + k × interval, i entre dues passades vola cap al lloc de càrrega la
  primera meitat de l'interval i torna la segona. Arriba mig interval abans de
  la primera i se'n va mig interval després de l'última. L'interval és el de la
  mesura; el dibuix el segueix, no el discuteix: si el punt d'aigua és lluny i
  l'interval curt, l'helicòpter vola més ràpid del que podria.
- **On carrega**: l'helicòpter i l'avió amfibi, al punt d'aigua més proper
  (§11.41); l'avió de retardant, a l'aeròdrom més proper. Una línia discontínua
  a terra marca la ruta. **On el mapa no té lloc de càrrega** —tots els punts
  d'aigua d'Espanya, avui (12.24)—, l'aeronau només es dibuixa damunt de la
  descàrrega, durant un minut a cada passada.

Al mapa, en groc d'armilla per distingir-los del verd dels llocs d'on surten. És
una capa `symbol` que es refà a cada minut del cursor.

> **Revisat el 16/11/2026**, a petició de Pere: que es vegi què és cada agent.
> Codex va dibuixar sis siluetes de 32–34 px amb contorn fosc: **persona amb
> casc** (línia de defensa i extinció de restes), **bulldòzer** (tallafoc i
> tala), **autobomba** (línia d'aigua), **helicòpter**, **hidroavió** (amfibi) i
> **avió cisterna** (retardant). Només canvia el dibuix: la feina de la
> maquinària és la de la brigada (§11.42), amb el mateix calendari. Les icones
> no giren amb el rumb.

Comprovat: cinc proves noves —el lloc de càrrega més proper, el vol entre passades
minut a minut, l'aeronau sense lloc de càrrega, la brigada que treballa, que
s'atura i que acaba, i on carrega cada aeronau—, les 119 proves de simulació i
les 35 d'Angular, i la compilació sense avisos. **Al navegador no s'ha mirat**:
ho prova Pere.

### 11.44. L'interval entre passades surt d'on carrega l'aeronau

Decidit el 16/11/2026 per Pere, a la branca `punts-carrega`, que surt de
`agents-visuals`. L'interval entre passades era un número que s'escrivia
(§11.31), i amb els agents de la §11.43 es veia el que valia: un helicòpter
podia anar i tornar d'un embassament a 15 km en cinc minuts. **Ara es tria on
carrega, i l'interval en surt**: anar i tornar a la velocitat de creuer, més el
temps de càrrega. Res inventat: el que no té font oficial no té valor.

**Tres decisions de Pere:**

- **L'amfibi de referència passa a ser el DHC-515** (7.000 L), el successor del
  CL-415. El fullet del CL-415 només dona la velocitat màxima d'operació, i la
  fitxa del DHC-515 ho dona tot: capacitat, creuer i càrrega. Barrejar dos
  aparells era pitjor. Un escenari antic amb 6.137 L se segueix obrint.
- **Velocitat de creuer**, la que publiquen els tres fabricants: 123 kt el Bell
  412EPX (creuer màxim al pes màxim), 180 kt el DHC-515 (creuer normal) i 162 kt
  l'AT-802F (a 8.000 ft). La de treball només la publica Air Tractor.
- **El temps de càrrega de l'helicòpter és un camp sense valor.** No s'ha trobat
  cap xifra oficial —només la publicitat dels fabricants de cubells—, i per
  això s'ha d'escriure per poder aplicar l'eina, i el modal ho diu. Els altres
  dos són fixos: 12 s per omplir el DHC-515 i 5 min per recarregar l'AT-802F,
  tots dos del fabricant.

**Com es tria.** Es posa la descàrrega i, amb l'eina encara a la mà, un segon
clic diu on carrega; el clic dret torna a la descàrrega. Només val el que surt
de dades oficials:

- **aeròdrom** (retardant): un dels del mapa (§11.41), i el clic s'hi enganxa;
- **aigua** (helicòpter i amfibi): un punt d'aigua del mapa —per a l'amfibi,
  només embassaments, llacs, l'oceà o estuaris de l'ICNF—, **el mar** —el
  terreny a cota 0 o per sota, el criteri del model (§11.19)— o **un llac
  oficial**: la capa de masses d'aigua de categoria llac del pla hidrològic de
  Balears, a l'IDEIB (2022), que porta els embassaments de Cúber i del Gorg
  Blau.

**Al fitxer** cada descàrrega porta `loadPoint` i `loadMin`, i els escenaris
passen a la **versió 7**. El lector torna a calcular l'interval i rebutja la
mesura si no hi correspon: un fitxer editat a mà no pot portar un helicòpter més
ràpid que el seu creuer. Un escenari antic, amb l'interval escrit, s'obre igual.

**El dibuix** (§11.43) ara vola a la velocitat de creuer, s'espera al lloc de
càrrega el temps de càrrega i torna.

El que no fa: no es comprova la mida de la làmina d'aigua per a l'amfibi —no
s'ha trobat publicada—; fora de Balears no hi ha llacs oficials carregats; un
lloc de càrrega fora del domini no es pot triar; i amagar les marques del mapa
també les treu de la tria. Tot a la 12.26.

Comprovat: sis proves noves del model —la fórmula, la validació, el temps de
l'helicòpter, el fitxer, el vol de l'agent i els llacs— i dues del pla —la tria
del lloc de càrrega i els temps publicats—; les 125 proves de simulació i les 37
d'Angular, i la compilació sense avisos. **Al navegador no s'ha mirat**: ho
prova Pere.

### 11.45. Els punts d'aigua oficials, preparats i servits per la nostra API

Decidit el 16/11/2026 per Pere, a la branca `punts-aigua-api`: baixar les fonts
oficials que hi hagi, en el format que siguin, i servir-les des de la nostra API
per al domini i fins a 30 km al voltant. Fet en paral·lel, com les brigades
(§11.42): el contracte a `COORDINACIO_NIT/contracte-punts-aigua.md`, Codex
l'API (`punts-aigua-dades`) i Claude la pantalla.

**Les fonts**, totes oficials i totes de la xarxa per a l'extinció:

| Font | Àmbit | Punts | Què diu dels mitjans aeris | Llicència |
| --- | --- | --- | --- | --- |
| GVA, plans de prevenció per demarcació forestal (WFS) | País Valencià | 4.569 | Si serveix per a helicòpter (`helicop`) i per a amfibi (`anfibios`) | CC BY |
| REDIAM, punts d'aigua per a l'extinció (Pla INFOCA, WMS) | Andalusia | 2.120 | Res: només el tipus | CC BY 4.0 |
| ICNF, xarxa de pontos de água (ArcGIS) | Portugal | 7.976 (aeris o mixtos) | Que són per a mitjans aeris | No publicada |

- **REDIAM no té WFS** i la seva carpeta de descàrregues no es deixa llegir
  automàticament. El servei WMS, en canvi, torna tots els punts d'un quadre amb
  una consulta d'informació d'un sol píxel: el script en fa 18 que cobreixen
  Andalusia i en treu els repetits. Amb quadres d'1° i de 0,5° en surten els
  mateixos 2.120.
- **L'ICNF repeteix codis**: 73 codis per a 93 punts diferents, amb coordenades
  diferents. Es fa servir l'identificador intern del servei, i el codi queda com
  a nom.
- **Del que no diu la font, el que se'n pot deduir i prou**: un punt de REDIAM o
  de l'ICNF serveix a l'helicòpter (són xarxes per a mitjans aeris o mixtes), i a
  l'amfibi només si és un embassament, un llac, l'oceà o un estuari. La GVA ho
  diu ella mateixa: hi ha 23 punts aptes per a amfibis.
- **De l'ICNF es descarten** els punts trencats, sense aigua, en projecte o en
  proposta.
- **La resta d'Espanya no publica res obert** (§11.41): Catalunya, Castella i
  Lleó, Galícia, Aragó, Madrid, Castella-la Manxa, Extremadura, Múrcia i
  Navarra. On no hi ha punts, es carrega al mar o en un llac oficial (§11.44).

**Com es prepara**: `npm run water:prepare` a `api/`, amb la llista de fonts
tancada al codi. Escriu `api/data/water/points.json` sencer o no escriu res: si
una font falla, el fitxer bo d'abans es queda. No va al repositori, com els
combustibles; s'ha de preparar a cada instal·lació.

**La ruta**: `GET /api/water-points?bbox=…` torna els punts del domini més 30 km
per cada costat, amb la data de preparació i la llicència de cada font. La
pantalla deixa de demanar res a l'ICNF directament.

**A la pantalla**: el mapa dibuixa només els punts de dins del domini, que és
l'únic que mostra (§11.10). Els de fora —i els aeròdroms d'ENAIRE fins a 30 km—
surten en una llista, els cinc més propers amb la distància, quan es tria on
carrega una aeronau (§11.44).

Comprovat: les 11 proves de l'API —lectors, bbox, marge, ruta, preparació
atòmica i el codi repetit de l'ICNF— i les 6 dels combustibles; dues proves
noves de la pantalla; les 134 proves de simulació i les 37 d'Angular, i la
compilació sense avisos. La preparació real s'ha executat: 4.569 + 2.120 +
7.976 punts. **Al navegador no s'ha mirat**: ho prova Pere.

### 11.46. Llacs i embassaments de tot Espanya, de l'IGN, per la nostra API

Fet el 16/11/2026, a petició de Pere («acaba el que necessitis»), a la branca
`llacs-api`. Fins ara només hi havia llacs oficials a Balears (IDEIB, §11.44), i
a la resta d'Espanya un helicòpter només podia carregar al mar o en un punt
d'aigua de la GVA o de REDIAM (§11.45).

- **La font**: la hidrografia INSPIRE de l'IGN, «Aguas estancadas»
  (`hy-p:StandingWater`) del WFS de l'IDEE, que cobreix tot Espanya. Llicència
  CC BY 4.0, «© Instituto Geográfico Nacional». Substitueix la capa de l'IDEIB:
  porta també els embassaments de Balears (el de Cúber hi surt amb nom).
- **Per la nostra API**, com els punts d'aigua: `GET /api/lakes?bbox=…` demana a
  l'IDEE el domini més 30 km, en llegeix el GML —que va en ordre latitud,
  longitud— i el torna en GeoJSON net: el nom si en té, els anells i un punt de
  dins del llac. Es guarda en memòria 24 hores per domini. Al voltant d'un
  domini en surten de 150 a 400, en mig segon o dos. Ho va fer Codex, amb 12
  proves sobre una resposta real.
- **A la pantalla**: un clic dins d'un llac del domini hi carrega, com fins ara,
  i els llacs **amb nom** de fora del domini surten a la llista dels llocs de
  càrrega propers (§11.45). Els que no tenen nom —basses petites, sobretot— no
  s'hi llisten.
- **Amagar les marques ja no les treu de la tria**: la casella del menú de capes
  només amaga el dibuix.

El que no fa: no es mira la mida del llac per a l'amfibi (12.26), i l'IGN no
cobreix Portugal, on serveixen els punts de l'ICNF de tipus embassament o llac.

Comprovat: les 12 proves dels llacs, les 11 dels punts d'aigua i les 6 dels
combustibles a l'API; la ruta en directe contra l'IDEE (Sóller i Benagéber); les
134 proves de simulació i les 37 d'Angular, i la compilació sense avisos. **Al
navegador no s'ha mirat**: ho prova Pere.

### 11.47. Els parcs de bombers d'OpenStreetMap, també per la nostra API

Trobat el 16/11/2026 per Pere al navegador: el menú de capes deia «Sense
resposta: OSM». **Overpass ja no respon peticions anònimes**: amb l'agent per
defecte de curl torna 406 i amb el d'un navegador la petició es penja, mentre que
amb un nom de client respon bé. Una pàgina no pot posar el seu propi
`User-Agent`, de manera que des del navegador fallaria sempre.

- **La pantalla ho demana a la nostra API**, `GET /api/osm?bbox=…`, que pregunta
  a Overpass amb un nom de client genèric —«IgnisLab/0.1 (wildfire
  simulator)», sense res que identifiqui ningú— i torna només la posició i les
  quatre etiquetes que la pantalla llegeix.
- **Un dia en memòria per domini**: Overpass limita la taxa (§5 de la fase 1), i
  les proves seguides d'aquell matí ja el van fer respondre 502 un moment. Els
  parcs no es mouen d'un dia per l'altre.
- **Un reintent** si respon «massa peticions» o està ocupat, al cap de 3 s; si
  torna a fallar, el menú ho diu com fins ara.

Comprovat: quatre proves noves de l'API —la consulta, el que es conserva, la
ruta amb la memòria i el nom de client, i el reintent— i la ruta en directe
(Palma: el parc de bombers de Marratxí). Les 134 proves de simulació i les 37
d'Angular, i la compilació sense avisos. **Al navegador no s'ha mirat**: ho
prova Pere.

---

## 12. Decisions pendents

- **12.16. Calibrar els coeficients de les contramesures.** Ve de la §11.27,
  i s'amplia a la §11.31. Les reduccions dels escenaris antics, la retenció
  del 30 %, l'assecat d'una hora i les probabilitats d'emissió i d'ignició de
  les brases (§11.30) són hipòtesis. Si la memòria n'ha de treure
  conclusions quantitatives, cal una font —literatura d'extinció, dades
  d'operacions, els models de *spotting* d'Albini— o dir explícitament que no
  n'hi ha. Queden també sense mesurar el rendiment amb plans màxims (100
  mesures, 512 vèrtexs) i una revisió en més d'un navegador.
- **12.18. El manual d'usuari.** Ve de la §11.34. Ha de recollir el que la
  pantalla ja no explica: què fa cada secció i cada eina, les hipòtesis del
  model —combustible estimat, foc de superfície, retenció i assecat de les
  descàrregues, brases experimentals— i que el simulador no serveix per
  prendre decisions d'emergència.
- **12.26. El que falta dels llocs de càrrega.** Ve de la §11.44. (a) La mida
  mínima de la làmina d'aigua per a l'amfibi: no s'ha trobat publicada (Viking
  dona 410 m de carrera per al CL-415EAF, una modificació). Queda oberta. Les
  (b), (c) i (d) es van resoldre el mateix dia a les §11.45 i §11.46: llacs i
  embassaments de tot Espanya (IGN), llocs de fora del domini fins a 30 km en
  una llista, i les marques amagades ja no es treuen de la tria. Llacs de
  Portugal: només els punts de l'ICNF de tipus embassament o llac.
- **12.25. Rendiments que falten i preguntes de les brigades.** Ve de la §11.42.
  (a) Els rendiments del tallafoc, la tala i l'extinció de restes són
  provisionals: cal una font —les taules de bulldòzer del NWCG per als
  tallafocs?— o dir que no n'hi ha. (b) Quin rendiment de línia manual es vol
  per defecte: Ortega et al. (40,2 m/h) o el NWCG sostingut (7 m/h). (c) El
  contrafoc el fan brigades: ha de tenir també arribada i rendiment? (d) Quan una
  brigada d'una línia d'aigua s'atura, les passades futures sobre les cel·les ja
  fetes es mantenen (lectura literal del contracte); s'haurien de cancel·lar?
  (e) Cada parada repeteix el càlcul sencer i la barra de progrés torna a
  començar: si es fa servir amb moltes brigades, caldria mirar-ne el temps.
- **12.19. Les brigades no són instantànies: arribada, efectius i
  rendiment.** Feta la nit del 16/11/2026 a la §11.42, a la branca `brigades`;
  el que en queda és la 12.25. Plantejat per Pere el 16/11/2026. Avui una mesura terrestre
  apareix sencera al minut del desplegament (§11.28), i la pregunta clau d'un
  incendi —s'acaba la línia abans que hi arribi el cap?— no es pot fer. La
  proposta:
  - un **temps d'arribada** per mesura, des que es decideix fins que s'hi
    treballa;
  - el **nombre d'efectius**, i un **rendiment per efectiu** —metres de línia
    per hora per a tallafocs, línies de defensa, desbrossament i línies
    d'aigua; hectàrees per hora per a l'extinció de restes (§11.40)—, de
    manera que 100 efectius facin el que fan 100 efectius;
  - cada cel·la de la franja s'activa quan la brigada hi arriba, des del primer
    vèrtex i en l'ordre del dibuix: inici + arribada + recorregut ÷ rendiment.
    El model ja admet un minut d'activació per cel·la (§11.28): seria només
    que fos diferent per a cada una, sense cost de càlcul;
  - la regla de seguretat de la §11.40: si el front arriba a la brigada amb
    flames de més d'1,2 m, la construcció s'atura i el tros que falta no es
    fa.

  Fora, per no complicar-ho: composició i fatiga de les brigades, relleus,
  accessos, i un rendiment que depengui del combustible i de la pendent (les
  taules existeixen; seria el pas següent). **Els valors per defecte han de
  sortir d'una font** —el *Fireline Handbook* del NWCG o els manuals espanyols
  de defensa contra incendis, amb taules per tipus de brigada i de
  combustible—, i com la resta seran hipòtesis editables.
- **12.20. Agents que fan visible qui treballa.** El primer pas és fet la nit
  del 16/11/2026 a la §11.43, a la branca `agents-visuals`. Plantejat per Pere el
  16/11/2026: veure al mapa les persones o grups, la maquinària, els avions i
  els helicòpters de cada mesura. El primer pas no necessita IA: si la 12.19
  diu on és el cap de la línia a cada minut, la brigada es pot dibuixar allà,
  avançant; i un helicòpter, anant i tornant entre el punt d'aigua i la
  descàrrega a cada passada. Són agents que segueixen el que el model ja ha
  calculat, i no hi afegeixen res. Que decideixin pel seu compte —on anar, quan
  retirar-se, a quin punt d'aigua— ja seria simulació d'agents de debò, i
  canviaria el foc: és un altre treball.
- **12.21. Fer-lo servir de debò per coordinar unitats reals.** Una
  curiositat de Pere, el 16/11/2026, que es deixa escrita com a horitzó i no
  com a feina: que els agents de la 12.20 fossin, algun dia, persones i
  vehicles reals amb la seva posició GPS. La idea existeix al sector —eines
  de comportament del foc en ús operatiu i sistemes de localització de
  vehicles als centres de coordinació—, però el que faria falta és molt més
  que aquest treball:
  - un **model validat** contra incendis reals, amb capçades i amb brases
    calibrades (§11.19, §11.30), i no hipòtesis editables (12.16);
  - **dades en temps real**: perímetre observat, meteorologia actualitzada i
    correcció del càlcul quan el foc real se separa del simulat;
  - **fiabilitat i responsabilitat**: una eina que ajuda a decidir on
    envia gent a un incendi s'ha de poder auditar, ha de funcionar sense
    connexió i ha de passar per qui hi té competència.

  Fins llavors segueix valent el que diu el manual (12.18): el simulador no
  serveix per prendre decisions d'emergència. Com a demostració en un TFG, en
  canvi, una entrada de posicions que avui alimenten els agents simulats i
  demà podria alimentar un GPS seria un bon final de capítol.
- **12.22. Brigades que decideixen les coses petites.** Plantejat per Pere
  el 16/11/2026, i en una **branca a part**, perquè pot no donar temps: l'usuari
  dona l'ordre —obre una línia d'aquí a aquí, apaga aquestes restes— i cada
  brigada la porta a terme amb les decisions que prendria gent amb
  experiència. La proposta:
  - **Regles, no un model de llenguatge.** Les decisions d'una brigada a peu
    de foc són les del protocol de seguretat —vigia, comunicacions, rutes
    d'escapament, zones segures—: retirar-se quan les flames passen del que les
    eines aguanten (§11.40) o el foc s'acosta massa, tornar quan és segur,
    començar la línia per l'extrem amb menys risc, evitar pendents on no es pot
    treballar. Una màquina d'estats o un arbre de comportament per agent, amb
    llavor, de manera que el mateix escenari doni la mateixa simulació
    (§11.19, §11.30).
  - **El foc i les brigades es condicionen l'un a l'altre**: el que construeixen
    canvia el foc, i el foc les fa retirar. El càlcul d'avui és d'una sola
    passada per a tot l'horitzó (§11.19); amb agents caldria avançar a trams
    —calcular el foc, moure els agents un tram, tornar a calcular amb el que
    han fet— o iterar fins que no canviï. Amb el càlcul a menys d'un segon
    (§11.36), és assumible.
  - **Repartiment com a les contramesures**: Codex el comportament dels agents
    i l'acoblament amb el foc; Claude el mapa i les ordres. Primer el
    contracte —què és una ordre, què és l'estat d'un agent—, en un commit
    propi.
  - **Depèn de la 12.19** (rendiment i arribada) i de la 12.23 (d'on surten
    les brigades i on carreguen aigua els helicòpters).
- **12.23. Parcs de bombers i punts d'aigua al mapa.** Feta en part la nit del
  16/11/2026 a la §11.41, a la branca `senyals-mapa`: el que falta és la 12.24.
  Demanat per Pere el
  16/11/2026: dues marques verdes, una per als parcs i estructures de bombers i
  una per als punts d'aigua registrats oficialment per als mitjans aeris. No
  són decoració: el parc diu d'on surt una brigada i quant triga a arribar
  (12.19), i el punt d'aigua quant triga un helicòpter entre passades (avui
  l'interval és un número que s'escriu, §11.31). **Cal trobar les fonts
  oficials** i dir-ho si no n'hi ha: els punts d'aigua els publica cada
  comunitat autònoma pel seu compte —a Balears, l'IDEIB— i a Portugal l'ICNF
  ho fa per a tot el país; per als parcs, si no hi ha capa oficial,
  OpenStreetMap té `amenity=fire_station`, que és completa però no oficial i
  així s'hauria de dir.

  Afegit el mateix dia, també per Pere: **els aeròdroms**, per als avions de
  retardant. Cada mitjà aeri carrega en un lloc diferent, i això és el que
  marca el temps entre passades: l'helicòpter en un punt d'aigua, l'avió
  amfibi en una làmina d'aigua prou gran on pugui fer la carrega en vol, i l'avió de retardant
  —l'AT-802F de la §11.31— a la base, on hi ha el producte. Les fonts a mirar
  són les bases aèries de mitjans contra incendis que publiquen el ministeri i
  les comunitats, i els aeròdroms de l'AIP d'ENAIRE; OpenStreetMap
  (`aeroway=aerodrome`), com a últim recurs i dient-ho.
- **12.24. Punts d'aigua i bases aèries a Espanya.** En part feta el 16/11/2026
  a la §11.45: el País Valencià i Andalusia. Queda la resta d'Espanya, que no
  publica res obert, i les bases aèries. Ve de la §11.41. L'ICNF
  publica els de Portugal; a Espanya cada comunitat ho fa pel seu compte i a
  Balears no s'ha trobat res obert a l'IDEIB. Cal decidir si es demana la capa
  a l'IBANAT o a la Conselleria, si es fa servir la línia de costa com a punt de
  càrrega dels helicòpters, o si es diu que a Espanya no n'hi ha. I el mateix
  per a les bases de mitjans aeris (MITECO i comunitats), que no s'han trobat
  com a dades. També falta confirmar les llicències de l'ICNF i d'ENAIRE.
- ~~**12.17. El document de contramesures va endarrerit.**~~ Resolta el
  16/11/2026: el document ja descriu les §11.29 a §11.31 i diu què s'ha mirat
  al navegador i què no. El que es plantejava:
  [contramesures.md](contramesures.md) descriu la versió de la §11.28:
  multiplicadors, escenaris de la versió 3 i «no hi ha spotting». Cal
  posar-lo al dia amb les §11.29 a §11.31.

- **12.15. Dos pintors que no pinten.** Ve de la §11.22. `fire-appearance.ts`
  (amb set proves) i `fire-field.ts` són al repositori i no els fa servir
  ningú: el primer és la petjada exacta cel·la a cel·la, el segon el camp
  continu que `fire-surface.ts` ha substituït. O es treuen, o un d'ells es
  queda com a alternativa per a qui no tingui WebGL2, que avui es queda sense
  dibuix del terra.

- ~~**12.13. Quin model és l'arbrat de WorldCover.**~~ Resolta el 14/11/2026
  a la §11.21: es queda el 8. El que es plantejava: la taula hi posa el 8,
  fullaraca compacta sota arbrat tancat, que és el més lent dels de bosc; la
  §11.19 havia triat el 7 per a la pineda mediterrània amb sotabosc. Fora de
  Balears tot el bosc surt d'aquesta fila. Cap dels dos surt d'una dada.
- ~~**12.14. El sòl nu com a combustible.**~~ Resolta el 14/11/2026 a la
  §11.21: no combustible. El que es plantejava: la classe 60 de
  WorldCover —sòl nu o vegetació esparsa— anava al model 1, i el mateix document
  deia que podia sobreestimar molt. L'alternativa és no combustible, que
  convertiria en barrera un pedregar amb càrritx.

- **12.7. El canvi de nom d'«ignició» a «centre».** Ve de la §11.11: el text ja
  diu centre i els identificadors encara diuen ignició —`IgnitionStep`,
  `IGNITION_SOURCE`, `setIgnition()`, `LAYERS.ignitionDot`— i el que és
  realment el punt d'ignició encara no existeix. Convé fer-ho el dia que
  l'eina del simulador col·loqui focus de debò, perquè llavors els dos
  conceptes hauran de conviure i els noms hauran de distingir-los.

- **12.8. Les cel·les de mar dins del domini.** Resolta per al model el
  14/11/2026 a la §11.19: altitud ≤ 0 no crema. Queda només treure el mar de
  les xifres d'altitud i pendent de la §11.12. El plantejament: Ve de la §11.12. Un domini
  costaner inclou mar, i Terrarium hi dona el fons marí: l'altitud mínima surt
  negativa i la mitjana i la màxima de pendent compten talussos submarins. Cal
  decidir si el mar s'exclou de les xifres —i amb quin criteri: elevació ≤ 0 o
  una línia de costa— i el mateix criteri servirà al model, on el mar és
  no combustible.

- ~~**12.9. Les ignicions a la URL.**~~ Resolta el 13/11/2026 a la §11.16: un
  paràmetre de consulta, `?ignicions=`, i cada canvi substitueix l'entrada de
  l'historial.

- **12.10. La meteorologia en directe.** Ve de la §11.17. Cal decidir quina
  estació parla per un domini de 30 km —la més propera al centre, o una
  interpolació—, cada quant es refresca, i què es fa quan l'estació no dona
  vent. AEMET va pel servidor per la clau; IPMA es pot demanar des del
  navegador si el CORS ho deixa, cosa que no s'ha comprovat.
- ~~**12.11. On viuen els escenaris desats.**~~ Resolta el 14/11/2026 a la
  §11.26: en fitxers de text. El que es plantejava: ve de la §11.17. Les ignicions ja
  són a la URL (§11.16) i la meteorologia no. O tot viatja a l'enllaç i
  «desar» és guardar un enllaç amb nom, o es desa al navegador i no es pot
  compartir. Sense base de dades, no hi ha tercera via.
- ~~**12.12. Què fa una contramesura a una cel·la.**~~ Resolta el 15/11/2026
  a la §11.27: barrera o multiplicador sobre la velocitat, i el contrafoc com
  a ignicions. El que es plantejava: ve de la §11.17, i és del model (§12.5):
  treure combustible, apujar-ne la humitat, o aturar el front.

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
  amb terreny no combustible convertiria mitja illa en tallafocs. Resolta el
  14/11/2026 a la §11.21: es tracten com a desconeguts i hi respon la coberta
  del sòl. Les dues files discutibles de la taula de conversió, 12.13 i
  12.14, es tanquen el mateix dia.
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
- **12.5. El model de propagació.** Oberta amb una primera versió a la §11.19
  —Rothermel i temps mínim de viatge sobre combustible suposat—; el que en
  queda és allà, llevat del combustible per cel·la, que ja hi és (§11.21).
  Abans deia: encara sense investigar. És el centre de la
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

### 13.3. Amb el relleu encès, pujar un llenç no repinta el que hi ha drapejat

Una font `canvas` que no és animada es fa llegir amb `play()` i `pause()`
seguits: en aturar-se puja la textura una darrera vegada. En mapa pla n'hi ha
prou. **Amb el terreny 3D no**: a `maplibre-gl` 6.15.0 el relleu desa en una
textura pròpia el que hi té drapejat (§13.1) i la reaprofita, de manera que el
llenç nou arribava a la GPU i a la pantalla seguia l'anterior. El símptoma és
un foc que no avança, o una capa que s'apaga al menú i segueix dibuixada, fins
que es mou la càmera.

El que ho invalida és dir-li a la font que el seu contingut ha canviat, i la
via pública és `setCoordinates()` amb les mateixes coordenades. Va a
`refreshFire()`, després del `play()` i el `pause()`.

És, molt probablement, el que hi havia darrere de les dues comprovacions que
la §11.19 i la §11.20 van deixar sense fer —«no s'ha pogut comprovar el dibuix
del foc sobre el mapa»—, atribuïdes llavors al navegador de proves.

> **Revisat el 16/11/2026** (§13.6): `setCoordinates()` només ho arreglava a
> mitges, i ja no es fa servir.

### 13.4. Les proves del model no corren amb el *builder* d'Angular

Les proves de propagació substitueixen mòduls relatius amb *mocks* de Vitest,
i el *builder* `@angular/build:unit-test` no ho admet. Des del 15/11/2026 les
proves van en dues tandes: `npm run test:simulation` executa
`src/app/simulation` amb Vitest directament, i `ng test` en queda exclòs a
`angular.json`. `npm test` encadena les dues.

### 13.5. Molts contrafocs fan quadràtica la distància a la ignició

L'avanç màxim (§11.25) buscava, per a cada cel·la cremada, la ignició més
propera recorrent-les totes. Amb un o dos focus no importa; un contrafoc en
genera centenars o milers —una per cel·la de la franja—, i el cost es
multiplica. A partir de 33 llavors es calcula ara la transformada de
distància euclidiana exacta en dues passades (`fire-distances.ts`), lineal en
la mida de la graella. I l'avanç només compta les ignicions que ja s'han
desplegat en cada minut.

### 13.6. El foc tallat en línies rectes: les tessel·les que `setCoordinates` no arriba

Trobat el 16/11/2026, a partir d'una captura de Pere: amb el relleu encès i el
cursor avançant, el foc sortia tallat per línies rectes, amb un estat a cada
costat, i en fer zoom o girar la vista es tornava a pintar bé. **No era el
navegador ni el model: era MapLibre**, i com la §13.3 l'esquivava.

Amb el terreny, `maplibre-gl` 6.15.0 pinta les capes drapejades dins d'una
textura per a cada tessel·la del terreny i la guarda (`render_to_texture.ts`).
Les línies rectes eren les vores d'aquestes tessel·les vistes en perspectiva:
unes tenien el foc nou i les altres un d'abans. Dues regles decideixen quan es
refà una textura, i el llenç del foc no n'activava cap del tot:

- **L'avís de dades del mapa** (`_handleTerrainDataEvent`, a `map.ts`): quan
  una font canvia, si és de tipus `'image'` es buiden totes les textures; si
  no, només les de les tessel·les de la mateixa línia —mare o filla— que la
  tessel·la de la font. La font del foc és un llenç: per dins hereta d'imatge,
  però s'anuncia com a `'canvas'`, i va pel segon camí. Un llenç només té una
  tessel·la, la que en conté el centre, i el foc —30 km de domini— en cobreix
  diverses del terreny. `setCoordinates()` (§13.3) provocava aquest avís, i per
  això el foc es refeia en part.
- **L'empremta de cada textura** (`RTTFingerprint`): es refà quan canvia el
  zoom, les tessel·les de la font, les capes visibles o la **revisió** de la
  font. Repintar el llenç no en canvia cap; fer zoom canvia el zoom, i per això
  el tall desapareixia en moure la vista.

**La revisió és la de l'estat de les entitats** (`SourceFeatureState`), i es
pot moure amb l'API pública: `refreshFire()` crida
`map.setFeatureState({ source: 'fire', id: 0 }, { revisio: n })` amb un número
que puja a cada repintat. MapLibre ho aplica en preparar la font, abans de
decidir les textures del mateix fotograma, i refà **totes les tessel·les que
tenen el foc a sota, i només aquestes**: les mateixes que buidaria si la font
s'anunciés com a imatge. `setCoordinates()` deixa de fer-se servir.

És un ús de l'estat d'entitats que no és el seu —el foc no té entitats—, i
depèn de com 6.15 construeix l'empremta. Si una versió nova de MapLibre ho
canvia, el símptoma tornarà a ser aquest, i el lloc on mirar és aquí. Seria
un error per comunicar a MapLibre: la comprovació `type === 'image'` deixa fora
`'canvas'` i `'video'`, que són imatges.

**Al navegador no s'ha mirat**: ho prova Pere.

> Comprovat per Pere el mateix dia: el foc ja no es talla.

### 13.7. Les vores entre tessel·les del relleu es veuen, i es deixen

Vist el 16/11/2026, després de la §13.6: amb el relleu inclinat i de prop,
es veu una línia on canvien la nitidesa i el to de la imatge de satèl·lit.
És la vora entre dues tessel·les del terreny carregades a **nivells de zoom
diferents**: MapLibre, amb la càmera inclinada, carrega les tessel·les
llunyanes amb menys detall, i per defecte en deixa conviure fins a nou nivells
a la pantalla. Esri World Imagery fa servir imatges de dates i fonts diferents
segons el zoom, de manera que el to també salta; i el relleu ombrejat, calculat
del DEM de cada nivell, també.

No és del foc ni de la §13.6, i no s'arregla del tot: de lluny el detall ha de
baixar. Es podria reduir amb `map.setSourceTileLodParams()`, que limita quants
nivells hi ha alhora a la pantalla, a canvi de carregar més tessel·les o de
perdre detall a prop de la càmera. **Es deixa com està**, per decisió de Pere:
no val la pena si costa rendiment.

---

## 14. Fonts de dades

Les que ja s'usen són al §5 de la fase 1, amb els crèdits al §6, i no es
repeteixen aquí: l'elevació Terrarium i la cartografia base hi són des del
primer dia.

Les de la fase 2, que s'han afegit a la taula del §5 i als crèdits del §6:

- **Meteorologia**: AEMET OpenData i IPMA (§11.18).
- **Combustible**: IDEIB a Balears i ESA WorldCover 2021 a tot l'àmbit
  (§11.21). MFE25 i la cartografia portuguesa, localitzades i no integrades.
- **Punts d'aigua oficials** (§11.45): GVA, REDIAM i ICNF, preparats i servits
  per la nostra API.
- **Llacs i embassaments** (§11.46): hidrografia de l'IGN, «Aguas estancadas»,
  per la nostra API.
- **Mitjans d'extinció** (§11.41): punts d'aigua de l'ICNF a Portugal,
  aeròdroms d'ENAIRE a Espanya, i parcs de bombers —i els aeròdroms de
  Portugal— d'OpenStreetMap, que no és oficial i així es diu.
