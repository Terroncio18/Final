# Pla de poliment

Demanat per Pere el 19/11/2026, abans del manual d'usuari: deixar l'aplicació
acabada —provada, sense codi mort, amb un estil únic i llegible, optimitzada,
documentada i publicada—. **Es fa en diverses sessions**, de manera que aquest
fitxer és la memòria del pla: què toca, qui el té i on s'ha quedat.

La xarxa de seguretat ja hi és: 97,9 % de cobertura i 0 avisos de Sonar
(§11.62). Esborrar i refer coses té avui un cost que fa un mes no tenia.

## Com es comença una sessió

1. Llegir aquest fitxer sencer, que és curt, i mirar la taula d'estat.
2. Triar **una** fase que tingui les seves dependències fetes, escriure el nom
   de qui l'agafa a la taula, i no agafar-ne dues.
3. Treballar només als fitxers de la fase. Si cal tocar-ne un de fora, dir-ho
   a la taula abans.
4. Acabar en verd: proves, compilació, `prettier --check` i, des d'avui, el
   linter. Commit. I **actualitzar la taula d'estat abans de plegar**, encara
   que la fase quedi a mitges: on s'ha arribat i què queda.

### Les regles de treballar-hi dos alhora

1. **Dos no toquen mai el mateix fitxer al mateix temps.** El repartiment és
   per carpetes: `web/src/app/{map,simulator,top-bar,hotspot-panel}` d'una
   banda, `web/src/app/simulation` i `api/` de l'altra.
2. **Qui acaba, commiteja i avisa.** La feina de Codex del 19/11 es va quedar
   sense desar i va caldre rescatar-la (§11.62).
3. **El que es decideixi, a la bitàcola**: fitxer nou a `fase-2/` i una línia
   a l'índex. Les regles d'estil, a [`estil.md`](estil.md).

## Estat

| # | Fase | Depèn de | Estat | Qui |
| --- | --- | --- | --- | --- |
| 0 | El full d'estil | — | **A mitges**: 4 regles escrites, 5 decisions obertes | Claude |
| 0b | El linter | 0 | **A mitges**: muntat a `web/`, falta `api/` i els guions | Claude |
| 1 | Inventari | — | Per començar | — |
| 2 | Provar l'aplicació sencera | — | Per començar (guió per escriure amb Pere) | — |
| 3 | Errors | 1, 2 | Per començar | — |
| 4 | Codi mort | 1 | Per començar | — |
| 5 | Estil | 0, 0b, 4 | Per començar (1 fitxer de 37 fet, com a mostra) | — |
| 6 | Optimitzacions | 1, 2 | Per començar | — |
| 7 | Prova global final | 3, 4, 5, 6 | Per començar | — |
| 8 | Manuals i README | 7 | Per començar | — |
| 9 | Publicar | 8 + decisió | **Bloquejada per una decisió** | — |
| 10 | Sonar i tancament | 9 | Per començar | — |

**Les independents de debò són la 1 i la 2**: es poden fer avui, alhora, i les
dues només llegeixen. La 0 i la 0b també són independents de tot.

---

## Fase 0 — El full d'estil

**Qui**: un de sol, perquè és un document. **Depèn de**: res.
**Acaba quan**: les cinc decisions obertes estan escrites com a regla.

Fet: [`estil.md`](estil.md) amb quatre regles —l'ordre de dins d'una classe,
cap membre sense `private`/`protected`/`public`, els imports en un bloc, i res
de codi espagueti amb el llindar de 15—, cadascuna amb la mesura de com està
el projecte avui.

Queda **decidir** (són a «Per decidir» del mateix document):

1. **Com es diu «aquesta resposta ja no la vull»**: comptador, clau del que
   s'ha demanat, o `AbortController`. Avui n'hi ha tres maneres.
2. **Cadena de promeses o `async`/`await`**.
3. **Com es diu «això no l'espero»**: `void` o un ajudant que enganxi el
   `catch`.
4. **Els comentaris.** Pere vol codi sense comentaris. S'ha fet la prova a
   `map/hotspots.service.ts`, que ha passat de 182 a 117 línies sense perdre
   res que no sigui a la bitàcola —es perd el punter, no el coneixement—. Cal
   decidir si es fa a tot el repositori; si es fa, **la portada de la fase 1
   s'ha d'esmenar**, perquè diu que el codi cita els números de les decisions
   als comentaris.
5. **Els `simulator-view.ts` i `countermeasure-plan.ts`**, que agrupen l'estat
   per tema i no per tipus: s'hi aplica la regla 1 igualment, val per blocs, o
   el que cal és partir el component.

