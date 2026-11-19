# Bitàcola — índex

Les decisions del projecte, **una per fitxer**. El fitxer d'una decisió és
`<fase>/<número>-*.md`: la 11.43 és `fase-2/11.43-*.md`, i un glob hi arriba
sense haver de mirar el nom sencer. Per a respondre una pregunta, obre només
el fitxer que toca; cap d'aquests fitxers no passa de 150 línies.

**Els números no es renumeren mai**: el codi els cita als comentaris (§2.29,
§3.4) i la fase 2 comença al §10 perquè cap referència no sigui ambigua.

Si hi afegeixes una decisió: fitxer nou amb el número següent i una línia aquí.

## Fase 1 — el mapa i el formulari · `fase-1/`

Tancada el 5 de novembre de 2026. La portada de focus actius, el formulari de
quatre nivells fins al punt d'ignició, el domini i l'elevació llegida al
navegador. Context: `0-portada.md` i `1-abast.md`.

- **2.1** Arquitectura
- **2.2** Visor cartogràfic
- **2.3** Framework del frontend
- **2.4** Relació entre Angular i MapLibre
- **2.5** Domini de simulació
- **2.6** Cartografia base i relleu
- **2.7** Límits administratius
- **2.8** Enquadraments
- **2.9** La portada és el mapa de focus actius, i és fixa
- **2.10** L'altre camí és un botó de simulació nova
- **2.11** Navegació per rutes
- **2.12** Llenguatge i marc del backend
- **2.13** Com es demanen les deteccions
- **2.14** Finestra temporal d'un dia
- **2.15** Memòria cau de deu minuts, i dades velles abans que un mapa buit
- **2.16** Una marca per detecció, i el FRP mana
- **2.17** La potència es presenta per trams, i no es diu què crema
- **2.18** La jerarquia és única i la donen els NUTS
- **2.19** La jerarquia viatja a la URL, i amb codis
- **2.20** El mapa viu per sobre de les rutes
- **2.21** Durant el formulari, els focus s'apaguen
- **2.22** La regió es ressalta en assenyalar-la, i no parpelleja
- **2.23** Les províncies arriben quan calen, no amb la portada
- **2.24** La marca ve d'un conjunt d'icones publicat
- **2.25** Els municipis: un fitxer per província, i a Portugal freguesies
- **2.26** El punt d'ignició viu a la URL
- **2.27** El domini es dibuixa, i són tres números lligats
- **2.28** L'elevació es llegeix al navegador
- **2.29** Un sol nivell de vores a la vegada, en baixar i en pujar
- **2.30** Un cercador de municipis, i per nom i no per codi postal
- **2.31** Les deteccions tenen dates, i la portada les deixa triar
- **2.32** La caixa que es demana a FIRMS no és l'àmbit d'estudi
- **2.33** La portada porta llegenda, i la detecció oberta es marca
- **2.34** Amb moltes deteccions, les marques s'encongeixen
- **2.35** Amb més d'un dia a la pantalla, el color diu la data

Pendents obertes, a `3-decisions-pendents.md` (tres van passar a la fase 2):

- **3.2** Model digital d'elevacions
- **3.3** Polígons sense model de combustible
- **3.4** Com anomenar la jerarquia a Portugal
- **3.6** Terreny 3D a la vista de simulació
- **3.7** Què és «un focus» en clicar
- **3.11** La llengua dels noms de regió

I, al costat: `4-troballes-tecniques.md` —el que es va trobar provant—,
`5-fonts-de-dades.md`, `6-recursos-de-tercers-i-llicencies.md` i
`7-canvis-de-rumb.md`.

## Fase 2 — el simulador i la vista 3D · `fase-2/`

Oberta. El sandbox 3D, el model de propagació, les contramesures, les brigades
i els mitjans aeris, i la qualitat del codi. Context: `0-portada.md` i
`10-abast.md`.

