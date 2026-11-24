# E — El full de la fase 7: què s'ha de mirar al navegador

24/11/2026. Fase E de [`revisio-final.md`](revisio-final.md). La fase 7 és de
Pere i és la prova de la interfície; això és la llista del que s'hi ha de
mirar, perquè no depengui que algú se'n recordi.

**Res de tot això no s'ha vist mai a la pantalla.** Existeix a les proves i al
codi. Són nou avisos i botons nous des de la fase 5, més el 3D, que mai no ha
tingut una lectura que no sigui dels seus recursos.

Per cada cosa: on és, com fer-la sortir, i què hauria de passar.

## 1. El selector de dates: quatre estats que ningú ha vist

Tots quatre viuen **dins del panell que s'obre clicant el selector**, de
manera que qui no l'obri no en veu cap. Això és el primer que cal jutjar: si
han de veure's des de fora, el botó de dalt ho ha de dir, i això canvia el que
queda per fer.

**1.1. Ha fallat la lectura.** Fer-la sortir: aturar l'API, o treure la clau
`FIRMS_MAP_KEY`. Hauria de passar: el botó de dalt diu «sense resposta», i el
panell «No s'han pogut llegir les deteccions» amb un botó **Tornar-ho a
provar** que torni a demanar-ho de debò. Amb la clau absent, el botó de dalt
diu «falta la clau FIRMS» i **no** surt el botó, perquè reintentar no ho
arreglaria.

**1.2. Les deteccions són d'abans.** Fer-la sortir: una lectura bona i després
fer fallar FIRMS abans que caduqui la memòria cau del servidor. Hauria de
passar: «FIRMS no ha respost: es mostren les últimes deteccions que es van
poder llegir» i, a sota, **«Llegides fa X min»**. Comprovar que el «fa X» és
creïble i que canvia si es torna a obrir el panell més tard.

**1.3. La cobertura és incompleta.** Fer-la sortir: fer fallar **una** àrea o
plataforma de FIRMS i no les altres. Hauria de passar: les deteccions que sí
han arribat es veuen, i el panell diu «Alguna font no ha respost: hi pot haver
focs que no es vegin».

**1.4. Les dues alhora.** Una resposta parcial servida com a vella. Hauria de
passar: **els dos avisos junts**, perquè diuen coses diferents, i un sol botó.

**1.5. El dia màxim a la mitjanit UTC.** Fer-la sortir: deixar el panell obert
travessant les 00:00 UTC, o moure el rellotge del sistema. Hauria de passar:
el calendari deixa triar el dia que acaba de començar i la validació no diu
«no hi ha deteccions de dates futures». **Avís**: això es llegeix quan passa
alguna cosa —editar una data, reobrir el panell—, no sol. Si el panell es
queda quiet, l'atribut no canvia fins a la següent detecció de canvis, i això
és conegut i escrit (§11.78).

## 2. Els quatre passos del formulari i un full compartit

