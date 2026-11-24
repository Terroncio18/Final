# 10 — Revisión de las dieciséis entradas abiertas del punto 12

24/11/2026. Propuesta para Claude; no se ha modificado la bitácora ni el código.

## Resultado de la revisión

Hay dieciséis entradas sin tachar, pero no dieciséis decisiones por tomar. La
12.2 está **resuelta en su propio cuerpo** desde la §11.21; la 12.19 se hizo
en la §11.42; la 12.10 tiene implementadas sus decisiones principales desde la
§11.18. La §11.49 revocó por decisión de Pere la interfaz de recursos de la
12.23 y dejó sin uso presente la investigación de 12.24 y 12.26. La 12.7
contiene otra premisa caducada: **sí existe** el punto de ignición (§11.15).
La frase sobre comenzar por la 12.4, situada entre la 12.12 y la 12.1, debe
suprimirse: la §11.2 ya la cerró el 5/11.

**No son honestamente dieciséis cierres hoy.** La 12.18 es una entrega
pendiente, no una decisión sin criterio: la fase 8 exige que el manual de
usuario esté en el repositorio antes de cerrar la 12.18. La 12.8 tampoco se
puede tachar diciendo que las cifras excluyen el mar mientras el código las
calcule con el mar. Las 12.1, 12.10, 12.16 y 12.25 tienen opciones para Pere
en el fichero de preguntas. Su aceptación permite cerrar la decisión
documental, pero no equivale a validar el modelo. Propongo cerrar ahora las
entradas ya ejecutadas o descartadas, y completar las restantes cuando se
cumplan esas condiciones. En 12.8, una resolución alternativa sin código
sería declarar expresamente que las cifras describen **todo el DEM**, incluido
el fondo marino; desaconsejo esa salida porque se presentan como terreno del
dominio (§11.12) y ya se conoce el defecto.

Sobre «solo la 12.8 implica código»: **sí, para las resoluciones inmediatas
que propongo**, siempre que Pere conserve los valores y contratos actuales.
No es cierto en sentido absoluto. Renombrar la 12.7 requeriría una refactorización
transversal; cambiar la elección de estación o la corrección del viento en
12.10 cambiaría API y modelo; cambiar los rendimientos, el contrafoc o las
pasadas de la 12.25 alteraría el resultado. Esas son alternativas explícitas,
no trabajo autorizado por este informe. La 12.8 tocaría `terrain.ts` —mínimo y
máximo de altitud y media y máximo de pendiente, con divisor de celdas
terrestres— y pruebas del caso costero; ambas pantallas consumen las mismas
cuatro estadísticas. Hay que decidir qué mostrar si no hay ninguna celda
terrestre. Excluir por `elevation <= 0` sigue la §11.19 y evita introducir una
línea de costa nueva; cerca de la orilla la pendiente de una celda terrestre
puede seguir derivarse del fondo marino vecino, límite que conviene decir.

## Propuestas por entrada

Cada propuesta da la frase nueva en catalán. Bajo «El que es plantejava» se
reproduce **literalmente la entrada actual** para que Claude pueda conservar
el planteamiento sin reescribirlo. Al integrar, se tacha solo el título, se
antepone la frase de resolución y el rótulo «El que es plantejava:» al texto
existente. Si el texto antiguo contiene afirmaciones históricas ya superadas,
la resolución remite a la sección que las corrigió. Las frases marcadas como
**condicionadas** no se deben escribir en pasado hasta que se cumpla la
condición indicada.

### 12.1 — Modelo digital de elevaciones

**Clase:** decisión de fuente con efecto técnico y académico. **Código:**
ninguno si se conserva Terrarium; servir GLO-30 exige canal de teselas propio,
adaptación de lectura y comprobación de pendientes y resultados. **Pere:** sí,
elección y texto de la memoria.

**Propuesta condicionada a Pere:** ~~**12.1. Model digital d'elevacions.**~~
Resolta el 24/11/2026 a la §11.85: es conserva Terrarium per al relleu i per
a la pendent del simulacre; el GLO-30 queda com a millora futura, no com a
dada emprada. **Motivo:** la pendiente actual ya alimenta Rothermel (§11.19),
por lo que sustituir el DEM no sería un cambio visual. La memoria debe decir
que cita GLO-30 como alternativa de calidad, sin atribuirle datos ni
precisión al cálculo entregado.

