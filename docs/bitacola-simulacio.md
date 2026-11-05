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
- **12.3. Terreny 3D a la vista de simulació.** Ve de la 3.6 de la fase 1.
  Activable i no obligatori, perquè drapejar el `CustomLayer` sobre una malla de
  terreny és més feina que pintar-lo sobre un pla.
- **12.4. Amb què es dibuixa la vista 3D.** La primera a decidir. Tres camins:
  el terreny de MapLibre (`setTerrain` sobre el DEM que ja és a l'estil) amb
  l'estat del foc com una capa a sobre; un segon canvas —WebGL propi o
  Three.js— que tingui la graella com a malla i l'estat com a textura; o mapa
  pla amb inclinació opcional i el 3D només com a decoració.
  - La hipòtesi que val la pena comprovar **abans** de decidir: MapLibre drapeja
    les fonts *raster* sobre el terreny però no els `CustomLayer`. Si es
    confirma, l'estat del foc com a font raster o canvas sobre el domini dona
    foc drapejat sobre el relleu sense escriure cap renderitzador, i la feina
    que la 12.3 temia desapareix. **No comprovat encara**; dir-ho com un fet
    seria inventar-se la decisió.
- **12.5. El model de propagació.** Encara sense investigar. És el centre de la
  fase i condiciona les 12.1 i 12.2: quines dades demana el model —pendent,
  combustible, vent, humitat— és el que diu quines fonts calen i amb quina
  resolució.

---

## 13. Troballes tècniques

Coses que costen temps i convé no redescobrir. Buida de moment; la de la fase 1
és al §4 de l'altre document.

---

## 14. Fonts de dades

Les que ja s'usen són al §5 de la fase 1, amb els crèdits al §6, i no es
repeteixen aquí: l'elevació Terrarium i la cartografia base hi són des del
primer dia.

Les que la fase 2 necessitarà i encara no estan triades —combustible o coberta
del sòl, vent— esperen la 12.5, perquè és el model qui diu què li cal.
