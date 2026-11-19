# 4. Troballes tècniques

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
- **Amagar una capa no és el mateix que descarregar-la.** El servei de municipis
  es guarda de carregar dues vegades la mateixa província amb un camp `asked`;
  treure-li la capa de la pantalla sense dir-li-ho feia que tornar a baixar a una
  província ja vista no dibuixés res, perquè `load()` sortia per la porta del
  darrere. Per això el nivell l'allibera (`release()`) en lloc d'amagar-la. El
  mètode ja existia i no el cridava ningú des que es va escriure.
- **`prettier --check` suspèn tot un projecte de Windows sense que hi hagi res
  mal format.** Git guarda LF a l'índex i `core.autocrlf` torna CRLF en treure
  els fitxers, mentre que Prettier demana LF per defecte: dels 46 fitxers que
  suspenien, 29 només tenien el final de línia «equivocat». La parella es torna
  a lligar amb un `.gitattributes` amb `* text=auto eol=lf`, que mana per sobre
  d'`autocrlf` i no canvia res del que es commiteja. Sense això la comprovació
  no distingeix un fitxer descuidat d'un fitxer acabat de treure del repositori.
  Parany que ve de regal: en posar-lo, els fitxers que només havien canviat de
  final de línia queden marcats com a modificats amb un `git diff` buit.
  `git add --renormalize` els torna a lloc i no prepara res per al commit,
  perquè el contingut normalitzat ja era el mateix.
- **El text de l'atribució de MapLibre era negre sobre el panell fosc.** La
  regla del projecte deia `color: var(--muted)` i no s'aplicava mai:
  `.maplibregl-ctrl-attrib.maplibregl-compact` porta `color:#000` amb dues
  classes i en guanya una de sola. Només els enllaços agafaven el color donat,
  perquè MapLibre els estilitza també amb una classe. El `!important` que ja hi
  havia al fons n'era el símptoma. Es contesta igualant les classes, no pujant
  la prioritat. El botó que desplega els crèdits es queda amb fons clar a
  propòsit: la seva «i» és un traç negre dins d'una imatge de fons, i un botó
  fosc és un cercle buit.
- **MapLibre posa `font: 12px/20px Helvetica Neue…` al contenidor del mapa**, de
  manera que tot el que dibuixa sobre el llenç —l'escala, els crèdits, un
  globus— parla amb una altra lletra que l'aplicació del voltant. Se sobreescriu
  només la família, i cada control es queda amb la mida que tenia.
- **`maplibre-contour` arrenca un *worker* en importar-se.** `contours.ts`
  construïa el `DemSource` a nivell de mòdul, de manera que qualsevol fitxer que
  acabés important `map.style.ts` necessitava un navegador: el dia que la
  barra superior va passar a dependre de `MapService`, el test de `App` va
  petar amb `Worker is not defined` sense que ningú hagués tocat cap test. Es
  construeix al primer ús, que segueix sent abans que MapLibre vegi l'estil,
  que és l'ordre que importa.
- **El `--write` de Prettier arriba al GeoJSON.** Reconeix l'extensió i
  reescriuria els 83 fitxers de `public/data`, que es publiquen minificats a
  propòsit: el que es baixa el navegador es multiplicaria per no guanyar res,
  perquè ningú els llegeix a mà. Van al `.prettierignore` el mateix dia que
  s'afegeix l'ordre `npm run format`, no després.