El que es plantejava:

````text
- **12.1. Model digital d'elevacions.** Ve de la 3.2 de la fase 1. Terrarium per
  comoditat; l'estat de l'art cita el Copernicus DEM GLO-30, de més qualitat.
  Des del 29/10/2026 Terrarium ja no és només el relleu ombrejat: és la font de
  la pendent que alimenta el model, de manera que la pendent pesa més.
  Canviar-lo voldria dir servir les tessel·les nosaltres, perquè el GLO-30 no es
  distribueix com a tessel·les obertes.
````

### 12.2 — Polígonos sin combustible

**Clase:** decisión ya ejecutada que no se tachó. **Código:** ninguno.
**Pere:** no; la §11.21 ya fija el contrato.

**Propuesta:** ~~**12.2. Polígons sense model de combustible.**~~ Resolta el
14/11/2026 a la §11.21: `MODCOMB = 0` és desconegut i hi respon WorldCover;
no es converteix en barrera. **Motivo:** el valor significa ausencia de
información, no ausencia de vegetación. Esta entrada ya dice «Resolta el
14/11/2026» en su cuerpo; al integrarla conviene conservarlo como historia,
aunque la duplicación resulte visible, o desplazar únicamente esa frase a la
línea de resolución con revisión editorial explícita.

El que es plantejava:

````text
- **12.2. Polígons sense model de combustible.** Ve de la 3.3 de la fase 1.
  `MODCOMB = 0` són 5.471 d'11.654 polígons a l'inventari balear. Confondre'ls
  amb terreny no combustible convertiria mitja illa en tallafocs. Resolta el
  14/11/2026 a la §11.21: es tracten com a desconeguts i hi respon la coberta
  del sòl. Les dues files discutibles de la taula de conversió, 12.13 i
  12.14, es tanquen el mateix dia.
````

### 12.5 — Modelo de propagación

**Clase:** modelo implementado, con validación empírica futura. **Código:**
ninguno para documentar el estado; una calibración real sería un trabajo de
investigación y probablemente código. **Pere:** solo si quiere convertir
alguna comparación simulada en conclusión predictiva.

**Propuesta:** ~~**12.5. El model de propagació.**~~ Resolta el 24/11/2026 a
la §11.85: el model lliurat és Rothermel per a foc de superfície i temps mínim
de viatge, amb les ampliacions i els límits de les §11.19, §11.21 i §11.29 a
§11.31; la validació contra incendis reals queda per a recerca futura.
**Motivo:** la §11.19 contiene fuentes, ecuaciones y comparaciones de
referencia; no es correcto decir simplemente «sin investigar». Esas
comprobaciones de componentes no calibran el incendio completo, menos aún las
brases y contramedidas (§11.30 y §11.31).

El que es plantejava:

````text
- **12.5. El model de propagació.** Oberta amb una primera versió a la §11.19
  —Rothermel i temps mínim de viatge sobre combustible suposat—; el que en
  queda és allà, llevat del combustible per cel·la, que ja hi és (§11.21).
  Abans deia: encara sense investigar. És el centre de la
  fase i condiciona les 12.1 i 12.2: quines dades demana el model —pendent,
  combustible, vent, humitat— és el que diu quines fonts calen i amb quina
  resolució.
````

### 12.7 — «Ignición» y «centro»

**Clase:** deuda de nombres y de marca, sin cambio de modelo. **Código:**
ninguno si se aplaza; renombrar `IgnitionStep`, `setIgnition()`, capas y usos
es una refactorización transversal con pruebas. **Pere:** no para conservar
la deuda; sí si quiere que se haga antes de entregar.

**Propuesta:** ~~**12.7. El canvi de nom d'«ignició» a «centre».**~~ Resolta
el 24/11/2026 a la §11.85: es mantenen els identificadors heretats del centre
en aquesta entrega i se'n reserva el canvi de nom per a una refactorització
posterior; els focus reals ja són una eina diferent. **Motivo:** la §11.15
implementó los focos y `setFireStarts()`, así que esperar a que existan ya no
es un motivo válido. El nombre heredado puede confundir al mantenedor, pero
renombrarlo no alteraría el fuego; la marca visual del centro, mencionada en
la §11.11, es una cuestión de interfaz que también conviene anotar para la
revisión de Pere en fase 7.

El que es plantejava:

