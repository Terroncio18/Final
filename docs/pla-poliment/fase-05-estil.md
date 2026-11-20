# Fase 5 — Estil

**Qui**: per carpetes, i mai el mateix fitxer que un altre.
**Depèn de**: 0, 0b i 4. **Acaba quan**: el linter és verd sense excepcions i
els fitxers segueixen el full d'estil ([`../estil.md`](../estil.md)).

Començada el 19/11/2026 per Claude, abans de la fase 4, perquè ho va demanar
Pere (§11.63). El linter ja és verd, però **encara no sense excepcions**: les
deu marques del trinquet de la regla 4 ja no hi són, però queda l'excepció de
`member-ordering` a `eslint.config.mjs` per a `simulator-view.ts` (vegeu regla
1), i la decisió dels comentaris de la fase 0, encara oberta.

## Regla 1 — L'ordre de dins de les classes

- [x] Ho comprova el linter (`member-ordering`): camps, constructor, mètodes
      públics i protegits, privats. Membres moguts a set fitxers; el que més,
      `map/map.service.ts`.
- [x] L'ordre dels camps, a mà: `map/map-view.ts`,
      `simulation/ignition-step.ts`, `simulation/search.service.ts`,
      `top-bar/range-picker.ts`, i dos que el recompte no tenia,
      `simulation/municipality-step.ts` i `simulation/province-step.ts`.
- [x] **`simulator/simulator-view.ts` partit en 4 etapes** (cea33ec,
      4209448, 8199ece, 43bcc10): el modal d'ajustos (`app-tool-settings`), el
      panell d'anàlisi (`app-analysis-panel`), el menú de capes
      (`app-layer-menu`) i el panell de configuració, partit alhora en sis
      components (`app-domain-panel`, `app-weather-panel`, `app-fuel-panel`,
      `app-scenario-panel`, `app-ignition-panel`, `app-countermeasure-panel`).
      `simulator-view.ts` ha passat de 2.219 a 1.749 línies (139 a 116
      membres) i `simulator-view.html` de 1.418 a 434. Decisions preses pel
      camí, a §11.69: full CSS propi per component (amb `config-section.css`
      compartit només per l'aspecte comú de les seccions «fold»),
      `figures`/`conditions` calculades a `simulator-view.ts` i passades per
      `input()`, i el panell d'escenaris només de vista.
- [x] **`simulator/countermeasure-plan.ts`**: la complexitat de `rows()` no
      depenia del split del component —era una suposició, no una
      dependència—, i s'ha resolt sola extraient `countermeasure-rows.ts`
      (§11.68), abans de tocar `simulator-view.ts`.
- [ ] **Treure l'excepció de `member-ordering` a `eslint.config.mjs` per a
      `simulator-view.ts`**: amb els dos fitxers partits, activar-la ara dona
      34 errors (els grups de meteo, d'edició de contramesures i de l'estat
      del motor de simulació, que el component encara manté perquè els
      llegeixen diverses parts de la pantalla, no es poden ordenar per tipus
      sense escampar-se). Caldria repensar com es guarda l'estat de
      meteorologia abans de poder-la treure de debò. Pendent per a una altra
      sessió.

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
- [x] **Les deu del trinquet, totes resoltes** (`grep -rn "complexity --
      pending" web/src` ja no en troba cap):
  - [x] `simulation/fire-spread.ts` · `spreadRun()` (160) — dd52f6a
  - [x] `simulation/fire-spread.ts` · `ellipse` (20) i `windyTravel` (19), de
        dins de `spreadRun()`: partides amb ell — dd52f6a
  - [x] `simulation/fire-spread.ts` · `measure()` (29) — dd52f6a
  - [x] `simulation/fuel-treatments.ts` · `at()` (31), que es crida a cada
        cel·la i pas — dd52f6a
  - [x] `simulation/countermeasures.ts` · `parseCountermeasures()` (88) —
        2e9ba3c
  - [x] `simulation/countermeasures.ts` · `compileCountermeasures()` (34) —
        2e9ba3c
  - [x] `simulation/scenario.ts` · `readScenario()` (42) — f43d121
  - [x] `simulation/fuel-data.ts` · `decodeFuels()` (29) — 7c2647c
  - [x] `simulator/countermeasure-plan.ts` · la llista de `rows` (40): no
        necessitava esperar el split del component, com deia aquesta mateixa
        marca; resolta sola extraient `describeMeasure`/`countermeasure-rows.ts`
        — 7258428 (§11.68)

**El benchmark de `spreadRun`, `ellipse`, `windyTravel`, `measure()` i
`FuelTreatments.at()`** (els que corren dins del bucle calent, 1.024²
cel·les, §11.36): nou escenaris (0 a 20 descàrregues, brases, vent canviant,
brigades, combustibles barrejats), comparant un SHA-256 de les sortides abans
i després de partir cada funció. Sortides idèntiques en els nou, i sense
alentir-se —en algun escenari una mica més ràpid, per una memòria cau que
abans es recalculava sense necessitat—. Detall a §11.69; les xifres del
benchmark no han quedat enlloc del repositori, era una comprovació puntual.

## Els `any`

- [x] Els 20, que eren tots a les proves: tipats. El de la GPU ja va trobar
      que `createProgram()` pot tornar `null` encara que el tipus del DOM digui
      que no (§11.63).
- [ ] **Un `any` nou, fora de test, pendent que Pere el confirmi**: a
      `simulation/countermeasures.ts`, per tipar `raw` (JSON sense validar) a
      les noves funcions internes de `parseCountermeasures()`, hi ha
      `type UncheckedMeasure = any;` amb un
      `// eslint-disable-next-line @typescript-eslint/no-explicit-any` (línia
      ~343). No és un `any` nou de comportament —el codi original ja en
      depenia implícitament, per una peculiaritat de TypeScript amb
      `Array.isArray` sobre `unknown`—, només la primera vegada que cal
      escriure'l explícitament. Detall a §11.69.
