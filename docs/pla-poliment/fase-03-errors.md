# Fase 3 — Errors

**Qui**: es pot partir si les llistes no es creuen. **Depèn de**: 1 i 2.
**Acaba quan**: tot el que trenca està arreglat i amb la seva prova, i el que
només molesta està arreglat o escrit com a pendent amb el motiu.

- [x] Ordenar el que diguin les fases 1 i 2 per si trenca o només molesta.
- [x] Arreglar-ho, cada arreglament amb la seva prova.

Les cinc d'accessibilitat del linter que s'hi esperaven van resultar falsos
positius (§11.63): no hi ha cap entrada segura per endavant.

## Els quatre del guió de la fase 2

Ordenats de pitjor a millor (trenca abans que només molesta):

1. **Combustible estimat sense avís — trenca.** `/api/fuels` queia a
   estimació a tot arreu sense cap avís (`warnings` buit) quan no hi havia
   cap conjunt oficial de combustible. Arreglat a `api/src/fuels.ts`:
   `datasets()` ara fa `push` d'un avís en ENOENT. Prova a
   `api/tests/fuels-build.test.ts`.
2. **Punt que cau a un altre país i la columna no s'actualitza — trenca.**
   Al pas 3 del formulari, un punt que queia a Portugal deixava la columna
   dreta amb el municipi espanyol vell. Arreglat a
   `web/src/app/simulation/ignition-step.ts`: ara resol la regió real amb
   `PointLocator` quan el punt surt del municipi carregat, en lloc de
   conservar sempre l'adreça anterior. De pas arregla també el cas —no
   demanat explícitament— d'un punt que cau a una altra província del mateix
   país. Prova a `web/src/app/form-components.spec.ts`.
3. **Clau FIRMS absent sense explicar-ho — trenca.** `/api/hotspots`
   responia 502 genèric igual si faltava la clau que si FIRMS queia, sense
   cap senyal per distingir els dos casos. Ara respon 503 amb
   `reason: 'missing-key'` quan `FIRMS_MAP_KEY` no hi és (`api/src/app.ts`),
   i la web ho distingeix mostrant «falta la clau FIRMS» en lloc de «sense
   resposta» (`web/src/app/map/hotspots.service.ts`,
   `web/src/app/top-bar/range-picker.ts`, `web/src/app/top-bar/range-picker.html`).
   Proves a `api/tests/routes.test.ts` i `web/src/app/map/data-services.spec.ts`.
4. **Finestra estreta trenca les tres columnes del simulador — només
   molesta** (no dona dada falsa, només és incòmode). Ara
   `web/src/app/simulator/simulator-view.ts` detecta la finestra estreta
   (`matchMedia`, en viu) i `simulator-view.html`/`simulator-view.css`
   mostren un avís i apilen les tres columnes en una sota 860px. Prova a
   `web/src/app/simulator/simulator-view.spec.ts`.

No queda cap dels quatre pendent. Fitxers tocats — codi: `api/src/app.ts`,
`api/src/fuels.ts`, `web/src/app/map/hotspots.service.ts`,
`web/src/app/top-bar/range-picker.ts`, `web/src/app/top-bar/range-picker.html`,
`web/src/app/simulation/ignition-step.ts`,
`web/src/app/simulator/simulator-view.ts`,
`web/src/app/simulator/simulator-view.html`,
`web/src/app/simulator/simulator-view.css`; proves:
`api/tests/routes.test.ts`, `api/tests/fuels-build.test.ts`,
`web/src/app/map/data-services.spec.ts`, `web/src/app/form-components.spec.ts`,
`web/src/app/simulator/simulator-view.spec.ts`. Verificat en verd: `cd web &&
npm test && npm run build && npx prettier --check . && npm run lint` (155+129
proves) i `cd api && npm test` (72 proves).
