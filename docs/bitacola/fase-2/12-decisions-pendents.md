# 12. Decisions pendents

- ~~**12.30. Si el servidor es parteix en dos per a poder provar-lo.**~~
  Resolta el 19/11/2026 a la §11.60: partit. El que es plantejava: ve de la
  §11.59. `server.ts` fa tres coses en carregar-se: construeix l'aplicació,
  hi penja les rutes i es posa a escoltar. La tercera és la que impedeix
  provar les altres dues, perquè importar el fitxer obre un port. El que es
  proposa és separar-lo —un `app.ts` que construeixi i exporti l'aplicació, i
  un `server.ts` que l'importi i cridi `listen()`—, que és el que faria
  provable la validació del rang de dates, els tres camins de
  `/api/hotspots`, les capçaleres d'edat i la validació de `/api/weather`:
  unes 190 línies que avui són l'únic 0 % de l'API. `npm start` seguiria
  apuntant a `dist/server.js`. L'alternativa és deixar-lo sense provar i
  dir-ho a la memòria, que també és una resposta: és muntatge, i el que
  decideix de debò —el model, el combustible, les dates— ja està provat.

- **12.29. Dues coses que les proves de l'API han trobat.** Surten de la
  §11.58, i són totes dues de validació, no de càlcul. (a) `isDay()` accepta
  el **30 de febrer**: l'expressió regular hi passa i `Date` el fa rodar a l'1
  de març en lloc de refusar-lo. FIRMS contesta un dia així sense cap fila, de
  manera que es llegeix com un dia sense focs i no com un error; estrènyer-ho
  seria comparar la data analitzada amb la cadena. (b) L'**hora d'AEMET** es
  llegeix com a local: `fint` ve sense zona i `new Date()` hi posa la del
  servidor, mentre que la banda d'IPMA hi afegeix una `Z` a mà perquè sap que
  és UTC. AEMET també publica en UTC, de manera que l'hora de l'observació va
  una hora enrere a l'hivern i dues a l'estiu. Cap de les dues s'ha tocat:
  canviar una validació i una hora és una decisió, i les proves diuen avui el
  que el codi fa.

- **12.28. Si hi va un linter.** Surt de la 12.27. Avui no n'hi ha cap: només
  Prettier, que ordena però no judica. ESLint amb `angular-eslint` i
  `typescript-eslint` caçaria el que el formatador no veu —promeses sense
  `await`, senyals llegits on no toca, imports morts—, i és mitja hora de
  configuració. Sonar en dirà algunes coses, però no les mateixes i no al
  terminal.

- ~~**12.27. Si la qualitat del codi es mesura amb SonarQube.**~~ Resolta el
  19/11/2026 a la §11.55: sí, SonarQube Cloud, amb l'escàner a mà i sense CI.
  El que es plantejava: la cobertura no el necessita: la dona vitest, i Sonar
  llegiria el mateix `lcov` que la §11.54 ja genera. El que hi afegiria és
  anàlisi pròpia —duplicació, complexitat ciclomàtica, *code smells*,
  *security hotspots*—, un historial per *commit* i un panell d'on sortirien
  una captura i una taula per a la memòria. El que costaria: SonarCloud és
  gratuït només amb el repositori públic, i en privat és de pagament;
  SonarQube Community en local vol Docker, Java i uns 3 GB de memòria. Si es
  fa, la via barata és SonarCloud amb el repositori públic, un
  `sonar-project.properties` i l'escàner llançat a mà un parell de vegades,
  no a cada *commit*, i després del manual (12.18). El linter que es plantejava
  al costat és ara la 12.28.

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
  [contramesures.md](../../contramesures.md) descriu la versió de la §11.28:
  multiplicadors, escenaris de la versió 3 i «no hi ha spotting». Cal
  posar-lo al dia amb les §11.29 a §11.31.

- **12.15. Dos pintors que no pinten.** Ve de la §11.22. `fire-appearance.ts`
  (amb set proves) i `fire-field.ts` són al repositori i no els fa servir
  ningú: el primer és la petjada exacta cel·la a cel·la, el segon el camp
  continu que `fire-surface.ts` ha substituït. O es treuen, o un d'ells es
  queda com a alternativa per a qui no tingui WebGL2, que avui es queda sense
  dibuix del terra. La cobertura del 19/11/2026 ho confirma: cap dels
  dos no el toca ningú (§11.54).

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