- **11.1** Els tallafocs construïts no entren, i el motiu és la cobertura
- **11.2** La vista 3D és el terreny de MapLibre, i no un segon motor
- **11.3** Al relleu es gira, i només es gira
- **11.4** El simulador és una pantalla, amb ruta pròpia i pestanya pròpia
- **11.5** El terreny porta noms, i els noms surten d'un fitxer per província
- **11.6** Corbes de nivell, tretes del relleu que ja hi és
- **11.7** El simulador és una consola, i la referència és el prototip FireCast
- **11.8** El mapa del simulador és només el domini
- **11.9** El relleu del sandbox s'il·lumina, i la muntanya no s'infla
- **11.10** Al sandbox es desplaça i s'hi fa zoom, fins a la paret
- **11.11** El darrer pas del formulari tria el centre, no on comença el foc
- **11.12** El sandbox diu el terreny que ensenya
- **11.13** La pendent és una capa, en cinc trams i en violeta
- **11.14** Repàs del sandbox: l'agulla del vent i els botons de zoom
- **11.15** L'eina d'ignició posa focus, i el focus és una marca dreta
- **11.16** Les ignicions viatgen a la URL, en un paràmetre
- **11.17** La columna de configuració, sencera: què hi haurà i què no es tria
- **11.18** La meteorologia en directe: l'estació més propera, i prou
- **11.19** El primer simulacre: Rothermel sobre combustible suposat
- **11.20** El foc es veu com un foc: brasa a terra, flames i fum a l'aire
- **11.21** El combustible és de cada cel·la: cartografia oficial on n'hi ha, coberta del sòl on no
- **11.22** El terra del foc es pinta a la GPU, i porta la previsió a +1, +3 i +6 hores
- **11.23** La direcció del vent és una brúixola que es gira
- **11.24** Les seccions de la configuració es pleguen
- **11.25** La columna d'anàlisi es plega, es tria, i diu com es comporta el front
- **11.26** Els escenaris són fitxers de text, i la reproducció va més a poc a poc
- **11.27** Les contramesures canvien la velocitat, no el combustible
- **11.28** Les contramesures es despleguen amb el foc en marxa
- **11.29** El vent pot canviar durant la simulació
- **11.30** Focus secundaris per brases, opcionals i reproduïbles
- **11.31** Les contramesures es tornen físiques: litres i combustible retirat
- **11.32** Un escenari és una entrada de fora, i es llegeix com a tal
- **11.33** Un escenari antic s'actualitza, no es perd
- **11.34** La pantalla no explica: ho farà el manual d'usuari
- **11.35** Les flames fan la mida de la intensitat, i un front aturat no en té
- **11.36** Cada contramesura costa el que fa, i no tota la graella
- **11.37** Una brúixola que només indica
- **11.38** Decidir al passat esborra les mesures posteriors, amb avís
- **11.39** Una contramesura es configura en un modal i es posa amb el ratolí
- **11.40** Les descàrregues fetes s'aparten, i les brigades apaguen les restes
- **11.41** Parcs, punts d'aigua i aeròdroms al mapa, de la font oficial on n'hi ha
- **11.42** Les brigades arriben, són tantes i fan tants metres per hora
- **11.43** Qui treballa es veu: la brigada al cap de la línia, l'aeronau anant i tornant
- **11.44** L'interval entre passades surt d'on carrega l'aeronau
- **11.45** Els punts d'aigua oficials, preparats i servits per la nostra API
- **11.46** Llacs i embassaments de tot Espanya, de l'IGN, per la nostra API
- **11.47** Els parcs de bombers d'OpenStreetMap, també per la nostra API
- **11.48** Els llacs es veuen al mapa
- **11.49** Més simple: fora les marques i la tria del lloc de càrrega
- **11.50** Els agents són figures 3D, i les aeronaus fan la passada de veritat
- **11.51** Les figures es veien negres i a trossos
- **11.52** L'escaquer groc i negre de les figures: precisió, no llum
- **11.53** Una detecció obre el simulador
- **11.54** La cobertura de les proves es mesura
- **11.55** SonarQube Cloud llegeix el que les proves mesuren
- **11.56** La bitàcola és un fitxer per decisió
- **11.57** Els avisos de Sonar, a zero
- **11.58** L'API es prova, i la cobertura es mesura sobre el TypeScript

Pendents obertes, a `12-decisions-pendents.md` (les resoltes hi són ratllades,
amb el que es plantejava):

- **12.28** Si hi va un linter
- **12.16** Calibrar els coeficients de les contramesures
- **12.18** El manual d'usuari
- **12.26** El que falta dels llocs de càrrega
- **12.25** Rendiments que falten i preguntes de les brigades
- **12.19** Les brigades no són instantànies: arribada, efectius i rendiment
- **12.20** Agents que fan visible qui treballa
- **12.21** Fer-lo servir de debò per coordinar unitats reals
- **12.22** Brigades que decideixen les coses petites
- **12.23** Parcs de bombers i punts d'aigua al mapa
- **12.24** Punts d'aigua i bases aèries a Espanya
- **12.15** Dos pintors que no pinten
- **12.7** El canvi de nom d'«ignició» a «centre»
- **12.8** Les cel·les de mar dins del domini
- **12.10** La meteorologia en directe
- **12.1** Model digital d'elevacions
- **12.2** Polígons sense model de combustible
- **12.5** El model de propagació

I, al costat: `13-troballes-tecniques.md` —set coses que només es veuen
provant: què drapeja MapLibre, per què el foc sortia tallat, per què les
proves del model no corren amb el *builder* d'Angular— i `14-fonts-de-dades.md`.
