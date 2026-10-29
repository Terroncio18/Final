# Bitàcola tècnica — IgnisLab

Registre de **decisions preses**: què s'ha decidit i per quins motius. Material
de base per a la memòria del TFG.

Darrera actualització: 29 d'octubre de 2026.

---

## 1. Abast

Aplicació web que uneix el **monitoratge de focus actius** amb un **simulador
interactiu de propagació d'incendis forestals**, sobre la península Ibèrica i els
arxipèlags balear i canari.

Públic: població de la interfície urbana-forestal, docents i persones
interessades a comprendre el fenomen. **No** substitueix les eines operatives
dels serveis d'extinció.

Buit que omple, segons l'estat de l'art: les plataformes que mostren focus no
simulen, els simuladors no s'alimenten de deteccions en temps real, i els més
complets són comercials o d'ús institucional restringit.

---

## 2. Decisions preses

### 2.1. Arquitectura

Backend propi i frontend separat, en dos projectes dins d'un mateix repositori
(`web/` i `api/`). Motius:

- Les claus d'API (FIRMS, AEMET) i el CORS no es poden resoldre des del navegador.
- El frontend és estàtic i el backend no: separats, cadascun s'instal·la, es
  prova i es desplega pel seu compte.
- Descartat el monorepo amb espais de treball npm, que només gestionen la meitat
  JavaScript mentre l'entorn de Python hi vivia a dins ignorant-los.

### 2.2. Visor cartogràfic

MapLibre GL JS `^6.15.0`, construït des de zero. Motius:

- És l'estàndard lliure en cartografia web: ràster, vectorial, terreny i capes de
  dades natives, sense mantenir un sistema propi de càrrega progressiva.
- El simulador necessita un `CustomLayer` amb estat propi a la GPU, i els
  embolcalls declaratius com `react-map-gl` s'hi pelegen.
- La versió es fixa a propòsit: la 6.4.0 i anteriors arrosseguen un avís crític
  d'XSS (GHSA-jrc7-96c5-q579).

### 2.3. Framework del frontend

Angular 22 en mode **zoneless**. Motius:

- Comprensió: no es pot defensar davant d'un tribunal codi que no s'entén.
- Angular imposa l'estructura, cosa que en un projecte de mesos en solitari
  estalvia re-discutir l'arquitectura cada setmana.
- Sense zones, els esdeveniments de MapLibre no disparen detecció de canvis, de
  manera que el mapa no va a batzegades i no cal embolcallar res amb
  `runOutsideAngular`.

### 2.4. Relació entre Angular i MapLibre

El mapa no viu dins d'Angular: un servei n'és l'únic propietari i el component
només posseeix l'element contenidor. Motius:

- MapLibre té el seu propi canvas i el seu propi bucle de dibuixat; intentar que
  Angular el governi és pelear-s'hi constantment.
- El servei publica com a senyal només allò a què la plantilla ha de reaccionar.

### 2.5. Domini de simulació

Una finestra de mida fixa de **30 × 30 km centrada en el punt d'ignició**, no el
polígon del municipi. Motius:

- Els incendis no respecten límits administratius: els de la Sierra Oeste de
  Madrid del juliol de 2026 van creuar diversos termes municipals.
- L'autòmat cel·lular necessita una graella fixa i acotada: la Península a 30 m
  són 10.000 milions de cel·les, mentre que 30 × 30 km en són un milió.
- Una finestra ajustable per l'usuari faria variar el cost i el temps de càlcul
  entre execucions.

Conseqüència a comunicar a la interfície: el domini pot ser més gran que el
municipi des del qual s'hi entra, i s'ha d'explicar perquè no sembli un error.

### 2.6. Cartografia base i relleu

Imatgeria d'Esri World Imagery i elevació Terrarium de Mapzen, en mapa pla amb
ombrejat de relleu. Motius:

- Totes dues fonts són globals, gratuïtes i sense clau, de manera que el visor
  cobreix tot l'àmbit sense preprocessament.
- L'ombrejat fa llegible l'orografia sense pagar el cost del terreny 3D.
- L'elevació es carrega encara que el mapa sigui pla, perquè el pendent és un
  dels tres factors de Rothermel.

### 2.7. Límits administratius

NUTS 2024 d'Eurostat GISCO, nivell 2 per a les regions i nivell 3 per al pas
següent. Motius:

- Una sola font i un sol criteri de generalització per a Espanya i Portugal, ja
  en GeoJSON i en WGS 84.
- A Espanya el nivell 2 són exactament les comunitats autònomes.
- Al nivell 3 són les províncies, i a Balears i Canàries les illes, cosa que per
  a incendis va millor que la província: Mallorca i Menorca són dominis de foc
  separats.

### 2.8. Enquadraments

Península i Balears en un mapa, Canàries en un segon mapa al costat. Motius:

- Balears hi entra pràcticament de franc: costa entre zero i 0,09 nivells de
  zoom segons la forma de la finestra.
- Canàries duplicaria el rang de latitud i deixaria un marc on la terra és menys
  d'una cinquena part del que es veu.
- Un segon mapa evita traslladar les coordenades de les illes, que caldria
  desfer a cada clic.

### 2.9. La portada és el mapa de focus actius, i és fixa

Sense arrossegament ni zoom (`interactive: false`). L'única interacció és el clic
sobre un focus, que obre una barra lateral a la dreta amb la informació de la
detecció i el botó de crear-hi una simulació. Motius:

- La unió entre monitoratge i simulació és l'aportació del treball: ha de ser la
  primera pantalla, no estar amagada darrere de tres clics de navegació.
