# Fase 5 — Estil

**Qui**: per carpetes, i mai el mateix fitxer que un altre.
**Depèn de**: 0, 0b i 4. **Acaba quan**: el linter és verd sense excepcions i
els fitxers segueixen el full d'estil ([`../estil.md`](../estil.md)).

Començada el 19/11/2026 per Claude, abans de la fase 4, perquè ho va demanar
Pere (§11.63). El linter ja és verd, però **encara no sense excepcions**: queden
les deu marques del trinquet i els dos fitxers exclosos de `member-ordering`.

## Regla 1 — L'ordre de dins de les classes

- [x] Ho comprova el linter (`member-ordering`): camps, constructor, mètodes
      públics i protegits, privats. Membres moguts a set fitxers; el que més,
      `map/map.service.ts`.
- [x] L'ordre dels camps, a mà: `map/map-view.ts`,
      `simulation/ignition-step.ts`, `simulation/search.service.ts`,
      `top-bar/range-picker.ts`, i dos que el recompte no tenia,
      `simulation/municipality-step.ts` i `simulation/province-step.ts`.
- [ ] **Partir `simulator/simulator-view.ts`** (2.169 línies) i
      **`simulator/countermeasure-plan.ts`**, i aplicar-los la regla després
      (decisió de la fase 0). Llavors es treu l'excepció d'`eslint.config.mjs`.

## Regla 2 — Cap membre sense dir qui el pot veure

- [x] A tot `web/` (`83b48b2`), i ho comprova el linter.

## Regla 3 — Els imports, tots seguits

- [x] 36 fitxers: 35 a `web/` i `api/src/app.ts`. No ho comprova cap regla:
      caldria `eslint-plugin-import-x`, que no s'ha afegit.

## Els comentaris

- [ ] Segons la decisió dels comentaris de la fase 0, encara oberta.

## Regla 4 — L'espagueti

Hi havia quinze funcions per sobre de 15.

- [x] Partides: `ignitionDistances()`, `spread()`, el constructor de
      `FuelTreatments`, i a `simulator-view.ts` les xifres del foc (`figures`)
      i el bucle de dibuix (`draw`).
- [ ] Al trinquet, que les llista
      `grep -rn "complexity -- pending" web/src`. El número és el del linter,
      que compta cada clausura per separat:
  - [ ] `simulation/fire-spread.ts` · `spreadRun()` (160)
  - [ ] `simulation/fire-spread.ts` · `ellipse` (20) i `windyTravel` (19), de
        dins de `spreadRun()`: es parteixen amb ell
  - [ ] `simulation/fire-spread.ts` · `measure()` (29)
  - [ ] `simulation/fuel-treatments.ts` · `at()` (31), que es crida a cada
        cel·la i pas
  - [ ] `simulation/countermeasures.ts` · `parseCountermeasures()` (88)
  - [ ] `simulation/countermeasures.ts` · `compileCountermeasures()` (34)
  - [ ] `simulation/scenario.ts` · `readScenario()` (42)
  - [ ] `simulation/fuel-data.ts` · `decodeFuels()` (29)
  - [ ] `simulator/countermeasure-plan.ts` · la llista de `rows` (40), quan es
        parteixi el component

**Avís**: `spreadRun()` és el bucle que recorre 1.024² cel·les, i partir-lo es
paga en temps. La §11.36 demana que el càlcul vagi per sota del segon. Aquest,
`ellipse`, `windyTravel`, `measure()` i `FuelTreatments.at()` es parteixen
mesurant abans i després. Si costa massa, es deixen sencers i s'explica per
què.

## Els `any`

- [x] Els 20, que eren tots a les proves: tipats. El de la GPU ja va trobar
      que `createProgram()` pot tornar `null` encara que el tipus del DOM digui
      que no (§11.63).
