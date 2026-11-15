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

Els escenaris nous són **versió 4**. Al fitxer de text, amb JSON dins de la línia:

- `contramesures = [...]`, amb `startMin` per a cada desplegament posterior a
  T=0 i, si és física, `litresPerPass`, `passes` i `passIntervalMin`, o
  `fuelRemaining`;
- `canvis_vent = [...]`, amb `startMin`, `speedKmh` i `fromDeg`;
- `brases = {"enabled": …, "seed": …}`.

Els fitxers de les versions 1 a 3 continuen obrint-se; l'absència de `startMin`
significa T=0. Un pla, un vent o unes brases mal formats es rebutgen sencers
amb un missatge: perdre una barrera silenciosament canviaria la pregunta
simulada. També es rebutgen versions futures desconegudes.

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
Verificació actual (16/11/2026): **100 proves passen** (72 de simulació i 28
Angular); build de producció sense avisos. El càlcul de distància a les ignicions
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