- A aquesta escala no hi ha cap detall que convidi a navegar.
- Un mapa fix estalvia el conflicte entre `maxBounds` i `fitBounds` (§4).

### 2.10. L'altre camí és un botó de simulació nova

Viu a la capçalera i és sempre accessible. Obre un formulari de tres passos
encadenats, i a cada pas el mapa enquadra el que s'ha triat i mostra els límits i
els noms del nivell següent: **regió** (NUTS 2) → **província o illa** (NUTS 3) →
**municipi** (LAU). Després es genera el mapa 3D centrat al municipi i l'usuari hi
marca el punt d'ignició. Motius:

- Fora de temporada FIRMS gairebé no dona focus forestals, de manera que aquest
  és l'únic camí que funciona sempre i per això no s'amaga mai.
- La província al mig evita desplegables impossibles: Castella i Lleó té més de
  2.200 municipis i una província en té unes centenes.
- El desplegable mana i el mapa és la vista prèvia: una sola jerarquia amb dues
  representacions, en lloc d'un arbre de rutes.

### 2.11. Navegació per rutes

Un segment per vista, amb una sola ruta `:scope` i no una ruta literal per vista.
Motius:

- La URL identifica la vista, de manera que es pot compartir un enllaç que obre
  on eres.
- Amb paràmetre el router reutilitza el component i només mou la càmera; amb
  rutes literals destruiria el component a cada clic i, com que el component crea
  el mapa en muntar-se, llençaria el context WebGL cada vegada.
- `withComponentInputBinding()` lliura el paràmetre com un *input*, de manera que
  no cal subscriure's a `ActivatedRoute`.

### 2.12. Llenguatge i marc del backend

Node amb Fastify i TypeScript, no Python amb FastAPI. Tanca la pendent 3.1.
Motius:

- El que fa el servidor és demanar sis CSV, ajuntar-los i guardar-los deu
  minuts. En una feina així cap dels dos llenguatges aporta res que l'altre no
  tingui.
- L'argument a favor de Python era el preprocessament de cartografia
  (`rasterio`, `geopandas`), i això és feina per lots que ja viu en scripts a
  part, com `web/scripts/fetch-regions.mjs`. Quan calgui, un script de Python hi
  cabrà igualment sense que l'API hi tingui res a veure.
- Un sol llenguatge als dos projectes: la forma de la resposta s'escriu un cop i
  el navegador l'entén sense traduir-la.

### 2.13. Com es demanen les deteccions

Les tres plataformes VIIRS sobre dues caixes, sis peticions en paral·lel, i una
resposta parcial es dona per bona. Motius:

- Les tres plataformes donen 375 m i passen a hores diferents, de manera que un
  mateix foc el solen veure més d'una: són observacions, no incendis (§2.16).
- L'API d'àrea pren una caixa per petició i l'àmbit no és continu, així que són
  dues: península amb Balears, i Canàries.
- Amb `Promise.allSettled`, si una plataforma falla la resta se serveix igual i
  la fallada queda al registre. Només un error complet llença.
- La caixa peninsular baixa fins als 35,8° i hi entren el nord del Marroc i
  d'Algèria. Què se'n fa és la pendent 3.10.

### 2.14. Finestra temporal d'un dia

Es demana un dia de deteccions, no els cinc que admet l'API. Motius:

- La portada respon «què crema ara», no «què ha cremat aquesta setmana». En un
  acumulat, un incendi apagat dimarts es veu igual que un que crema ara.
- Mesurat el 25/10/2026 sobre l'àmbit sencer: un dia dona 195 deteccions i cinc
  en donen 1.002. A l'escala de la portada, el segon número és confeti.
- Els cinc dies queden com a sostre conegut per si més endavant hi ha una vista
  d'episodi, on seguir un incendi uns quants dies sí que té sentit.
- Revertir-ho és barat: el servidor accepta `?days=` i el client ho té en un sol
  número, `HOTSPOT_DAYS`.

### 2.15. Memòria cau de deu minuts, i dades velles abans que un mapa buit

Motius:

- VIIRS només canvia quan passa un satèl·lit, que sobre Ibèria són un grapat de
  vegades al dia, i les deteccions NRT apareixen hores després del pas.
  Preguntar-ho a cada càrrega de pàgina seria gastar quota per rebre el mateix.
- La clau admet 5.000 peticions cada deu minuts, i cada visita en consumiria sis.
- Si FIRMS falla i hi ha resposta anterior, se serveix aquella marcada amb
  `x-stale: true`. Un mapa buit es llegeix com «no crema res», i això és el
  pitjor que aquesta pantalla pot arribar a dir.
- En memòria i no en disc: la dada és pública, és barata de refer i no val res al
  cap d'una estona; persistir-la només afegiria una peça que es pot espatllar.

### 2.16. Una marca per detecció, i el FRP mana

Cada detecció és un cercle, i la potència radiativa en decideix la mida i el
color alhora. Motius:

- FIRMS no agrupa les deteccions en incendis, i aquí tampoc: ajuntar-les és una
  decisió metodològica pròpia i és la pendent 3.7. Fins que es prengui, el que es
  pinta és el que s'ha observat.
- La mida i el color porten el mateix valor a propòsit: una lectura que depengués
  només del color es perdria en una impressió en blanc i negre i per a qui no els
  distingeix.
- Les parades pugen per desenes (1, 10, 100 i 1.000 MW) perquè la potència
  s'escampa per ordres de magnitud: amb parades regulars, tot allò que no fos un
  gran incendi quedaria del mateix color.
