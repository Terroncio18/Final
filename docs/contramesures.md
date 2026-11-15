# Contramesures del simulador

Implementació del pla de contramesures d'IgnisLab, 15/11/2026. Desenvolupada en
paral·lel: Codex, model i escenaris; Claude, panell i mapa. La coordinació local
viu a `C:/Proyectos/TFG/Pere/CONTRAMESURES_COORDINACIO.md`.

## Què es calcula

Les contramesures es poden preparar abans de començar o **desplegar durant la
simulació**. Triar una eina pausa la reproducció. En col·locar una descàrrega o
finalitzar una franja, es registra el minut actual (`startMin`) i es recalcula
la previsió automàticament, conservant el rellotge i el foc anterior al desplegament.
Prem reproduir per continuar. Si el càlcul falla, es recuperen el pla i el
resultat anteriors i es mostra l'error.

Les mesures que ja han actuat queden bloquejades per a l'edició i la supressió;
les del minut actual o del futur es poden editar. Tornar a l'inici permet
revisar tot el pla. La llista indica minut de desplegament i estat; el mapa
mostra les mesures desplegades que encara no han caducat. No es modelen el temps
de construcció ni el desplaçament dels recursos: el desplegament és instantani.

| Tipus | Efecte numèric | Geometria |
| --- | --- | --- |
| Línia de defensa / tallafoc | Cèl·lules que no propaguen foc | Franja permanent |
| Tala i desbrossament | Multiplicador permanent de velocitat | Franja |
| Línia d'aigua | Multiplicador fins a la caducitat | Franja |
| Helicòpter / avió amfibi | Multiplicador fins a la caducitat | Disc |
| Retardant | Multiplicador fins a la caducitat | Franja |
| Contrafoc | Ignicions al minut de desplegament | Franja |

Els presets són **paràmetres experimentals editables**, no rendiments mesurats
de brigades o aeronaus. No provenen d'una calibració d'extinció. La reducció
modifica la velocitat de propagació i, amb aquesta, la intensitat derivada; no
recalcula la humitat ni les classes de càrrega del combustible de Rothermel.
En particular, el desbrossament és una aproximació de reducció de velocitat,
no una reconstrucció del llit de combustible.

Les barreres són ideals dins del model de foc de superfície. No hi ha spotting,
salt de brases, foc de capçades, ruptura d'una línia per intensitat o probabilitat
de fallada. Que el model aturi el foc no demostra que una línia real el contingui.
El contrafoc pot **augmentar** l'àrea cremada; no es resta de l'estadística ni es
converteix en una franja impermeable. Les ignicions inicials sobre barreres donen
error; el contrafoc només encén cel·les amb combustible i sense barrera activa.

## Espai i temps

La graella és de 30 m. Un disc o franja inclou totes les cèl·lules que toca,
inclòs un contacte amb la vora. El càlcul usa la distància exacta entre cada
quadrat i el segment, amb extrems arrodonits. És una rasterització conservadora:
la petjada efectiva pot ser més ampla que la geometria dibuixada, especialment
per a línies de 30 m. No ofereix precisió de brigada ni línies subcel·lulars.
Els vèrtexs han de ser dins del domini; la part de l'amplada que en surt es retalla.

El combustible original no es modifica. Les barreres s'apliquen al camp de
velocitats; els passos llargs comproven totes les cèl·lules travessades i els
contactes diagonals, també quan la barrera s'activa durant el trajecte. Una barrera
nova no esborra terreny ja cremat. El desbrossament redueix la velocitat a partir
del seu desplegament.

En les superposicions preval la reducció més forta. Dues reduccions del 70 % no
es multipliquen per crear una del 91 %. Una reducció temporal més feble que el
desbrossament permanent no afegeix efecte.

L'aigua i el retardant comencen a `startMin` i mantenen un factor constant fins
 a `startMin + durationMin`, quan l'efecte desapareix. És una caducitat discreta, no una evaporació física.
Cada trajecte s'integra per trams temporals, tant a l'activació com a la caducitat:
només es frena la distància recorreguda mentre el tractament és actiu. Això conserva
l'ordre d'arribada (FIFO) necessari per Dijkstra. Velocitat i intensitat de les
sèries es corregeixen pel tractament actiu quan arriba el foc a cada cèl·lula.

## Fitxers i validació

Els escenaris nous són versió 3: `contramesures = [...]` en JSON dins del fitxer
de text inclou `startMin` per a cada desplegament posterior a T=0. Els fitxers
versió 1 i 2 continuen obrint-se; l'absència de `startMin` significa T=0. Un pla
malformat es rebutja sencer amb un missatge: perdre una barrera silenciosament
canviaria la pregunta simulada. També es rebutgen versions futures desconegudes.

Límits: 100 mesures, 64 vèrtexs per mesura, 512 en total, amplades de 30 a 3000 m,
desplegament de 0 a 720 min, reducció de 0 a 95 %, durades temporals d'1 a 720 min i 0 per efectes permanents.
IDs únics; coordenades finites; franges amb almenys dos punts diferents.

## Verificació

Les proves cobreixen el resultat base sense mesures, obstacles continus i
diagonals, reducció permanent, caducitat abans d'arribar i durant el trajecte,
superposicions, FIFO, geometria, límits, entrada corrupta, immutabilitat del
combustible, contrafoc i persistència. També comproven que les vuit eines
conserven les arribades i totes les sèries anteriors al desplegament, activacions
successives, caducitat relativa, barreres tardanes i ignicions a temps fraccionari. No substitueixen una calibració amb dades
d'extinció ni una validació operativa.

Des de `web`: `npm test -- --watch=false` i `npm run build`.

La suite pura s'executa amb Vitest i les proves Angular amb el seu builder: aquest
últim no admet els mocks de mòduls relatius de les proves de propagació.
Verificació actual: **82 proves passen** (56 de simulació i 26 Angular); build
de producció sense avisos. El càlcul de distància a les ignicions usa una
transformada euclidiana exacta quan un contrafoc genera moltes llavors; les
estadístiques d'avanç només compten les ignicions ja desplegades a cada instant.

El panell permet editar amplada, durada i reducció experimental. Una franja
inacabada impedeix iniciar o desar, fins que es finalitza o es cancel·la.
Comprovació visual amb Sóller i les dades reals de l'API: helicòpter a T+3 h,
5,9 ha cremades conservades i previsió d'una hora reduïda de 10,6 a 9,6 ha.
En retrocedir a T+2 h apareix «Programada» i a T+3 h 40 «Caducada», amb els
controls bloquejats. Reproduir i seleccionar tallafoc pausa el rellotge;
finalitzar-lo a T+3 h 00 min 13 s manté el foc i actualitza la previsió.
Captura local: `C:/Proyectos/TFG/Pere/contramesures-live-verificacio.jpg`.
Persistència dels horaris i compatibilitat amb escenaris antics comprovades
amb proves automatitzades; el flux de desar/carregar es va verificar al navegador
en la versió inicial del pla.

L'antic bloqueig de localhost es va resoldre iniciant el servidor fora de
l'aïllament de xarxa. Vista local de revisió: `http://127.0.0.1:4302/`.
Queden fora d'aquesta verificació una campanya exhaustiva de navegadors,
mesures de rendiment amb plans màxims i la calibració científica dels coeficients.