**2.1. Els botons de reintentar.** Fer-los sortir: impedir que es llegeixin
els fitxers de dades —canviar-los el nom a `web/public/data/`, per exemple—.
Hauria de passar: cada pas ensenya el seu error i un botó que torna a
demanar-ho: regió («No s'han pogut llegir els límits administratius»),
província, municipi i ignició («No s'ha pogut llegir l'elevació del domini»).

**2.2. Com queda el botó.** La classe `.retry` és nova a
`simulation/step-panel.css`, que és **el full compartit dels quatre passos**.
Mirar-lo als quatre, no només a un: mida, color sobre el fons del panell, i
que no s'enganxi al text de sobre.

## 3. El 3D i WebGL: el que no es veu llegint

**3.1. Els quatre estats que les partícules es deixen.**
`map/fire-particles.ts` restaura `depthMask`, el VAO i el búfer, i **no**
restaura `BLEND`, `DEPTH_TEST`, `depthFunc` ni l'últim `blendFunc` del fum
(B4). Fer-ho sortir: un foc amb partícules i, al damunt, una capa que es
dibuixi després —les contramesures, els topònims, les figures 3D—. Hauria de
passar: res estrany. Si alguna cosa es veu transparent on no toca, o
desapareix darrere el terreny, és això. **Si no es veu res, es deixa com està
i s'escriu que es va mirar**: no es pot confirmar llegint.

**3.2. Les figures 3D.** `map/agent-models.ts` (454 línies) i `agents-3d.ts`
no s'han llegit per geometria, només per l'alliberament de recursos. Mirar:
brigades i aeronaus a l'escala que toca, orientades cap on van, del color que
toca, i que la cortina de la descàrrega caigui on cau el llançament.

## 4. El panell de combustible

**4.1. L'avís de cobertura parcial**, acabat de decidir i de fer. Fer-lo
sortir: un domini que caigui en part fora del ràster. Hauria de passar: un
avís propi, en català, que digui que allà no hi ha dada i que reintentar no
servirà, **diferent** del de font inaccessible i del de «cap conjunt oficial».

**4.2. El combustible a la vora d'una tessel·la.** La §11.81 va arreglar un
índex que podia assignar el model de la fila següent amb un WorldCover
retallat. Fer-ho sortir: un domini just a la vora d'una tessel·la de 3°.
Hauria de passar: les cel·les sense dada surten desconegudes, **no** amb un
model plausible. És l'únic defecte d'avui que, si tornés, no es veuria: el que
surt sembla bo.

## 5. El que va canviar el 24/11 i encara no s'ha vist (§11.86)

Tres canvis de comportament del dia que tanca les pendents. Els dos primers es
veuen; el tercer no hauria de veure's gens, i això és el que es comprova.

**a) Les xifres del terreny ja no compten el mar.** Agafa un domini **costaner**
—Sóller mateix, o qualsevol municipi amb costa—. L'altitud mínima ha de sortir
**positiva**; abans sortia negativa perquè comptava el fons marí, i la pendent
mitjana promediava talussos submarins. Les xifres surten a dos llocs i han de
dir el mateix: l'últim pas del formulari i el panell «ÀREA D'ESTUDI» del
simulador.

**b) I un domini tot mar ho diu.** Fes clic al mig del mar. Ha de dir «tot mar»
al formulari i «El domini és tot mar: no hi ha terreny per mesurar» al panell,
en lloc d'un «0–0 m». És el cas que abans donava xifres que no volien dir res.

**c) La línia manual va sis vegades més lenta.** El rendiment per defecte passa
de 40,2 a **7 m/h per persona** (decisió 12.25 b). Al modal de l'eina, la font
ha de dir **NWCG 2021** i l'enllaç ha d'obrir la taula; abans deia Ortega i
l'enllaç era un DOI. I una línia de defensa que abans es completava en un
escenari ara pot no acabar-se: **això és el que s'espera**, no un defecte. Un
fitxer d'escenari desat **abans** d'avui ha de seguir obrint-se i conservant el
seu 40,2.

**d) El canvi de nom no hauria de notar-se.** El pas del centre ara és
`CentreStep` i el nivell del formulari es diu `centre` (decisió 12.7). No canvia
res de la pantalla, de manera que el que es comprova és que **tot continua
funcionant**: els quatre passos, tornar enrere, l'URL amb el punt, i que el
simulador s'obri amb el centre correcte. Si alguna cosa s'ha trencat amb el
canvi de nom, es veurà aquí i no a les proves.

## 6. El que la fase 7 ja demanava

- El guió de la fase 2, sencer.
- La suite automàtica: **471 proves** el 24/11.
- El linter a les dues meitats.
- Sonar, que no s'ha tornat a llançar des de la §11.62.

## El que no es pot provar sense dades o sense que passi de debò

- Una fallada parcial **real** de FIRMS: depèn d'ells. Es pot forçar canviant
  l'URL d'una àrea al servidor, i val la pena fer-ho una vegada.
- El cas del `https://` de les fonts oficials (§11.81): les dades no són al
  repositori, i si una URL preparada no fos https la rejilla es reconstruiria
  a cada petició, en silenci. Es veuria com lentitud, no com un error.
- La col·locació del llit de referència dins del `try` (§11.81): no
  s'exerceix enlloc, i fer-la sortir demanaria llevar el model 1 del catàleg.
