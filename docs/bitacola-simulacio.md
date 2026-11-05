# Bitàcola tècnica — IgnisLab · Fase 2: el simulador i la vista 3D

Registre de **decisions preses**: què s'ha decidit i per quins motius. Material
de base per a la memòria del TFG.

Continuació de [bitacola.md](bitacola.md), la fase 1 —el mapa i el formulari—,
tancada el 5 de novembre de 2026.

Darrera actualització: 5 de novembre de 2026.

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

---

## 12. Decisions pendents

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