- L'anella fosca és el que separa la marca de la imatgeria: sobre sorra o núvol,
  un punt ambre tot sol es dissol.
- `circle-sort-key` pel FRP, de manera que en un encavalcament guanya la marca
  més potent i no la que el servidor hagi enviat l'última.

### 2.17. La potència es presenta per trams, i no es diu què crema

El panell d'una detecció escriu «1,2 MW · potència baixa» i explica què és
aquesta xifra. En cap cas diu si allò que crema és un rostoll o un bosc. Motius:

- La potència radiativa mesura l'energia que el foc emet **com a radiació**, que
  és una fracció de la que allibera la combustió, dins d'un píxel de 375 m i en
  l'instant del pas del satèl·lit. És una mesura d'intensitat, no de mida.
- I sobretot no sap què crema: un rostoll i una pineda que emetin igual es
  llegeixen igual. Etiquetar un focus de 2 MW com a «crema agrícola» seria una
  inferència treta de l'època de l'any disfressada de mesura. Això ho dirà la
  coberta del sòl (MFE25, COS); fins llavors, no es diu.
- Per això l'etiqueta anomena la potència —baixa, moderada, alta— i el text del
  costat diu què indica i què no.
- Els talls, 5 i 50 MW, són de presentació i els fixa aquest treball: **no hi ha
  cap llindar normalitzat de FRP** que separi un incendi forestal d'una crema
  agrícola, precisament perquè la mesura no distingeix el combustible.
- El tram alt està mal calibrat i se sap: les mostres de tardor no hi arriben.
  El 25/10/2026 el màxim de l'àmbit van ser 56,7 MW i el 29/10/2026, amb 96
  deteccions, cap no va passar de 4,21. Cal revisar-ho contra una mostra d'estiu.

---

### 2.18. La jerarquia és única i la donen els NUTS

Els tres passos de §2.10 valen per a tot l'àmbit: **regió** (NUTS 2) →
**província o illa** (NUTS 3) → **municipi** (LAU). Península, Balears i Canàries
no són un primer pas, i Espanya i Portugal tampoc: el país és un encapçalament
dins la llista i l'enquadrament es deriva del que s'ha triat. Motius:

- Al nivell 3, Balears i Canàries ja són illes (§2.7), de manera que «illa i
  municipi» i «NUTS 3 i municipi» són el mateix pas amb dos noms.
- Triar «Illes Balears» ja fixa país i comunitat: preguntar-ho abans són dos
  passos que només existeixen per saltar-se'ls.
- Una sola forma és un sol joc de components i un sol conjunt de rutes. Amb
  branques de fondària diferent n'hi hauria dues per mantenir.
- El commutador Península / Illes Canàries de la capçalera ja diu quin mapa mira
  l'usuari quan obre el formulari, de manera que tornar a preguntar el territori
  seria repetir una tria ja feta.

Descartada l'alternativa plantejada el 25/10/2026: primer Península Ibèrica,
Balears o Canàries, i per la banda peninsular Espanya o Portugal → comunitat →
província → municipi. Guanyava una primera pantalla de tres botons en lloc d'una
llista de 24 entrades i deixava l'àmbit ibèric dit en veu alta, però a canvi de
cinc nivells per una banda i tres per l'altra, i duplicava informació que el codi
NUTS ja porta a dins.

A la pantalla cada país és un desplegable tancat —un `<details>` del navegador,
amb el nombre de regions al costat—, de manera que el primer pas són dues files
i no una llista de vint-i-quatre amb scroll. Cap dels dos s'obre per defecte:
obrir Espanya i deixar Portugal tancat diria en silenci de quin dels dos va
l'aplicació, i l'àmbit ibèric és part de l'aportació (§1).

### 2.19. La jerarquia viatja a la URL, i amb codis

Un segment per pas, i el punt d'ignició al final:
`/simulacio/ES51/ES511/08193/@2.47,41.68`. Motius:

- Una simulació sencera és un enllaç: es pot compartir, desar i obrir on eres.
  Davant d'un tribunal això es demostra en deu segons.
- El botó enrere desfà un pas en lloc de treure't del formulari sencer.
- El codi és la clau amb què s'uneixen les dades i és estable; el nom llegible
  va a la interfície. A més, no pren cap posició sobre com s'han d'anomenar els
  nivells portuguesos, de manera que la pendent 3.4 no bloqueja la navegació.
- El punt d'ignició anirà en ordre longitud-latitud, el de GeoJSON i el de
  MapLibre. Barrejar els dos ordres dins d'un mateix projecte és d'on surten
  els errors de coordenades invertides.

Descartat guardar l'estat al component amb una sola ruta `/simulacio`. És més
barat d'escriure, però no hi ha res compartible, el botó enrere se salta tot el
formulari i es perd l'argument de §2.11.

### 2.20. El mapa viu per sobre de les rutes

`MapShell` ocupa una ruta de camí buit, que casa amb qualsevol URL de sota, i
és l'únic lloc on es crea el mapa. Els passos són fills seus i només hi dibuixen
el panell a sobre. Motius:

- El mapa és un context WebGL i un estil amb quatre fonts. Refer-lo a cada pas
  deixaria la pantalla en blanc un segon cada vegada. §2.11 ho deia per als
  àmbits; amb la jerarquia a la URL val per a tots els nivells.
- Els passos són germans i no niats: cada un és un panell diferent, no un
  panell a dins d'un altre.
- L'enquadrament dels passos reserva l'amplada del panell. El llenç ocupa tota
  la finestra i el panell hi va a sobre, de manera que sense aquesta reserva un
  terç del que s'enquadra queda amagat.

