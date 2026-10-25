# Bitàcola tècnica — IgnisLab

Registre de **decisions preses**: què s'ha decidit i per quins motius. Material
de base per a la memòria del TFG.

Darrera actualització: 25 d'octubre de 2026.

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
  —amb què treballa l'ICNF— no hi surten.
- **3.5. Cremes agrícoles i incendis.** Com no presentar una detecció de 0,5 MW
  com si fos un incendi forestal: llindar de FRP, etiqueta per potència, o totes
  dues. Les dades del 25/10/2026 diuen que no és un cas de vora: de 195
  deteccions, 147 queden per sota dels 5 MW i la mediana és de 2,1 MW, amb un
  màxim de 56,7. Tres quartes parts del que avui mostra la portada són rostolls.
- **3.6. Terreny 3D a la vista de simulació.** Activable i no obligatori, perquè
  drapejar el `CustomLayer` sobre una malla de terreny és més feina que pintar-lo
  sobre un pla.
- **3.7. Què és «un focus» en clicar.** Un episodi real dona centenars de
  deteccions de 375 m solapades i FIRMS no les agrupa en incendis.
- **3.8. Pressupost de *bundle*.** MapLibre sol ja passa del límit per defecte
  d'Angular (1,29 MB en cru, 300 kB per la xarxa) i `ng build` falla per això.
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
  - Etiquetar i no descartar: una propietat `region` a cada detecció i un
    `filter: ['has', 'region']` a la capa. Tornar a mostrar-les és una línia,
    es pot dir quantes se'n descarten, i el nom de la regió és justament el que
    la barra lateral haurà d'escriure (§2.9).
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
| Eurostat GISCO — NUTS 2024 | Regions i províncies | UE | En ús (nivell 2) |
| Eurostat GISCO — LAU 2024 | Municipis | UE | Pendent |
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

## 6. Canvis de rumb

| Data | De | A | Motiu |
| --- | --- | --- | --- |
| 19/10/2026 | Prototips a `Codex/` i `Claude/` | Projecte nou a `Pere/Final` | Els prototips servien de referència, no de base |
| 19/10/2026 | React + Vite | Angular 22 zoneless | Comprensió: cal poder defensar el codi |
| 19/10/2026 | Monorepo amb espais de treball | `web/` i `api/` separats | Els espais de treball només gestionaven la meitat JavaScript |
| 19/10/2026 | Zoom lliure | Enquadraments fixos | El simulador necessita un domini acotat |
| 20/10/2026 | Jerarquia de quatre nivells com a porta al simulador | Focus actius a la portada i dos camins cap a la simulació | La primera pantalla ha de mostrar l'aportació del treball, no un arbre administratiu |
