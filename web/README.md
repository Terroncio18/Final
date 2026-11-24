# IgnisLab — web

L'aplicació: **Angular 22** _zoneless_, amb senyals, i el model de foc a dins.
Dibuixa el mapa amb **MapLibre GL** i el relleu i els agents amb **three.js**
sobre WebGL2.

Per a **instal·lar el projecte sencer des de zero** —Node, les claus, les dues
meitats— mira el [`README.md` de l'arrel](../README.md). Aquest fitxer només
explica aquesta meitat, suposant que ja hi ha `node_modules`.

## Ordres

Totes es llancen des d'aquesta carpeta.

| Ordre                     | Què fa                                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| `npm start`               | Servidor de desenvolupament a http://localhost:4200, amb recàrrega       |
| `npm test`                | **Les dues** bateries de proves: primer el model, després els components |
| `npm run test:simulation` | Només el model: `vitest run src/app/simulation`                          |
| `npm run build`           | Compila a `dist/`                                                        |
| `npm run lint`            | ESLint                                                                   |
| `npm run format:check`    | Prettier, sense tocar res                                                |
| `npm run test:coverage`   | Cobertura de les dues bateries, amb l'lcov a punt per a Sonar            |

No hi ha `ng e2e`: les proves d'interfície es fan al navegador, a mà.

## Cal l'API engegada

El servidor de desenvolupament redirigeix tot el que comenci per `/api` cap a
`http://127.0.0.1:3000`, que és l'altra meitat. Això és a
[`proxy.config.json`](proxy.config.json). Sense l'API no hi ha deteccions de
focs actius ni meteorologia en directe; la resta del simulador funciona, i la
pantalla diu què falta.

Hi ha un segon proxy, [`proxy.fuels.config.json`](proxy.fuels.config.json),
que apunta al port 3001, per a quan es té una segona API engegada amb les
dades de combustible preparades.

## Què hi ha a dins

```
src/app/
  simulation/    El model de foc i els passos del formulari
  map/           El mapa: MapLibre, les capes de three.js i els serveis de dades
  simulator/     La consola: els panells de configuració, eines i anàlisi
  top-bar/       La barra de dalt i el selector de dates de les deteccions
  hotspot-panel/ La fitxa d'una detecció
```

- **`simulation/`** és el cor: [`rothermel.ts`](src/app/simulation/rothermel.ts)
  amb el model de propagació, [`fire-spread.ts`](src/app/simulation/fire-spread.ts),
  les brases, les contramesures, el combustible i el terreny. Hi viuen també
  els quatre passos amb què es tria la zona —regió, província, municipi,
  ignició—. Les proves són al costat de cada fitxer.
- **`map/`** té els serveis que parlen amb l'API —deteccions, llocs— i les
  capes pròpies de MapLibre que dibuixen el foc, els agents i les
  contramesures.
- **`simulator/`** és tot el que l'usuari toca mentre simula.

Les **dades administratives** són a `public/data/`: regions, províncies, els
81 fitxers de municipis, els 81 de topònims i l'índex de cerca —165 fitxers,
uns 21 MB—. Hi són al
repositori i no cal generar-les. Si mai s'han de refer, són les ordres
`npm run data:*` del `package.json`, i cada una es baixa d'una font pública.

## Les proves van en dues bateries

No és caprici: la del model corre en entorn **node**, que és més ràpid i no
necessita navegador, i la dels components en **jsdom** a través de l'Angular
CLI.

```powershell
npm test
```

Si una prova de `src/app/simulation/` necessita coses del navegador —el DOM,
`localStorage`, `requestAnimationFrame`—, se li posa la directiva a la primera
línia del fitxer:

```ts
// @vitest-environment jsdom
```

Sense ella la prova petarà amb un `ReferenceError` que no diu això.

## Com s'escriu aquí

- **Zoneless i senyals.** Res de `zone.js`: l'estat és `signal`, el que se'n
  deriva és `computed`, i l'`effect` que registra alguna cosa al navegador la
  desfà amb `onCleanup`.
  Les entrades dels components són `input.required` quan són obligatòries.
- **Les dotze regles d'estil** són a [`docs/estil.md`](../docs/estil.md):
  l'anglès al codi i als comentaris, el català a la pantalla, `async`/`await`
  en lloc de cadenes de `.then()`, cap `void` pelat, i com s'abandona una
  petició que ja no interessa.
- **El motiu de qualsevol decisió** és a la bitàcola:
  [`docs/bitacola/README.md`](../docs/bitacola/README.md). Val més mirar-hi
  abans de proposar un canvi; gairebé tot ja s'hi ha discutit.
- La pantalla no explica: les explicacions van a la bitàcola i al manual
  d'usuari.
