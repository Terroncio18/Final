# Contramesures del simulador

Implementació del pla de contramesures d'IgnisLab, 15/11/2026, actualitzada el
16/11/2026. Desenvolupada en paral·lel: Codex, model i escenaris; Claude, panell
i mapa. La coordinació local viu a `C:/Proyectos/TFG/Pere/CONTRAMESURES_COORDINACIO.md`.
Les decisions i els motius són a la bitàcola de la fase 2, §11.27 a §11.31.

## Què es calcula

Les contramesures es poden preparar abans de començar o **desplegar durant la
simulació**. Triar una eina pausa la reproducció. En col·locar una descàrrega o
finalitzar una franja, es registra el minut actual (`startMin`) i es recalcula
la previsió automàticament, conservant el rellotge i el foc anterior al desplegament.
Prem reproduir per continuar. Si el càlcul falla, es recuperen el pla i el
resultat anteriors i es mostra l'error.

Les mesures que ja han actuat queden bloquejades per a l'edició i la supressió;
les del minut actual o del futur es poden editar. Tornar a l'inici permet
revisar tot el pla. La llista indica minut de desplegament i estat —per a les
descàrregues, quantes passades s'han fet—; el mapa mostra les mesures
desplegades que encara actuen. No es modelen el temps de construcció, les
dotacions ni el desplaçament dels recursos: el desplegament és instantani.

Hi ha dos tipus d'efecte. Les **mesures físiques** —les que es creen ara per
defecte— descriuen el que es fa i el model recalcula Rothermel a la cel·la. Els
**multiplicadors** de velocitat de la primera versió continuen vàlids als
escenaris que els porten, però una mesura no pot barrejar les dues coses.

| Tipus | Efecte | Paràmetres | Geometria |
| --- | --- | --- | --- |
| Línia de defensa / tallafoc | Cel·les que no propaguen foc | Amplada | Franja permanent |
| Tala i desbrossament | Retirada de càrrega; recalcula el llit | % de combustible restant (5–100, defecte 20) | Franja |
| Línia d'aigua | Humecta el combustible mort fi | Litres per passada (fins a 10.000), passades, interval | Franja |
| Helicòpter | Humecta el combustible mort fi | Bell 412 · fins a 1.350 L per passada | Disc |
| Avió amfibi | Humecta el combustible mort fi | Canadair CL-415 · fins a 6.137 L per passada | Disc |
| Retardant | Humectació equivalent, sense residu químic | Air Tractor AT-802F · fins a 3.104 L per passada | Franja |
| Contrafoc | Ignicions al minut de desplegament | Amplada | Franja |
| Extinció de restes | Apaga el foc de les cel·les; barrera des del desplegament | Amplada | Franja |

Els aparells són configuracions de referència amb nom i font citada al codi
(`AIRCRAFT` a `countermeasures.ts`), no la capacitat de tots els mitjans d'un
tipus.

### Humectació

Els litres de cada passada es reparteixen per igual sobre la petjada. Se'n
reté un **30 %** al combustible mort fi d'1 h, que s'asseca exponencialment amb
una **constant d'una hora**, fins a un màxim de 300 % d'humitat. Amb la humitat
resultant es recalcula el llit de Rothermel; si supera la humitat d'extinció
del model, el foc no hi propaga. El combustible viu no es modifica. Per
integrar exactament cada trajecte, la humitat es pren constant a trams de cinc
minuts. La retenció i l'assecat són **hipòtesis experimentals**, no rendiments
calibrats d'extinció.

### On carreguen les aeronaus

Des de la versió 7 (§11.44 de la bitàcola), l'interval entre passades d'un mitjà
aeri no s'escriu: es tria **on carrega** i l'interval en surt.

```
interval = 2 × distància(descàrrega, càrrega) ÷ velocitat de creuer + temps de càrrega
```

| Aparell | Capacitat | Creuer | Càrrega | Font |
| --- | --- | --- | --- | --- |
| Bell 412 (helicòpter) | 1.350 L | 123 kt | **s'escriu**: no hi ha font oficial | fitxa del Bell 412EPX |
| DHC-515 (amfibi) | 7.000 L | 180 kt | 12 s | fitxa de De Havilland |
| AT-802F (retardant) | 3.104 L | 162 kt (a 8.000 ft) | 5 min a la base | fullet d'Air Tractor |