````text
- **12.7. El canvi de nom d'«ignició» a «centre».** Ve de la §11.11: el text ja
  diu centre i els identificadors encara diuen ignició —`IgnitionStep`,
  `IGNITION_SOURCE`, `setIgnition()`, `LAYERS.ignitionDot`— i el que és
  realment el punt d'ignició encara no existeix. Convé fer-ho el dia que
  l'eina del simulador col·loqui focus de debò, perquè llavors els dos
  conceptes hauran de conviure i els noms hauran de distingir-los.
````

### 12.8 — Mar en las estadísticas del terreno

**Clase:** defecto parcial de una decisión ya aplicada al modelo.
**Código:** sí, pequeño y localizado en el cálculo de estadísticas de
`terrain.ts`, con pruebas para costa y dominio sin tierra. No cambiar la
matriz de elevaciones ni la regla de combustibilidad. **Pere:** no para usar
el criterio `<= 0` ya aprobado en §11.19; sí si prefiere costa cartográfica.

**Propuesta, solo después del cambio y su verificación:** ~~**12.8. Les
cel·les de mar dins del domini.**~~ Resolta el 24/11/2026 a la §11.85: les
estadístiques d'altitud i pendent exclouen les cel·les amb elevació ≤ 0,
igual que el model exclou el mar de la combustió (§11.19). **Motivo:** la
§11.12 muestra que el mínimo de Sóller incluye fondo marino y que ambas
pantallas usan `TerrainService`. Filtrar solo la cifra final mínima no basta:
también hay que filtrar máxima y media de pendiente y ajustar su divisor. La
pendiente de las celdas de costa seguirá calculándose con sus vecinos, así
que no se promete una costa geométricamente exacta. **No marcar como
resuelta mientras no se haga.**

El que es plantejava:

````text
- **12.8. Les cel·les de mar dins del domini.** Resolta per al model el
  14/11/2026 a la §11.19: altitud ≤ 0 no crema. Queda només treure el mar de
  les xifres d'altitud i pendent de la §11.12. El plantejament: Ve de la §11.12. Un domini
  costaner inclou mar, i Terrarium hi dona el fons marí: l'altitud mínima surt
  negativa i la mitjana i la màxima de pendent compten talussos submarins. Cal
  decidir si el mar s'exclou de les xifres —i amb quin criteri: elevació ≤ 0 o
  una línia de costa— i el mateix criteri servirà al model, on el mar és
  no combustible.
````

### 12.10 — Meteorología en directo

**Clase:** decisión principal ejecutada, con dos límites de representatividad
todavía abiertos. **Código:** ninguno si se conserva el comportamiento;
umbral de distancia o corrección orográfica sí modificarían API, pantalla y
posiblemente resultados. **Pere:** sí para aceptar el límite en la memoria.

**Propuesta condicionada a Pere:** ~~**12.10. La meteorologia en directe.**~~
Resolta el 24/11/2026 a la §11.85: es conserva l'estació més propera al
centre amb totes quatre dades, sense llindar de distància ni correcció
orogràfica; la distància es mostra i l'actualització és manual amb memòria
cau de vint minuts (§11.18). **Motivo:** la §11.18 ya comprobó el CORS de
IPMA y decidió pasar ambos países por la API; una estación sin viento se
salta. La distancia visible informa de la limitación, pero no convierte la
observación en meteorología validada para los 30 km del dominio. No llamar a
la memoria caché de veinte minutos «refresco automático».

El que es plantejava:

````text
- **12.10. La meteorologia en directe.** Ve de la §11.17. Cal decidir quina
  estació parla per un domini de 30 km —la més propera al centre, o una
  interpolació—, cada quant es refresca, i què es fa quan l'estació no dona
  vent. AEMET va pel servidor per la clau; IPMA es pot demanar des del
  navegador si el CORS ho deixa, cosa que no s'ha comprovat.
````

### 12.16 — Coeficientes de contramedidas

**Clase:** hipótesis sin calibración, más dos verificaciones pendientes.
**Código:** ninguno para declarar el límite; calibrar valores podría cambiar
el modelo. Medir los planes máximos requiere una prueba de rendimiento,
sin necesidad de cambiar el algoritmo. **Pere:** sí, por el alcance de las
conclusiones cuantitativas.

