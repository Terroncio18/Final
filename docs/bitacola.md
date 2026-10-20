# Bitàcola tècnica — IgnisLab

Registre de **decisions preses**: què s'ha decidit i per quins motius. Material
de base per a la memòria del TFG.

Darrera actualització: 20 d'octubre de 2026.

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

---

## 3. Decisions pendents

- **3.1. Llenguatge del backend.** L'API és igual de senzilla en qualsevol; la
  diferència real és el preprocessament de cartografia, on Python té `rasterio` i
  `geopandas`. Ho desbloqueja que el preprocessament és feina per lots i pot ser
  un script de Python encara que l'API no ho sigui.
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
  dues.
- **3.6. Terreny 3D a la vista de simulació.** Activable i no obligatori, perquè
  drapejar el `CustomLayer` sobre una malla de terreny és més feina que pintar-lo
  sobre un pla.
- **3.7. Què és «un focus» en clicar.** Un episodi real dona centenars de
  deteccions de 375 m solapades i FIRMS no les agrupa en incendis.
- **3.8. Pressupost de *bundle*.** MapLibre sol ja passa del límit per defecte
  d'Angular (1,29 MB en cru, 300 kB per la xarxa) i `ng build` falla per això.

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

---

## 5. Fonts de dades

| Font | Dada | Cobertura | Estat |
| --- | --- | --- | --- |
| Esri World Imagery | Imatgeria | Global | En ús |
| Mapzen Terrain Tiles | Elevació (Terrarium) | Global | En ús |
| Eurostat GISCO — NUTS 2024 | Regions i províncies | UE | En ús (nivell 2) |
| Eurostat GISCO — LAU 2024 | Municipis | UE | Pendent |
| NASA FIRMS (VIIRS 375 m) | Focus actius | Global | Investigada |
| IDEIB — IV Inventari Forestal | Model de combustible | Balears | Investigada |
| MFE25 (MITECO) | Espècies i estructura | Espanya | Pendent |
| COS (DGT) | Ús i ocupació del sòl | Portugal | Pendent |
| AEMET OpenData | Meteorologia | Espanya | Pendent |
| IPMA | Meteorologia | Portugal | Pendent |

**FIRMS.** L'API d'àrea és `/api/area/csv/[MAP_KEY]/[FONT]/[o,s,e,n]/[DIES]`, amb
un màxim de cinc dies per consulta i 5.000 transaccions cada deu minuts per clau.
Les tres plataformes VIIRS donen 375 m, la millor resolució operativa. A l'octubre
les deteccions peninsulars tenen potències de 0,4 a 19 MW: crema agrícola, no
incendi forestal.

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