## Fase 0b — El linter

**Qui**: un de sol. **Depèn de**: 0. **Acaba quan**: `npm run lint` existeix a
les dues meitats, és verd, i la 12.28 està tancada a la bitàcola.

Fet a `web/`: ESLint 10 amb `eslint.config.mjs` —regles recomanades de
TypeScript i d'Angular, accessibilitat de plantilles, i les dues regles
nostres: `explicit-member-accessibility` i `complexity: 15`, més
`no-floating-promises`—. La primera passada va donar 278 problemes; 233 eren
membres sense modificador i ja estan posats, amb les proves i la compilació en
verd (`83b48b2`).

Queda:

1. **El mateix a `api/`**: instal·lar, configurar sense la part d'Angular, i
   arreglar el que surti.
2. **`npm run lint`** a les dues meitats, i afegir-lo a `CLAUDE.md` i a la
   llista d'ordres de cada fase.
3. **Els 40 avisos que queden a `web/`**, que no són soroll:
   - 20 `no-explicit-any`;
   - 15 `complexity`, que són la fase 5;
   - 3 `no-unused-vars`, que són **codi mort de debò** i van a la fase 4;
   - 5 d'accessibilitat a plantilles —elements amb `click` que no es poden
     enfocar ni fer servir amb el teclat—, que van a la fase 3;
   - 1 expressió sense efecte.
4. **Tancar la 12.28** amb una secció que digui què vigila el linter i què no.

## Fase 1 — Inventari

**Qui**: es pot partir en dos, `web/` i `api/`. **Depèn de**: res.
**Acaba quan**: hi ha dues llistes a `docs/`, ordenades per gravetat, cada
entrada amb fitxer i línia.

Només llegir. Què s'hi busca:

1. **Codi mort**: fitxers que ningú importa, exports que ningú fa servir,
   branques impossibles, `TODO` vells. Els 3 `no-unused-vars` del linter són
   el començament, no el final: el linter no veu un fitxer sencer que ningú
   importa.
2. **La 12.15**: `fire-field.ts` i `fire-appearance.ts` tenen proves i no els
   fa servir ningú. Decidir si es treuen o es queden com a alternativa sense
   WebGL2.
3. **Duplicació**: el mateix càlcul escrit dues vegades, el mateix patró
   resolt de tres maneres (com el de la decisió 1 de la fase 0).
4. **Noms que menteixen** i funcions que fan dues coses.
5. **Dependències**: les que no es fan servir, i les que pesen al paquet.
6. **On es va el temps i els bytes**: el paquet inicial és d'1,5 MB,
   `web/public/data` són 25 MB que es publiquen tal qual.

## Fase 2 — Provar l'aplicació sencera

**Qui**: Pere al navegador; el guió s'escriu amb ell abans.
**Depèn de**: res. **Acaba quan**: hi ha una llista de defectes, cadascun amb
com reproduir-lo i què s'esperava.

El guió ha de cobrir, com a mínim:

1. **La portada**: focus actius, la llegenda, triar dates i presets, el
   comptador per territori, obrir una detecció i el botó que porta al
   simulador.
2. **El formulari**: els quatre nivells, el cercador, l'enllaç compartit, el
   botó enrere.
3. **El simulador**: posar ignicions, el vent, el combustible —oficial i
   estimat—, les contramesures, les brigades, els mitjans aeris, la vista 3D,
   desar i carregar un escenari.
4. **Els casos lletjos**: sense clau de FIRMS, sense dades de combustible
   preparades, sense xarxa, FIRMS caigut, una detecció al mar, un domini a la
   frontera, un escenari antic, la finestra estreta i el mòbil.

## Fase 3 — Errors

**Qui**: es pot partir si les llistes no es creuen. **Depèn de**: 1 i 2.
**Acaba quan**: tot el que trenca està arreglat i amb la seva prova, i el que
només molesta està arreglat o escrit com a pendent amb el motiu.

Ja hi ha cinc entrades segures, les d'accessibilitat del linter.

## Fase 4 — Codi mort

**Qui**: per carpetes. **Depèn de**: 1. **Va abans de la 5**: no es poleix el
que s'ha de treure. **Acaba quan**: no queda res de la llista de la fase 1 i
les proves segueixen verdes.

El que es tregui s'escriu a la bitàcola: a la memòria hi ha d'anar **el que es
va provar i no es va quedar**, que és la part que explica les decisions.