L'helicòpter carrega a un punt d'aigua del mapa, al mar o en un llac oficial;
l'amfibi, al mar, en un embassament o en un llac; l'avió de retardant, en un
aeròdrom del mapa. El mar és el terreny a cota 0 o per sota, com el llegeix el
model; els llacs, les «Aguas estancadas» de l'IGN per a tot Espanya (§11.46).
Els punts d'aigua i els llacs amb nom de fins a 30 km fora del domini es trien
d'una llista (§11.45). No es comprova
la mida de la làmina d'aigua. El fitxer porta `loadPoint` i `loadMin`, i el
lector comprova que `passIntervalMin` en sigui el resultat.

### Tala

La tala multiplica la càrrega de totes les classes de partícules pel
percentatge restant i recalcula el llit de la cel·la a partir del desplegament.
Les restes que queden continuen sent combustible.

### Multiplicadors (escenaris antics)

Una mesura sense litres ni càrrega restant aplica `1 − reducció` a la
velocitat: permanent per a la tala, fins a la caducitat per a l'aigua, els
mitjans aeris i el retardant. Reducció de 0 a 95 %, durada d'1 a 720 min. En
les superposicions preval la reducció més forta: dues del 70 % no fan una del
91 %. La caducitat és discreta, no una evaporació.

### Extinció de restes

Les brigades apaguen el que queda encès. Des del minut del desplegament, les
cel·les de la franja no cremen ni deixen passar el foc, com un tallafoc tardà; i
a més, el foc que ja havia sortit d'una d'aquestes cel·les però encara no havia
arribat a la següent —perquè l'esperava combustible mullat, per exemple— també
s'apaga. Un tallafoc posat al mateix lloc i al mateix minut el deixaria passar.

Només es pot posar amb un foc calculat, sobre cel·les que ja hagin cremat, i
on el front no faci flames de més d'**1,2 m** (`MOP_UP_MAX_FLAME_M`): el
límit de l'atac directe amb eines manuals, la primera banda del *fire
characteristics chart* (Andrews i Rothermel 1982). La intensitat es llegeix com
la de les flames: la velocitat real del front i la calor de la cel·la on entra.
Si el front és més intens, la mesura es rebutja i la línia es queda a mig
dibuixar.

### Brigades: arribada, efectius i rendiment