**Propuesta condicionada a Pere:** ~~**12.16. Calibrar els coeficients de
les contramesures.**~~ Resolta el 24/11/2026 a la §11.85: no es calibren en
aquest TFG la retenció, l'assecat ni les probabilitats de les brases; els
resultats quantitatius d'aquestes mesures són escenaris condicionals, no
prediccions d'eficàcia real. **Motivo:** las §11.27, §11.30 y §11.31 ya
distinguen parámetros ilustrativos de observaciones. Una referencia a Albini
no sustituye la estimación de estos coeficientes; inventar una fuente para
ellos comprometería las conclusiones. El rendimiento con 100 medidas/512
vértices queda **sin medir**, y la revisión en varios navegadores también;
no se deben describir como pruebas superadas. La fase 7 de Pere solo cubre
la revisión de interfaz que efectivamente haga.

El que es plantejava:

````text
- **12.16. Calibrar els coeficients de les contramesures.** Ve de la §11.27,
  i s'amplia a la §11.31. Les reduccions dels escenaris antics, la retenció
  del 30 %, l'assecat d'una hora i les probabilitats d'emissió i d'ignició de
  les brases (§11.30) són hipòtesis. Si la memòria n'ha de treure
  conclusions quantitatives, cal una font —literatura d'extinció, dades
  d'operacions, els models de *spotting* d'Albini— o dir explícitament que no
  n'hi ha. Queden també sense mesurar el rendiment amb plans màxims (100
  mesures, 512 vèrtexs) i una revisió en més d'un navegador.
````

### 12.18 — Manual de usuario

**Clase:** entrega comprometida en fase 8. **Código:** ninguno; escritura y
comprobación del manual después de la fase 7. **Pere:** no hay una nueva
decisión que pedir; sí debe hacer su prueba de interfaz.

**No tachar hoy.** La condición de salida de `fase-08-manuals.md` dice que la
fase termina cuando el manual existe y la 12.18 está cerrada. Frase para
cuando el documento esté entregado: ~~**12.18. El manual d'usuari.**~~
Resolta el [data de lliurament] a la §[decisió de tancament]: el manual
d'usuari recull les eines, les hipòtesis i el límit d'ús d'emergència
acordats a la §11.34. **Motivo:** cerrar la decisión de hacer un manual como
si el manual ya existiera contradiría el plan y dejaría al usuario sin el
descargo que se quitó de la pantalla.

El que es plantejava:

````text
- **12.18. El manual d'usuari.** Ve de la §11.34. Ha de recollir el que la
  pantalla ja no explica: què fa cada secció i cada eina, les hipòtesis del
  model —combustible estimat, foc de superfície, retenció i assecat de les
  descàrregues, brases experimentals— i que el simulador no serveix per
  prendre decisions d'emergència.
````

### 12.19 — Llegada y producción de las brigadas

**Clase:** trabajo hecho. **Código:** ninguno para cerrar. **Pere:** no; los
valores provisionales se tratan en 12.25.

**Propuesta:** ~~**12.19. Les brigades no són instantànies: arribada,
efectius i rendiment.**~~ Resolta el 16/11/2026 a la §11.42: arribada,
efectius, rendiment per cel·la i parada de seguretat implementats; els valors
i casos oberts passen a la 12.25. **Motivo:** no debe seguir como trabajo no
hecho ni atribuir un tiempo de llegada real: el valor por defecto es cero.
El contrafoc sigue instantáneo, y la línea de agua usa cuatro efectivos por
defecto en el código actual; esos límites pertenecen a 12.25.

El que es plantejava:

````text
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
````

### 12.20 — Agentes visibles

**Clase:** visualización implementada; autonomía futura. **Código:** ninguno
para cerrar; los agentes autónomos exigirían otro modelo. **Pere:** no, ya
decidió el aspecto actual en §11.50.

**Propuesta:** ~~**12.20. Agents que fan visible qui treballa.**~~ Resolta el
24/11/2026 a la §11.85: els agents lliurats representen la feina calculada
i no prenen decisions; l'autonomia queda fora d'aquest TFG (§11.43 i §11.50).
**Motivo:** las brigadas y maquinaria ya se muestran como figuras 3D. La
descripción original del vuelo hasta el punto de carga está superada por la
§11.49: en los escenarios nuevos las aeronaves hacen la pasada sobre la
descarga; solo un escenario antiguo con `loadPoint` conserva la ruta.

