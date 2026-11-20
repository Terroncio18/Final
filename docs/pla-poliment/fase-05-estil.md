# Fase 5 — Estil

**Qui**: per carpetes, i mai el mateix fitxer que un altre.
**Depèn de**: 0, 0b i 4. **Acaba quan**: el linter és verd sense excepcions i
els fitxers segueixen el full d'estil ([`../estil.md`](../estil.md)).

Començada el 19/11/2026 per Claude (§11.63), continuada per Codex a petició
de Pere. El 20/11/2026, ESLint és verd a web i API, sense excepcions per
fitxer de producció. Retirades les dues excepcions d'ordre de membres i
completada la revisió de comentaris de les sis carpetes.

**Tancada el 20/11/2026** (§11.73): Pere ha aprovat dividir les cinc
funcions llargues i validar les respostes meteorològiques a l’API. Tots els
punts d’aquesta fase estan resolts. La prova global manual i Sonar
corresponen a la fase 7.

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
- [x] Retirades les excepcions de `member-ordering` per a
      `simulator-view.ts` i `countermeasure-plan.ts`. Camps ordenats
      segons les dependències d'inicialització; mètodes públics/protegits
      abans dels privats. Verificat que cada membre conserva el codi;
      passen les 53 proves dels dos fitxers.

## Regla 2 — Cap membre sense dir qui el pot veure

- [x] A tot `web/` (`83b48b2`), i ho comprova el linter.

## Regla 3 — Els imports, tots seguits

- [x] 36 fitxers: 35 a `web/` i `api/src/app.ts`. No ho comprova cap regla:
      caldria `eslint-plugin-import-x`, que no s'ha afegit.

## Els comentaris

- [x] Decidit (§11.70): es treuen per defecte; només es conserven per aclarir
      comportaments no evidents o instruccions per a eines. Es fa fitxer per
      fitxer, amb Pere, dins del mateix repartiment per carpetes d'aquesta
      fase. De passada, cada fitxer es repassa per injeccions i altres
      restes que ja no es facin servir, més enllà del que ja va cobrir la
      fase 4.
  - [x] `web/src/app/map`
  - [x] `web/src/app/simulator`
  - [x] `web/src/app/top-bar`
  - [x] `web/src/app/hotspot-panel`
  - [x] `web/src/app/simulation`
  - [x] `api/src`

## Regla 6 — Cicle de vida explícit

- [x] `OnDestroy` i `public ngOnDestroy(): void` a `map/map-shell.ts`,
      `simulation/simulation-flow.ts`, `simulation/ignition-step.ts` i
      `simulator/simulator-view.ts`. Les animacions del simulador s'alliberen
      abans de destruir el mapa.
- [x] `OnInit` i `public ngOnInit(): void` a `simulation/region-step.ts`,
      `simulation/province-step.ts`, `simulation/municipality-step.ts`,
      `simulation/ignition-step.ts` i `simulation/simulation-flow.ts`.
      Les càrregues inicials i les accions d'entrada són al hook; els efectes
      reactius es registren al constructor. Les 14 proves del formulari,
      ESLint i Prettier passen.

- [x] Constructor de `simulator/simulator-view.ts` reduït a 17 línies:
      registra els efectes mitjançant 13 mètodes privats per responsabilitat.
      Verificats el cos i l'ordre dels 24 efectes respecte de la versió
      original abans de separar l’animació. Cap funció supera complexitat 15; passen les
      38 proves de formulari, simulador i ajustos, la compilació, ESLint i
      Prettier. L’excepció d’ordre de membres ja està retirada.

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

## Els `any` i `unknown`

- [x] Els 20, que eren tots a les proves: tipats. El de la GPU ja va trobar
      que `createProgram()` pot tornar `null` encara que el tipus del DOM digui
      que no (§11.63).
- [x] **Eliminat l'`any` de `simulation/countermeasures.ts`**, el 20/11/2026:
      primer es van declarar els camps amb valors `unknown`; posteriorment
      substituïts per `JsonObject | Countermeasure` segons la regla 7.
      Cada validador retorna els camps tipats que ha comprovat, i el parser
      construeix la contramesura amb aquests resultats. Retirada l'excepció
      de `no-explicit-any`. Comparats 11.780 casos amb la versió anterior:
      mateixos resultats i missatges d'error. Passen les 48 proves afectades,
      la compilació, ESLint i Prettier; complexitat màxima 15 al fitxer.
- [x] **Tipus concrets segons la regla 7**: resolts els 99 usos detectats
      en 33 fitxers de `web/` (42 d'aplicació i 57 de proves), inclosos els
      7 de `countermeasures.ts`. Pere aprova `JsonValue` com a contracte
      d'entrada dels parsers, amb tipus específics després de validar.
      Les proves utilitzen esdeveniments DOM i fixtures tipades. ESLint,
      TypeScript i Prettier passen. Verificades 144 proves de model i
      154 de components; actualitzada l'expectativa de la llista de brases
      a la presentació vertical ja aprovada.

## Revisió final del 20/11/2026

- [x] Comentaris TS i CSS revisats fitxer per fitxer, inclosos proves i
      fitxers arrel de l’aplicació. Es conserven unitats, assumpcions del
      model, fonts científiques, particularitats de proveïdors i notes
      necessàries per a eines. Les plantilles HTML no porten comentaris.
- [x] La passada de comentaris conserva els tokens de codi TypeScript i
      les regles CSS. La comprovació addicional de membres/paràmetres
      sense ús passa; `gl` del contracte MapLibre ara és `_gl`.
- [x] ESLint i Prettier disponibles i en verd a les dues meitats.
      També passen compilació i 386 proves (144 model, 154 components,
      88 API). Les proves d’integració amb proveïdors reals són opcionals
      i no s’han executat en aquesta revisió.
- [x] Pere aprova dividir les cinc funcions llargues. Resultat:

      | Funció | Abans | Ara |
      | --- | ---: | ---: |
      | `buildStyle` | 252 | 17 |
      | `watchFireAnimation` | 110 | 35 |
      | `CountermeasureDisplay.attach` | 98 | 11 |
      | `MapService.create` | 86 | 14 |
      | `SimulatorView.start` | 83 | 60 |

      Les capes es construeixen per grups; mapa, listeners i estat de la
      simulació tenen mètodes propis. `FireAnimation` concentra dibuix,
      partícules i alliberament. Mateixos valors i ordre de les 16 capes
      base i les 9 de contramesures. Comparades 43 crides d’animació:
      idèntiques amb salts, pestanya oculta, moviment reduït, escala,
      pronòstic i destrucció. Cap funció revisada arriba a 80 línies.
      Complexitat màxima: 15 al web i 13 a l’API.

- [x] Pere aprova reforçar l’entrada AEMET/IPMA al servidor existent.
      `weather-data.ts` valida JSON, estacions, coordenades, dates i
      valors abans de construir `Observation`. `weather.ts` conserva
      consultes, codificació ISO-8859-15 i memòria cau. Els registres
      malformats es descarten; si falla una actualització amb estructura
      invàlida, es conserva l’última lectura marcada com a antiga.
      Afegits 13 casos: passen les 88 proves API.
- [x] Retirats els `as never` dels filtres de MapLibre i de la fixture del
      localitzador: ara es comproven amb el contracte corresponent.

Els canvis queden al working tree, sense commits. Les decisions d’estil
encara obertes a la fase 0 continuen com a propostes i no alteren les set
regles acordades que aquesta fase ha aplicat.