Des de la versió 6 (§11.42 de la bitàcola), les mesures que fa una brigada —línia
de defensa, tallafoc, tala i desbrossament, línia d'aigua i extinció de restes—
poden portar tres camps més, tots tres o cap: `arrivalMin` (minuts des de la
decisió fins que la brigada treballa al lloc), `crewSize` (efectius) i
`ratePerPerson` (m/h de línia; ha/h per a l'extinció de restes). Sense ells, la
mesura apareix sencera al minut del desplegament, com abans.

Cada cel·la es fa quan la brigada hi arriba, des del primer vèrtex i en l'ordre
del dibuix:

```
inici de la feina = startMin + arrivalMin
línia:   minut(c) = inici + 60 · recorregut(c) / (efectius · rendiment)
restes:  minut(c) = inici + 60 · (recorregut(c) · amplada / 10.000) / (efectius · rendiment)
```

`recorregut(c)` és la distància en metres, sobre la polilínia, fins a la
projecció del centre de la cel·la. La barrera, la retirada de càrrega o
l'extinció d'aquella cel·la comencen al seu minut; les passades d'una línia
d'aigua, a partir del seu minut.

**Parada de seguretat.** Si el foc arriba a una cel·la encara no feta mentre la
brigada treballa, amb flames de més d'1,2 m (`MOP_UP_MAX_FLAME_M`, llegides com a
l'extinció de restes), la brigada s'atura en aquell minut i el tros que falta no
es fa. El resultat ho porta a `crewStops`, i la llista ho diu.

**Valors per defecte** (`CREW_DEFAULTS`), editables al modal:

| Mesura | Efectius | Rendiment per efectiu | Font |
| --- | --- | --- | --- |
| Línia de defensa | 20 | 40,2 m/h | Ortega, Rodríguez y Silva i Molina (2023), IJWF 32:1503–1514, doi:10.1071/WF22087: matoll, atac directe, 0,67 m/min |
| Línia d'aigua | 4 | 80,5 m/h | NWCG, *Fire Line Production Rate Tables* (2021): atac inicial amb autobomba, model 5, 4 persones, 16 cadenes/h. La taula avisa que no és per a feina sostinguda |
| Tallafoc | 20 | 40,2 m/h | **Provisional**: el de la línia manual; un tallafoc de 60 m és feina de maquinària |
| Tala i desbrossament | 20 | 40,2 m/h | **Provisional**, igual |
| Extinció de restes | 20 | 0,05 ha/h | **Provisional**: no s'ha trobat cap taula de rendiment de liquidació |

Els 20 efectius són la brigada de referència de les taules del NWCG. Arribada
per defecte, 0 min. Fora d'aquest model: composició i fatiga, relleus, accessos
i un rendiment que depengui del combustible i de la pendent.

### Barreres i contrafoc

Les barreres ho són del **foc de superfície**. Si les brases estan activades,
un focus secundari pot encendre combustible més enllà de la franja. No hi ha
foc de capçades, ruptura d'una línia per intensitat ni probabilitat de fallada.
Que el model aturi el foc no demostra que una línia real el contingui.

El contrafoc pot **augmentar** l'àrea cremada; no es resta de l'estadística ni
es converteix en una franja impermeable. Les ignicions inicials sobre barreres
donen error; el contrafoc només encén cel·les amb combustible i sense barrera
activa.

## Vent canviant i brases

**Canvis de vent.** Fins a 100, cadascun amb minut (0–720, únics i ordenats),
velocitat a 10 m (0–60 km/h) i direcció d'origen. Cada canvi és instantani i es
manté fins al següent. Els trajectes que travessen un canvi s'integren per
trams, i el vent a mitja flama es recalcula per a cada model de combustible.

**Focus secundaris per brases.** Desactivats per defecte; s'activen abans
d'iniciar, amb una llavor. Cada cel·la que crema pot emetre una brasa amb una
probabilitat que creix amb la intensitat de Byram i és més alta sota
combustible llenyós. La brasa vola amb el vent, integrant-ne els canvis, entre
30 m i 2 km. On cau, s'encén segons la humitat del combustible fi —inclosa la
humectació de les descàrregues—, la càrrega restant i la temperatura. Les
cel·les sense propagació no s'encenen.

L'atzar surt d'un *hash* de la llavor i de la cel·la: el mateix escenari dona el
mateix foc, i editar una mesura lluny no canvia la resta de les brases. La
probabilitat d'ignició és **experimental, no la taula operativa de NWCG**.

## Espai i temps

La graella és de 30 m. Un disc o franja inclou totes les cèl·lules que toca,
inclòs un contacte amb la vora. El càlcul usa la distància exacta entre cada
quadrat i el segment, amb extrems arrodonits. És una rasterització conservadora:
la petjada efectiva pot ser més ampla que la geometria dibuixada, especialment
per a línies de 30 m. No ofereix precisió de brigada ni línies subcel·lulars.
Els vèrtexs han de ser dins del domini; la part de l'amplada que en surt es retalla.

El combustible original i la graella de coberta no es modifiquen: els
tractaments són un historial per cel·la que es consulta minut a minut. Les
barreres s'apliquen al camp de velocitats; els passos llargs comproven totes les
cèl·lules travessades i els contactes diagonals, també quan la barrera s'activa
durant el trajecte. Una barrera nova no esborra terreny ja cremat.

Cada trajecte s'integra per trams temporals —activació, caducitat, passades,
trams d'assecat i canvis de vent—: només es frena la distància recorreguda
mentre el tractament és actiu. Això conserva l'ordre d'arribada (FIFO)
necessari per Dijkstra. Velocitat i intensitat de les sèries es corregeixen pel
tractament actiu quan arriba el foc a cada cèl·lula.

## Fitxers i validació

Els escenaris nous són **versió 6** (la 5 afegeix l'extinció de restes; la 6, les brigades). Al fitxer de text, amb JSON dins de la línia:

- `contramesures = [...]`, amb `startMin` per a cada desplegament posterior a
  T=0 i, si és física, `litresPerPass`, `passes` i `passIntervalMin`, o
  `fuelRemaining`; i, per a les de brigada, `arrivalMin`, `crewSize` i
  `ratePerPerson`;
- `canvis_vent = [...]`, amb `startMin`, `speedKmh` i `fromDeg`;
- `brases = {"enabled": …, "seed": …}`.

Els fitxers de les versions 1 a 5 continuen obrint-se: cada clau que hi falta
pren el valor per defecte de la pantalla, l'avís diu quines, i el botó «Desar
actualitzat» els torna a escriure en la versió actual amb totes les claus. Desar
escriu sempre totes les claus, també les buides. L'absència de `startMin`
significa T=0. Un pla, un vent o unes brases mal formats es rebutgen sencers
amb un missatge: perdre una barrera silenciosament canviaria la pregunta
simulada. També es rebutgen versions futures desconegudes, les contramesures
amb un camp que aquesta versió no coneix i, abans de llegir-los, els fitxers de
més d'1 MB.

Límits: 100 mesures, 64 vèrtexs per mesura, 512 en total, amplades de 30 a 3000 m,
desplegament de 0 a 720 min. Descàrregues: d'1 L a la capacitat de l'aparell per
passada, 1–20 passades, 1–120 min entre passades, sense reducció ni durada fixa.
Tala: 5–100 % de combustible restant. Multiplicadors: reducció de 0 a 95 % i
durades d'1 a 720 min, 0 per als permanents. IDs únics; coordenades finites;
franges amb almenys dos punts diferents.

## Verificació

Les proves cobreixen el resultat base sense mesures, obstacles continus i
diagonals, reducció permanent, caducitat abans d'arribar i durant el trajecte,
superposicions, FIFO, geometria, límits, entrada corrupta, immutabilitat del
combustible, contrafoc i persistència. També comproven que les eines conserven
les arribades i totes les sèries anteriors al desplegament, activacions
successives, barreres tardanes, ignicions a temps fraccionari, els canvis de
vent, l'emissió i la ignició de brases, i la humectació i la tala. No
substitueixen una calibració amb dades d'extinció ni una validació operativa.

Des de `web`: `npm test -- --watch=false` i `npm run build`.

La suite pura s'executa amb Vitest i les proves Angular amb el seu builder: aquest
últim no admet els mocks de mòduls relatius de les proves de propagació.
Verificació actual (16/11/2026, branca `brigades`): **142 proves passen** (107 de
simulació i 35 Angular); build de producció sense avisos. El càlcul de distància a les ignicions
usa una transformada euclidiana exacta quan hi ha més de 32 llavors; les
estadístiques d'avanç només compten les ignicions ja desplegades a cada instant.

**Al navegador**, el que s'ha comprovat és la versió del 15/11 amb
multiplicadors. Amb Sóller i les dades reals de l'API: helicòpter a T+3 h, 5,9 ha
cremades conservades i previsió d'una hora reduïda de 10,6 a 9,6 ha. En retrocedir
a T+2 h apareix «Programada» i a T+3 h 40 «Caducada», amb els controls bloquejats.
Reproduir i seleccionar tallafoc pausa el rellotge; finalitzar-lo a T+3 h 00 min
13 s manté el foc i actualitza la previsió. Captura local:
`C:/Proyectos/TFG/Pere/contramesures-live-verificacio.jpg`. Les mesures físiques,
el vent canviant i les brases **no consta que s'hagin mirat al navegador**.

Queden fora d'aquesta verificació una campanya exhaustiva de navegadors,
mesures de rendiment amb plans màxims i la calibració científica dels
coeficients: retenció, assecat, probabilitats de les brases i reduccions dels
multiplicadors.