Parany que ha calgut resoldre: el mapa es crea a `afterNextRender`, que Angular
executa *després* de la primera detecció de canvis, i un fill que demana
enquadrament hi arriba abans que hi hagi mapa. `MapService` guarda la feina i la
repeteix quan l'estil hi és.

### 2.21. Durant el formulari, els focus s'apaguen

Mentre es prepara una simulació la capa de deteccions no es dibuixa, i torna en
sortir del formulari: pel botó de tancar, pel botó enrere del navegador o
perquè s'ha acabat. Motius:

- Durant el formulari el mapa respon una altra pregunta. Ensenya límits
  administratius i el que es tria és un territori, no on crema.
- Les marques convidaven a clicar una cosa que el formulari no sap contestar,
  perquè el panell de detecció només existeix a la portada: era la pendent 3.12.
- Amagar la capa també apaga els clics sense cap segon camí de codi:
  `queryRenderedFeatures` no retorna res d'una capa amagada.
- Ho governa un sol component, `SimulationFlow`, que no dibuixa res i existeix
  precisament per tenir una vida pròpia: apaga en néixer i encén en morir, de
  manera que cap pas se n'ha de recordar ni pot deixar-s'ho.
- Sortir pel botó de tancar torna sempre a l'enquadrament per defecte,
  Península i Balears, i no al d'on es venia. Si la càmera es quedés on l'havia
  deixat el formulari, el commutador de la capçalera i el mapa dirien coses
  diferents.

Descartat deixar-los visibles, que és com es va escriure primer. Ensenyar on hi
ha foc mentre es tria la regió és informatiu, però la contrapartida és un mapa
que crida enmig d'un formulari i un clic que no fa res.

### 2.22. La regió es ressalta en assenyalar-la, i no parpelleja

Assenyalar una fila de la llista —amb el rató o amb el tabulador— dibuixa el
contorn de la regió al mapa a l'instant, i es queda mentre s'hi assenyali.
Sense transició i sense pampallugues. Motius:

- En un mapa d'incendis, el que parpelleja vol dir foc. El parpelleig és
  vocabulari d'alarma, i donar-lo a un gest de navegació diria una cosa que no
  és, just amb el llenguatge que la portada fa servir per a una altra.
- Contradiria una decisió ja presa: l'anell de càrrega respecta
  `prefers-reduced-motion` perquè girar és un disparador vestibular per a
  algunes persones. La WCAG, a més, limita el que destella i exigeix poder-ho
  aturar.
- La sensació de resposta directa la dona la immediatesa, no el moviment. Una
  fosa de 150 ms en un `hover` es percep com a lentitud; el canvi sec es percep
  com que el mapa obeeix.
- El teclat fa exactament el mateix que el rató. El `canvas` és
  `tabindex="-1"` per `interactive: false` (§4), de manera que la llista és
  l'única via que queda a qui no fa servir ratolí.

Com està fet: una parella de capes pròpies amb un filtre que no casa amb res
fins que hi ha regió. El contorn és del primer pas i prou: en triar la regió
s'apaga, perquè al pas següent la càmera ja l'enquadra i dibuixar-ne la vora
només repetiria el que omple la pantalla. Canviar un filtre és de les
operacions més barates de
MapLibre, i això és el que permet seguir el punter per una llista de 24 sense
entrebancs. El contorn és blanc i no del color d'accent, perquè sobre
imatgeria el taronja vol dir foc. I el pes el porta la línia: un farciment prou
viu per notar-se taparia el terreny, que és justament el que s'ha vingut a
mirar.

### 2.23. Les províncies arriben quan calen, no amb la portada

El fitxer de NUTS 3 són 81 províncies i illes i 380 kB, i no entra a l'estil
inicial del mapa: es baixa el primer cop que un pas el demana. Motius:

- La portada és la pantalla que ha d'obrir-se de pressa (§2.9) i no dibuixa
  cap província. Carregar-les-hi seria pagar 380 kB i una anàlisi de JSON al
  fil principal just quan es veu l'aplicació per primera vegada.
- El fitxer es baixa i s'analitza **una sola vegada per a dos usos**: qui
  necessita la llista passa la col·lecció ja analitzada al mapa, en lloc de
  donar-li una URL i deixar que MapLibre la torni a demanar.
- La regió pare no es busca enlloc: un codi NUTS 3 és el seu NUTS 2 més un
  caràcter, de manera que ES511 pertany a ES51 per construcció. Cap taula de
  correspondències.

Nou de les vint-i-quatre regions tenen una sola NUTS 3 —Madrid, Navarra,
Astúries, Cantàbria, la Rioja, Múrcia, l'Algarve, Grande Lisboa i Setúbal—, de
manera que el pas de vegades és una llista d'un element. Es mostra igualment i
no se salta: una redirecció automàtica convertiria el botó enrere en una
trampa, perquè tornar al pas el tornaria a llançar endavant tot seguit. El
títol ho diu: «província única».

A Balears i Canàries el pas dona illes —Mallorca, Menorca, Eivissa i
Formentera; set a Canàries— que és exactament el que §2.7 buscava en triar
NUTS 3 en lloc de províncies.

Parany trobat en fer-ho: el pas demana les vores de les províncies abans que
el fitxer que les porta hagi arribat, de manera que el filtre s'aplicava a unes
capes que encara no existien i no feia res. El servei recorda què s'ha demanat
i ho aplica en afegir-les, igual que fa amb la visibilitat dels focus.

### 2.24. La marca ve d'un conjunt d'icones publicat