## Fase 5 — Estil

**Qui**: per carpetes, i mai el mateix fitxer que un altre.
**Depèn de**: 0, 0b i 4. **Acaba quan**: el linter és verd sense excepcions i
els fitxers segueixen el full d'estil.

1. **L'ordre de dins de les classes**: queden sis de 37 —`map/map-view.ts`,
   `simulation/ignition-step.ts`, `simulation/search.service.ts`,
   `top-bar/range-picker.ts`, i els dos grans, segons què es decideixi—.
2. **Els imports**: 37 fitxers de 101 tenen línies en blanc al mig del bloc.
3. **Els comentaris**, segons la decisió 4 de la fase 0.
4. **L'espagueti**, que són quinze funcions i quatre de grosses:

   | Funció | Complexitat | Línies |
   | --- | --- | --- |
   | `simulation/fire-spread.ts` · `spreadRun()` | ~185 | 483 |
   | `simulation/countermeasures.ts` · `finite()` | ~91 | 153 |
   | `simulator/simulator-view.ts` · `constructor()` | ~84 | 443 |
   | `simulation/scenario.ts` · `readScenario()` | ~52 | 123 |

   **Avís**: `spreadRun()` és el bucle que recorre 1.024² cel·les i partir-lo
   es paga en temps. La §11.36 demana que el càlcul vagi per sota del segon:
   es parteix mesurant abans i després, i si costa massa es deixa sencer i
   s'explica per què.
5. **Els 20 `no-explicit-any`**, un per un: alguns són frontera de debò
   —GeoJSON, respostes de fora— i volen un tipus a l'entrada, no un `any`
   escampat.

## Fase 6 — Optimitzacions

**Qui**: per carpetes, si no toca el que toca la 5. **Depèn de**: 1 i 2.
**Acaba quan**: cada canvi té el número d'abans i el de després.

Candidats que ja es veuen: el paquet inicial d'1,5 MB, els 25 MB de
`web/public/data` publicats tal qual, i la política de neteja del cau de
combustible de l'API, que no s'ha mesurat mai amb el disc ple.

## Fase 7 — Prova global final

**Qui**: Pere. **Depèn de**: 3, 4, 5 i 6. **Acaba quan**: el guió de la fase 2
passa sencer, la suite automàtica és verda, el linter també, i Sonar no diu
res nou.

## Fase 8 — Manuals i README

**Qui**: es pot partir, un manual cadascú. **Depèn de**: 7 per a les captures;
els esborranys es poden començar abans. **Acaba quan**: els tres documents són
al repositori i la 12.18 està tancada.

1. **Manual d'usuari** (12.18): què fa cada secció i cada eina, les hipòtesis
   del model —combustible estimat, foc de superfície, retenció i assecat de
   les descàrregues, brases experimentals— i que **el simulador no serveix per
   a prendre decisions d'emergència**. És el que la pantalla no diu (§11.34).
2. **Manual d'instal·lació**: claus d'AEMET i FIRMS, les dades preparades de
   combustible —21 MB que no són al repositori—, les ordres de les dues
   meitats, i què cal per a publicar-ho.
3. **README**: un a l'arrel —avui no n'hi ha cap—, i un per meitat si cal.

## Fase 9 — Publicar

**Qui**: un de sol. **Depèn de**: 8 i **d'una decisió que cal prendre abans**.

A Vercel hi va bé el `web/`, que és estàtic. **L'API no hi encaixa tal com
és**: és un Fastify que viu, i a Vercel seria una funció que neix i mor a cada
petició. Perdria els tres caus en memòria —deteccions, taula de
disponibilitat, observacions—, el cau en disc del combustible
(`api/data/cache`) i el comptador que limita a dues preparacions alhora. A
més, els 21 MB de dades preparades no són al repositori.

Les tres sortides:

- **El web a Vercel i l'API en un servidor que viu** (Render, Fly, Railway,
  una màquina). És el que menys toca el codi: només canvia d'on penja `/api`.
- **Tot a Vercel**, amb l'API com a funcions: cal decidir on viuen les dades i
  què es fa amb els caus. Toca codi, i la memòria ho ha d'explicar.
- **Només el web**, amb les dades congelades per a la demostració. Barat, però
  deixa de ser una aplicació que respon.

Sigui quina sigui: les claus no es publiquen, i el CORS i l'origen de `/api`
s'han de refer.

## Fase 10 — Sonar i tancament

L'últim escàner, el panell per a la memòria, i una etiqueta a la versió que es
defensa.