El que es plantejava:

````text
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
````

### 12.21 — Coordinación de unidades reales

**Clase:** horizonte de investigación, no decisión de producto actual.
**Código:** ninguno ahora; sistema futuro completo y validación operativa.
**Pere:** no, ya lo planteó explícitamente como curiosidad.

**Propuesta:** ~~**12.21. Fer-lo servir de debò per coordinar unitats
reals.**~~ Resolta el 24/11/2026 a la §11.85: l'ús operatiu amb posicions
GPS queda fora del TFG i el simulador no serveix per a decisions d'emergència.
**Motivo:** la propia entrada enumera validación frente a incendios reales,
datos vivos y responsabilidad institucional que hoy faltan. Una posible
entrada de GPS no acreditaría por sí sola seguridad ni fiabilidad.

El que es plantejava:

````text
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
````

### 12.22 — Brigadas con decisiones propias

**Clase:** línea de investigación futura. **Código:** ninguno ahora; requeriría
estado de agentes, acoplamiento iterativo con el fuego, pruebas y nueva
validación. **Pere:** no para aplazarla; sí antes de emprenderla.

**Propuesta:** ~~**12.22. Brigades que decideixen les coses petites.**~~
Resolta el 24/11/2026 a la §11.85: no s'implementen agents autònoms en
aquest TFG; es conserva el calendari de brigades de la §11.42 i la proposta
queda com a treball futur. **Motivo:** la simulación actual calcula el fuego
con las medidas dadas; agentes que cambian órdenes al ver el fuego requieren
retroalimentación y validación de seguridad. Además, la dependencia de
puntos de origen y carga indicada en la entrada cambió cuando la §11.49
retiró esa interfaz.

El que es plantejava:

````text
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
````

### 12.23 — Parques y puntos de agua

**Clase:** funcionalidad ejecutada parcialmente y después **revocada**.
**Código:** ninguno para cerrar; reintroducirla sí exigiría restaurar interfaz,
servicios y pruebas. **Pere:** no, la retirada fue decisión suya (§11.49).

**Propuesta:** ~~**12.23. Parcs de bombers i punts d'aigua al mapa.**~~
Resolta el 24/11/2026 a la §11.85: les marques i la tria de llocs de càrrega
es retiren de l'entrega per decisió de Pere (§11.49); els agents es mantenen
sense aquestes dades. **Motivo:** no basta decir «queda la 12.24»:
§11.49 retiró incluso las rutas API y el script de preparación, después de
probar que la interfaz complicaba el uso. El tiempo entre pasadas vuelve a
ser editable, no calculado desde un aeródromo.

El que es plantejava:

````text
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
````

### 12.24 — Cobertura española y bases aéreas

**Clase:** investigación de datos ligada a una función retirada. **Código:**
ninguno ahora; obtener fuentes y restaurar servicios sería trabajo futuro.
**Pere:** no para el alcance actual; sí si decide reintroducir recursos.

**Propuesta:** ~~**12.24. Punts d'aigua i bases aèries a Espanya.**~~
Resolta el 24/11/2026 a la §11.85: no s'amplia la cobertura de punts ni de
bases en aquesta entrega perquè la tria i les capes es van retirar (§11.49);
la cerca i les llicències queden pendents només si es recupera la funció.
**Motivo:** la §11.45 sí encontró datos de GVA, REDIAM e ICNF y la §11.46
lagos del IGN; «España no tiene fuentes» sería falso. Para otras comunidades
y bases no se encontró cobertura abierta completa; tampoco se debe afirmar
licencia confirmada de ICNF o ENAIRE.

El que es plantejava:

````text
- **12.24. Punts d'aigua i bases aèries a Espanya.** En part feta el 16/11/2026
  a la §11.45: el País Valencià i Andalusia. Queda la resta d'Espanya, que no
  publica res obert, i les bases aèries. Ve de la §11.41. L'ICNF
  publica els de Portugal; a Espanya cada comunitat ho fa pel seu compte i a
  Balears no s'ha trobat res obert a l'IDEIB. Cal decidir si es demana la capa
  a l'IBANAT o a la Conselleria, si es fa servir la línia de costa com a punt de
  càrrega dels helicòpters, o si es diu que a Espanya no n'hi ha. I el mateix
  per a les bases de mitjans aeris (MITECO i comunitats), que no s'han trobat
  com a dades. També falta confirmar les llicències de l'ICNF i d'ENAIRE.