La flama de la capçalera és **Material Symbols Outlined «mode_heat»**, de
Google, amb llicència Apache 2.0, amb els eixos FILL 0, wght 400, GRAD 0 i
opsz 24. No és una icona dibuixada per a aquest treball. Motius:

- Un recurs publicat se cita: té nom, variant, llicència i URL. Una
  il·lustració pròpia s'hauria de defensar com a part del treball, i el dibuix
  vectorial no n'és el tema.
- No s'instal·la `@angular/material` per una icona: el paquet porta
  components, temes i tipografia, i el pressupost de *bundle* ja no es compleix
  (§3.8). Tampoc `material-symbols`, que distribueix la font variable sencera.
- El que s'incrusta al component és el traçat SVG oficial amb la citació al
  costat. Cap dependència i la mateixa icona.
- El color és nostre i la forma és d'ells: s'aplica l'accent pla, sense cap
  degradat, i el traçat no es toca.
- A la pestanya del navegador hi va la variant plena (FILL 1). A 16 px el
  contorn buit s'omple i la silueta es perd.

### 2.25. Els municipis: un fitxer per província, i a Portugal freguesies

El tercer pas llegeix `data/municipalities/<NUTS3>.geojson`. Vuitanta-un
fitxers, 13 MB en total; el més gran és Burgos amb 372 municipis i 438 kB, i el
més petit El Hierro amb 3 i 4,7 kB. Mai es carreguen tots: quan s'obre el pas
ja se sap quina província cal.

Tres coses del fitxer de GISCO han decidit la resta:

- Es publica en **un sol fitxer de 150 MB per a tota Europa**, a una sola
  escala i sense descàrrega per país. Es baixa un cop a una memòria cau local
  que no va al repositori; el que es commiteja és la sortida partida.
- **No porta codi NUTS.** Els atributs són `GISCO_ID`, `CNTR_CODE`,
  `LAU_NAME`, població, àrea i any. A Espanya el codi delataria la província
  —ES_08193 comença pel número INE— però a Portugal el codi és districte,
  concelho i freguesia, i les NUTS 3 portugueses no segueixen els districtes.
  Per això els dos països es resolen igual: punt dins de polígon contra els
  NUTS 3, amb la prova feta contra el fitxer d'1:1 M i no contra el d'1:3 M que
  dibuixa l'aplicació, perquè les LAU també són 1:1 M i fer coincidir les
  escales és el que evita que les unitats costaneres caiguin fora.
- De 11.224 unitats: **11.012 assignades directament, 2 per proximitat i 212
  fora de l'àmbit**. Les dues de proximitat —Pájara a Fuerteventura i les Valls
  de Valira a Lleida— queden a menys de 100 m de la seva província. Les 212 són
  exactament Açores (prefixos PT_41 a PT_49), Madeira (PT_31 i PT_32), Ceuta i
  Melilla.

Parany que va fer visible aquest darrer número: la primera versió assignava «la
província més propera» sense cap límit, i va repartir les freguesies açorianes
a La Palma i Ceuta a Cadis. El límit és de 0,05°, uns 5 km: prou per perdonar
un desajust de generalització i insuficient per travessar l'Atlàntic.

**LAU no és la mateixa unitat als dos països.** Espanya declara el municipi:
8.132. Portugal declara la **freguesia**, la parròquia civil: 3.092, que
s'agrupen en els 308 concelhos pels quatre primers dígits del codi. Es pren la
unitat tal com la publica la font i la interfície l'anomena pel seu nom —«Tria
un municipi» a Espanya, «Tria una freguesia» a Portugal—, perquè dir-ne
municipi a totes dues seria afirmar una cosa falsa de mitja llista. Descartat:

- Dissoldre freguesies en concelhos. GISCO no en publica el contorn i caldria
  una unió de polígons, amb els errors de topologia que arrossega i una
  dependència nova.
- Agafar la CAOP de la DGT per a Portugal: dues fonts, dos criteris de
  generalització i dues dates, just el que §2.7 evitava.

La unitat administrativa serveix aquí per **trobar un lloc**, no per acotar la
simulació: el domini es dibuixa al voltant del punt d'ignició i no segueix cap
frontera. Que a Portugal sigui més fina no fa cap mal.

### 2.26. El punt d'ignició viu a la URL

Un clic al mapa escriu `@0.40354,41.63850` al final de l'adreça, i amb això es
tanca el que §2.19 buscava: **una simulació sencera és un enllaç**. Motius i
conseqüències:

- La URL és l'únic lloc on hi ha el punt. El component no en guarda cap còpia:
  dibuixa el que diu l'adreça. Així, obrir un enllaç i marcar-lo a mà donen
  exactament el mateix estat, sense cap camí de codi que els pugui separar.
- Cinc decimals, aproximadament un metre. És molt més fi que la cel·la de 30 m,
  però costa cinc caràcters i evita que reobrir un enllaç compartit caigui en
  una cel·la diferent de la que es va marcar.
- No ha calgut tocar els gestos del mapa. `interactive: false` deixa passar
  `click` igualment (§2.9), de manera que l'única diferència entre triar un
  punt i no fer-ho és què fa el gestor amb l'esdeveniment.
- Moure el punt **substitueix** l'entrada de l'historial en lloc d'apilar-ne
  una: altrament el botó enrere recorreria el rastre de tots els intents en
  lloc de tornar a la llista. La primera vegada sí que n'apila una, perquè
  enrere ha de desfer la tria.
- La marca són dues capes: un anell per trobar-la sobre una fotografia i un
  punt per dir exactament on és.

