# Fase 7 — Prova global final

**Qui**: Pere. **Depèn de**: 3, 4, 5 i 6. **Acaba quan**: tot el que hi ha a
sota està marcat. És la porta de la fase 8.

- [ ] El guió de la fase 2 passa sencer.
- [x] La suite automàtica és verda. **469 proves** el 24/11/2026; **473** el 25/11.
- [x] El linter és verd, a les dues meitats.
- [ ] Sonar no diu res nou. No s'ha tornat a llançar des de la §11.62.
- [ ] **El full de la revisió final**:
      [`revisio-final-e-full-per-a-la-fase-7.md`](revisio-final-e-full-per-a-la-fase-7.md).
      Catorze coses que existeixen a les proves i **que ningú no ha vist a la
      pantalla**: quatre estats del selector de dates, els botons de
      reintentar dels quatre passos, els estats de WebGL que les partícules es
      deixen, la geometria del 3D i dos casos del panell de combustible.

La primera cosa a jutjar d'aquell full: els avisos nous viuen **dins de
panells que s'obren clicant**. Si han de veure's des de fora, el botó de dalt
ho ha de dir, i això afegeix feina que ara mateix no està planificada.

## La passada del 25/11/2026

Feta per Claude amb Pere, al navegador de l'app (Claude in Chrome no
connectava). Portes en verd: 473 proves —336 de la web, 137 de l'API—, build,
`prettier` i lint a les dues meitats. Per fer fallar FIRMS no es va tocar ni
el codi ni el `.env`: un script fora del repositori, carregat amb
`node --import`, feia fallar les peticions a FIRMS segons un fitxer de
senyal. Les lectures de `/data/` del formulari es van fer fallar dins la
pàgina, sense reanomenar fitxers.

### Defectes

Amb les tres coses que demana el guió: com es reprodueix, què s'esperava i
què ha passat.

| #   | Com es reprodueix                                                                     | Què s'esperava                                                                   | Què ha passat                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | API sense `FIRMS_MAP_KEY`; obrir el selector de dates                                 | «falta la clau FIRMS» i cap botó de reintentar (full, 1.1)                       | El botó de dalt ho diu bé, però el panell diu «No s'han pogut llegir les deteccions» i ensenya «Tornar-ho a provar». `top-bar/range-picker.html:24-26` no mira `missingKey()`                                   |
| 2   | Simulador a mar obert, `/simulador/ES53/ES532/ES_07061/@2.25,40.0`; obrir COMBUSTIBLE | Un avís que digui que allà no hi ha dada i que reintentar no servirà (full, 4.1) | «INCOMPLET», 84,9 % sense dades, cap avís i un botó «Torna a carregar». L'API retorna `warnings: []`: l'avís de la §11.84 només surt si el ràster no cobreix la caixa, i aquí la cobreix però el mar no té dada |
| 3   | `/simulacio/ES53/ES532/ES_99999` (o amb una província inexistent pel mig)             | Com a la regió i la província: ««…» no és cap codi de municipi»                  | «Municipi desconegut» i la invitació a marcar el centre. A `simulation/centre-step.html` li falta l'avís                                                                                                        |
| 4   | Portada a 375 px d'amplada                                                            | Es pot arribar al selector de dates i a «Crear Simulació»                        | Queden fora de la pantalla (x 420–555 i 583–710) i la pàgina no es desplaça. Al simulador la capçalera queda retallada per la dreta. Falta confirmar-ho al telèfon de debò                                      |

### El que passa

- **Seient 1.** 15 deteccions sense tocar res; la llegenda quadra; els quatre
  presets escriuen el seu rang; Canàries 3 = API. La península en mostra
  2.899 de 4.131 perquè la caixa de FIRMS inclou el nord d'Àfrica i França
  (§2.31). El panell de detecció i el botó al simulador, bé.
- **Seient 2.** Els quatre nivells fins a Sóller; el `canvas` del mapa és el
  mateix a tots els passos. Cercador amb i sense accent, i un nom inexistent
  ho diu. Enllaç compartit i botó enrere fins a la portada.
- **Seient 3.** Ignicions (posar-ne tres, treure'n una); el foc va cap al SE
  amb vent del NO; 35,7 % de cel·les oficials a Sóller i 100 % estimat a
  Burgos, amb l'etiqueta; línia de temps; desar i carregar; «No hi arriba» i
  «T + 05:26» quan toca. Temps de càlcul: Sóller a 22 km/h ≈0,86 s; Burgos
  ≈0,25 s; **Sóller a 60 km/h amb dues contramesures ≈2,2–2,6 s**, per sobre
  del segon de la §11.36.
- **Seient 4.** Un escenari de la versió 99 es rebutja sencer; el de la 7 es
  carrega, avisa i ofereix desar-lo actualitzat. Domini de frontera amb
  Portugal: combustible complet a banda i banda.
- **Full, 1.1–1.4.** Sense resposta amb un reintentar que funciona de debò;
  dades velles amb «Llegides fa 10 min», que passa a «fa 11» en tornar a
  obrir; cobertura incompleta; i les dues alhora, amb dos avisos i un botó.
- **Full, 2.1.** Els quatre passos ensenyen el seu error i el botó el torna a
  llegir.
- **Full, 4.2.** A cavall de les vores de 0° i 42°, cap costura: la
  discontinuïtat a la vora (14,3 % i 6,7 %) és com la de les columnes i files
  veïnes (11,9 % i 7,8 %). Amb tessel·les senceres; el WorldCover retallat de
  la §11.81 no es va poder reproduir.
- **Full, §5.** a) 0–1427 m a Sóller, igual al formulari i al panell. b) «tot
  mar» als dos llocs. c) 7 m/h, NWCG 2021, l'enllaç és la taula; l'escenari de
  la versió 7 conserva els 40,2. d) El canvi de nom no ha trencat res.

Arreglats el mateix dia, tots quatre amb la seva prova (§11.87). Falta veure
el 4 al telèfon de debò.

### Per jutjar (no són defectes)

- **La primera cosa del full**: amb dades velles o una font caiguda, el botó
  de dalt només diu «28 deteccions». Des de fora no es veu res.
- La línia de defensa (eix de 2 px, torrat) i el disc d'un helicòpter (90 m)
  gairebé no es veuen a l'escala del domini. Comprovat a MapLibre: hi són.
- L'atribució tapa mig mapa del simulador entre 900 i 1.280 px.
- «Tornar-ho a provar» té dos estils: taronja i ple a la portada, gris i amb
  una vora quasi invisible al formulari (`.retry`).
- Una URL de la portada amb un rang invertit, futur o de més de 31 dies cau a
  «Avui» sense dir res, i la URL dolenta es queda a la barra.
- `/simulacio/ES99` diu «no és cap codi de regió» en lloc de caure a la
  portada com diu el guió: és millor que el guió.
- Menors: «Eivissa y Formentera» (nom oficial de NUTS), «Total: 1350 L» al
  costat de «1.350 L», l'Escape no tanca el menú de capes, i el botó del
  selector, els enllaços de les regions i tres lliscadors no tenen nom
  accessible.

### El que queda per a Pere

- El rang impossible teclejant a mà: els camps no es van deixar.
- §3.1 (estats de WebGL que deixen les partícules) i §3.2 (geometria de les
  figures 3D): a ull, apropant-se durant una descàrrega.
- Seient 4: sense xarxa, sense combustible preparat (no es va tocar
  `api/data`), el mòbil de debò i la finestra estreta al teu gust.
- Sonar.