````

### 12.25 — Rendimientos y comportamiento de brigadas

**Clase:** (a) fuente ausente, (b) elección de hipótesis ya implementada,
(c) y (d) decisiones de comportamiento, (e) prueba de rendimiento no hecha.
**Código:** ninguno si se mantienen los contratos; cambiar (b), (c) o (d)
requiere código, pruebas de modelo y revisión de escenarios. **Pere:** sí
para ratificar (b), (c) y (d) y el límite de conclusiones de (a).

**Propuesta condicionada a Pere:** ~~**12.25. Rendiments que falten i
preguntes de les brigades.**~~ Resolta el 24/11/2026 a la §11.85: es
conserven els rendiments editables de la §11.42 —Ortega per a la línia
manual, els tres provisionals explícits—, el contrafoc instantani i les
passades ja programades quan una brigada s'atura; el cost de moltes parades
resta sense mesurar. **Motivo:** 40,2 m/h de Ortega y 7 m/h del NWCG
representan condiciones distintas; no se puede presentar la primera como
universal. El valor de la línea de agua es NWCG con **cuatro** efectivos por
defecto en `CREW_DEFAULTS`, no veinte. Una fuente para línea manual no
justifica el cortafuego mecánico, tala ni liquidación; (d) y (e) no se
resuelven buscando bibliografía. Si Pere quiere cancelar pasadas futuras o
dar llegada y producción al contrafoc, **dejar esta entrada abierta hasta
implementar y probar el cambio**.

El que es plantejava:

````text
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
````

### 12.26 — Tamaño mínimo de agua para el anfibio

**Clase:** fuente no encontrada para una función ya retirada. **Código:**
ninguno ahora; reintroducir selección validada de agua exigiría dato,
geometría y código. **Pere:** no para aplazarla; sí para reintroducirla.

**Propuesta:** ~~**12.26. El que falta dels llocs de càrrega.**~~ Resolta el
24/11/2026 a la §11.85: no s'estableix una mida mínima inventada per a la
làmina d'aigua; la tria de llocs de càrrega és fora de l'entrega (§11.49) i
la validació física resta com a recerca futura. **Motivo:** los 410 m de
carrera del CL-415EAF citados en la entrada no son un umbral universal para
el DHC-515 de referencia ni un criterio de superficie. Las partes (b), (c)
y (d) ya se cerraron en las §11.45 y §11.46 antes de retirarse la interfaz;
los escenarios antiguos con `loadPoint` aún pueden abrirse, pero no prueban
que su lugar de carga sea físicamente apto.

El que es plantejava:

````text
- **12.26. El que falta dels llocs de càrrega.** Ve de la §11.44. (a) La mida
  mínima de la làmina d'aigua per a l'amfibi: no s'ha trobat publicada (Viking
  dona 410 m de carrera per al CL-415EAF, una modificació). Queda oberta. Les
  (b), (c) i (d) es van resoldre el mateix dia a les §11.45 i §11.46: llacs i
  embassaments de tot Espanya (IGN), llocs de fora del domini fins a 30 km en
  una llista, i les marques amagades ja no es treuen de la tria. Llacs de
  Portugal: només els punts de l'ICNF de tipus embassament o llac.
````

## Orden de integración recomendado

1. Tachado documental sin cambio de contrato: 12.2, 12.5, 12.7, 12.19,
   12.20, 12.21, 12.22, 12.23, 12.24 y 12.26; actualizar los textos de las
   secciones que dicen que algo «falta» solo mediante la nueva resolución,
   conservando la historia.
2. Respuestas de Pere para 12.1, 12.10, 12.16 y 12.25; si elige otra opción,
   revisar resolución y alcance técnico antes de tacharlas.
3. Corregir y verificar 12.8, entonces fechar su resolución. Tras la prueba
   de interfaz de fase 7, entregar el manual y solo entonces tachar 12.18.
4. Quitar la frase muerta sobre la 12.4 y corregir el índice: sus catorce
   entradas tachadas tampoco deben aparecer bajo «Pendents obertes».

No he validado fuentes nuevas de campo ni medido los planes máximos. Este
informe contrasta la bitácora, el plan y el código presente; no atribuye a
esas comprobaciones una validación científica del simulador.