Dues coses que es deixen com estan, a propòsit:

- **El clic no es limita al polígon del municipi.** El municipi és com s'ha
  trobat el lloc, no una frontera de la simulació: el domini es retalla al
  voltant del punt i no segueix cap línia administrativa (§2.25). Un clic just
  a l'altre costat del límit, al bosc del municipi veí, sol ser el bo.
- **No s'hi pot fer zoom.** A l'enquadrament d'un municipi un píxel són uns
  18 m, per sota de la cel·la de 30 m, de manera que la precisió del clic no és
  el factor que mana. Si algun dia ho és, la palanca és activar el zoom només
  en aquest pas, no a la portada.

---

## 3. Decisions pendents

- ~~**3.1. Llenguatge del backend.**~~ Resolta el 25/10/2026: Node amb Fastify
  (§2.12).
- **3.2. Model digital d'elevacions.** Terrarium per comoditat; l'estat de l'art
  cita el Copernicus DEM GLO-30, de més qualitat.
- **3.3. Polígons sense model de combustible.** `MODCOMB = 0` són 5.471 d'11.654
  polígons a l'inventari balear. Confondre'ls amb terreny no combustible
  convertiria mitja illa en tallafocs.
- **3.4. Com anomenar la jerarquia a Portugal.** Els NUTS 2 i 3 portuguesos són
  regions estadístiques, no comunitats ni províncies, i els seus 18 districtes
  —amb què treballa l'ICNF— no hi surten. El tercer nivell ja no hi entra:
  confirmat el 29/10/2026 que a Portugal es treballa amb freguesies i que la
  interfície les anomena pel seu nom (§2.25). Queda obert només com anomenar
  els dos nivells de dalt, que ara la interfície escriu «regió» i «província».
- ~~**3.5. Cremes agrícoles i incendis.**~~ Resolta el 29/10/2026: etiqueta per
  potència i cap afirmació sobre què crema (§2.17). Res no es filtra. Distingir
  rostoll de bosc queda per quan hi hagi coberta del sòl (MFE25, COS).
- **3.6. Terreny 3D a la vista de simulació.** Activable i no obligatori, perquè
  drapejar el `CustomLayer` sobre una malla de terreny és més feina que pintar-lo
  sobre un pla.
- **3.7. Què és «un focus» en clicar.** Un episodi real dona centenars de
  deteccions de 375 m solapades i FIRMS no les agrupa en incendis.
- ~~**3.8. Pressupost de *bundle*.**~~ Resolta el 29/10/2026: els límits
  passen a 1,5 MB d'avís i 1,75 MB d'error, i `ng build` ja no falla.
  - La mesura del dia: **1,40 MB en cru i 314 kB per la xarxa**. El sòl és
    MapLibre, uns 1,29 MB, que no depèn de res del que s'escrigui aquí; els
    tres passos del formulari sencers van costar uns 110 kB crus i menys de
    15 kB comprimits.
  - Els límits nous no són un xec en blanc: encara detecten un creixement propi
    d'uns 100 kB (avís) o 350 kB (error), que és el que es vol vigilar.
  - El pressupost mira la mida crua i qui pateix és la comprimida, i 314 kB per
    a una aplicació de mapes és normal. Carregar MapLibre a part queda per si
    algun dia es mesura que l'espera de la portada molesta de debò.
- **3.9. L'antiguitat de les dades no arriba a la pantalla.** El servidor
  publica `x-fetched-at` i `x-stale`, però la font GeoJSON la descarrega
  MapLibre pel seu compte i ningú llegeix les capçaleres. Amb deteccions NRT la
  pantalla ha de dir de quan són, i també què passa si l'API no respon: ara el
  mapa surt buit, que és justament el que §2.15 volia evitar.
- **3.10. Deteccions fora de l'àmbit.** La caixa peninsular arriba al nord del
  Marroc i d'Algèria: 65 de les 196 deteccions del 25/10/2026, un terç del que
  es veu a la portada. Ajornada com a millora, no com a dubte: la via és clara i
  el que falta és fer-la.
  - Retallar la caixa per latitud no serveix: 41 d'aquestes 65 queden per sobre
    del paral·lel de Tarifa, perquè la costa argelina entre Alger i Dellys va
    dels 36,1° als 36,8°, més al nord que Màlaga.
  - La via és punt-dins-de-polígon contra `regions.geojson`, que el navegador
    ja té carregat, amb un marge d'uns 3 km. Amb el polígon cru hi cauen
    deteccions reals de la costa —el 25/10/2026, dues al Rincón de la
    Victoria— perquè GISCO a 1:3 M retalla la línia de costa. El marge no
    deixa entrar res africà: Ceuta i Melilla no són al fitxer i l'Estret fa
    14 km.
- **3.11. La llengua dels noms de regió.** GISCO dona el nom oficial de cada
  regió, de manera que una interfície en català llista «Cataluña», «País Vasco»
  i «Illes Balears» de cop. Germana de la 3.4.
- ~~**3.12. Clicar una detecció amb el formulari obert.**~~ Resolta el
  29/10/2026: durant el formulari la capa s'apaga i no hi ha clic possible
  (§2.21). Que una detecció porti directament al seu municipi —la unió entre
  els dos camins cap a la simulació— passa a ser una millora, no un forat.
  - Etiquetar i no descartar: una propietat `region` a cada detecció i un
    `filter: ['has', 'region']` a la capa. Tornar a mostrar-les és una línia,
    es pot dir quantes se'n descarten, i el nom de la regió és justament el que
    la barra lateral haurà d'escriure (§2.9).
- ~~**3.13. L'atribució del mapa no és completa.**~~ Resolta el 29/10/2026:
  les tres cadenes diuen ara el que demana cada proveïdor (§6). Preu que es
  paga: els crèdits ocupen tres línies a baix a l'esquerra. Es podrien amagar
  darrere del botó plegable, però GISCO demana que la nota sigui **visible**,
  de manera que es queden a la vista.
  - Implica que el navegador es descarregui ell mateix la resposta en lloc de
    donar-ne la URL a MapLibre, cosa que de passada posa les capçaleres a l'abast
    i desencalla la 3.9.

---

## 4. Troballes tècniques

Coses que han costat temps i convé no redescobrir.

- **Les tessel·les d'Esri van `{z}/{y}/{x}`**, amb la fila abans que la columna.
  Amb l'ordre de MapLibre el mapa carrega tessel·les reals mal col·locades, i
  sembla que funcioni.
- **El *worker* de MapLibre** té el nom resolt en temps d'execució, cosa que cap
  empaquetador pot seguir: cal copiar-lo des de `node_modules` com a recurs
  estàtic i apuntar-hi amb `setWorkerUrl()`, o el mapa no carrega res.
- **El cel no es pot declarar dins de l'estil.** MapLibre 6 rebutja el membre
  `sky` i en rebutjar-lo tomba l'estil sencer sense avisar. Va amb `map.setSky()`.
- **`isStyleLoaded()` no vol dir «l'estil ja hi és».** Torna fals cada vegada
  que l'estil té canvis pendents, de manera que un `setFilter` o un
  `setLayoutProperty` el deixen fals uns instants. Fer-lo servir per decidir si
  el mapa està llest feia que un `fitBounds` disparat just després —sortir del
  formulari, que apaga el ressaltat i torna els focus— es prengués per «encara
  no hi ha mapa», s'encolés i no s'executés mai: el mapa es quedava a Canàries
  amb la URL i el botó dient Península. La pregunta bona és si l'estil s'ha
  carregat **alguna vegada**, i això demana una bandera pròpia.
- **Un gestor d'`error` al mapa** val el minut que costa: totes aquestes fallades
  es manifesten igual, amb un mapa negre.
- **Amb terreny 3D, una capa `background` no pinta el terra**, que és la malla.
  Cal el tipus `color-relief`, que sí que s'hi drapeja.
- **No lligar la interfície a un sol esdeveniment del mapa.** `load` no es dispara
  si un *worker* falla en arrencar, encara que el mapa renderitzi perfectament.
  Cal el primer de `load` o `idle`.
- **`maxBounds` guanya a `fitBounds` i no avisa.** No limita el centre, sinó que
  el que es veu no surti de la caixa, de manera que acosta la càmera fins a tapar
  el sobrant i trenca l'enquadrament. La caixa s'ha de derivar del que es veu al
  zoom mínim.
- **El zoom d'un enquadrament no és un número**: depèn de la mida del contenidor.
  Qualsevol límit relatiu a una vista s'ha de llegir de `cameraForBounds()` i
  recalcular quan la finestra canvia de mida.
- **`interactive: false` no apaga els clics.** Només decideix si s'habiliten els
  gestors de gestos; el `MapEventHandler`, que dispara `click` i `mousemove`, es
  registra sempre. Efecte secundari: el `canvas` passa a `tabindex="-1"` i surt de
  l'ordre de tabulació, de manera que els focus clicables necessitaran una llista
  paral·lela.
- **Els noms de GISCO** vénen en llengua de l'estat (`Cataluña`, `País Vasco`),
  amb un espai final a `Comunitat Valenciana ` i el desambiguador `Centro (PT)`.
  Parany: al nivell 2, `NAME_ENGL` i companyia porten el nom del país, no el de la
  regió.
- **El LAU de GISCO és un sol fitxer de 143 MB** per a tota Europa, sense altra
  escala ni despiece, i no porta codi NUTS: a Espanya el `GISCO_ID` conté el codi
  de l'INE i els dos primers dígits són la província, però a Portugal el codi és
  el del districte i caldrà la taula de correspondència o un creuament espacial.
- **El `localhost` a Windows.** Vite escolta per defecte només a `::1`, de manera
  que `127.0.0.1` rebutja la connexió.
- **El vigilant de fitxers d'`ng serve` es pot encallar** i continuar servint el
  *bundle* anterior amb un error de compilació antic. Si `ng build` compila i el
  navegador no ho reflecteix, reinicia el servidor abans de buscar-ho al codi.
- **Verificar sempre al navegador real.** Un error perseguit durant una estona
  resulta ser de l'entorn des del qual es revisa, no del codi.
- **FIRMS contesta els errors amb un 200 i en text pla**, una clau invàlida
  inclosa, de manera que el codi d'estat no prova res. El que es comprova és que
  la capçalera del CSV porti els noms de les columnes.
- **L'hora de FIRMS ve a part de la data i sense zero inicial**: `912` són les
  09:12, i sempre en UTC. Ajuntar data i hora un sol cop, en entrar, estalvia la
  feina a tot el que ve després.

---

## 5. Fonts de dades

| Font | Dada | Cobertura | Estat |
| --- | --- | --- | --- |
| Esri World Imagery | Imatgeria | Global | En ús |
| Mapzen Terrain Tiles | Elevació (Terrarium) | Global | En ús |
| Eurostat GISCO — NUTS 2024 | Regions i províncies | UE | En ús (nivells 2 i 3) |
| Eurostat GISCO — LAU 2024 | Municipis i freguesies | UE | En ús |
| NASA FIRMS (VIIRS 375 m) | Focus actius | Global | En ús (1 dia) |
| IDEIB — IV Inventari Forestal | Model de combustible | Balears | Investigada |
| MFE25 (MITECO) | Espècies i estructura | Espanya | Pendent |
| COS (DGT) | Ús i ocupació del sòl | Portugal | Pendent |
| AEMET OpenData | Meteorologia | Espanya | Pendent |
| IPMA | Meteorologia | Portugal | Pendent |

**FIRMS.** L'API d'àrea és `/api/area/csv/[MAP_KEY]/[FONT]/[o,s,e,n]/[DIES]`, amb
un màxim de cinc dies per consulta i 5.000 transaccions cada deu minuts per clau.
Les tres plataformes VIIRS donen 375 m, la millor resolució operativa.
Mesurat el 25/10/2026, un dia de deteccions a l'àmbit en dona 195, amb
potències d'entre 0,39 i 56,7 MW i una mediana de 2,1: a l'octubre el que crema són
majoritàriament rostolls, no bosc (§3.5).

**IDEIB.** Publica `MODCOMB` amb el model d'Anderson 13 ja assignat pels autors de
l'inventari, de manera que el simulador hereta una classificació oficial i no una
d'inventada. Es descarrega per pàgines amb `outSR=4326` i
`maxAllowableOffset=0.0001`, cosa que redueix cada polígon de 14 kB a 1,5 kB. La
península i Portugal no el porten assignat: caldrà reclassificar a partir de
l'espècie i l'estructura, i serà la part metodològicament més discutible.

---

## 6. Recursos de tercers i llicències

Comprovat el 29/10/2026. Les llicències del programari surten del `package.json`
instal·lat; les de les dades, de la pàgina de cada proveïdor. El que no diu la
font es marca **per confirmar** en lloc d'endevinar-ho.

| Recurs | Versió | Llicència |
| --- | --- | --- |
| Angular | 22.2.3 | MIT |
| MapLibre GL JS | 6.15.0 | BSD-3-Clause |
| RxJS | 7.8.2 | Apache-2.0 |
| tslib | 2.8.1 | 0BSD |
| TypeScript | 6.0.3 | Apache-2.0 |
| Fastify | 5.12.7 | MIT |
| pino | 10.4.0 | MIT |
| @types/geojson | 7946.0.16 | MIT |
| Material Symbols «mode_heat» | — | Apache-2.0 |

Les dades no tenen cap llicència amb nom, i això és una troballa:

| Font | Condicions | Atribució que demanen |
| --- | --- | --- |
| Eurostat GISCO (NUTS) | Gratuïta, ús no comercial, citant la font | Per confirmar (vegeu sota) |
| Esri World Imagery | Esri Master License Agreement | «Esri, Vantor, Earthstar Geographics, and the GIS User Community» |
| Mapzen / AWS Terrain Tiles | Cap llicència conjunta: cada font té la seva | Per font; a Europa, Copernicus EU-DEM |
| NASA FIRMS | Cap llicència amb nom; dades obertes | Text d'agraïment publicat (vegeu sota) |

**GISCO.** La nota de copyright «© EuroGeographics for the administrative
boundaries» i la clàusula explícita de no comercial són a la pàgina d'*unitats
administratives*, no a la de *NUTS*, que és d'on surten `regions.geojson` i
`provinces.geojson`. La pàgina de NUTS no publica cap condició pròpia i la que
hi enllaçava dona 404. Per a un TFG, que no és comercial i cita la font, no hi
ha problema; però com que el repositori redistribueix geometria derivada, la
via segura és afegir la nota d'EuroGeographics a l'atribució del mapa encara
que la pàgina de NUTS no l'exigeixi.

**El que diu el mapa.** Corregit el 29/10/2026 (pendent 3.13). L'atribució
d'Esri deia «Imatgeria © Esri, Vantor, Earthstar Geographics» i es menjava el
«and the GIS User Community» del crèdit publicat; la del relleu deia només
«Mapzen Terrain Tiles» quan el que les fonts demanen és esmentar Copernicus
EU-DEM i l'USGS; i la de GISCO no duia la nota d'EuroGeographics. Les tres
cadenes viuen ara a `map.config.ts`, cadascuna amb la seva citació al costat.

**FIRMS.** No hi ha llicència: NASA publica les dades obertament i demana
aquest agraïment, que haurà d'anar a la memòria —aquí sense les URL que
l'original hi intercala—: «We acknowledge the use of
data and/or imagery from NASA's Fire Information for Resource Management
System (FIRMS), part of NASA's Land, Atmosphere Near real-time Capability for
Earth observations (LANCE) and NASA's Earth Science Data and Information
System (ESDIS).»

---

## 7. Canvis de rumb

| Data | De | A | Motiu |
| --- | --- | --- | --- |
| 19/10/2026 | Prototips a `Codex/` i `Claude/` | Projecte nou a `Pere/Final` | Els prototips servien de referència, no de base |
| 19/10/2026 | React + Vite | Angular 22 zoneless | Comprensió: cal poder defensar el codi |
| 19/10/2026 | Monorepo amb espais de treball | `web/` i `api/` separats | Els espais de treball només gestionaven la meitat JavaScript |
| 19/10/2026 | Zoom lliure | Enquadraments fixos | El simulador necessita un domini acotat |
| 20/10/2026 | Jerarquia de quatre nivells com a porta al simulador | Focus actius a la portada i dos camins cap a la simulació | La primera pantalla ha de mostrar l'aportació del treball, no un arbre administratiu |
