# Inventari — web/ (Fase 1)

Fet només amb lectura, amb grep i sense graf de crides complet: els falsos positius
són possibles, sobretot en tipus i en noms curts (marcats com a dubtosos).

> **Al dia, 24/11/2026.** Els punts 2 i 3 estan resolts: `fire-field.ts` i
> `fire-appearance.ts` es van retirar a la §11.66, amb les seves proves, i
> amb ells el comentari de `map.service.ts` que nomenava el camp continu. La
> 12.15 queda tancada. Es conserven escrits perquè l'inventari és el de la
> fase 1 i diu què s'hi va trobar, no què hi ha avui. El punt 7, la conversió
> de metres a graus repetida cinc vegades, **continua viu** i és a la llista
> de la revisió final.

## Per gravetat

1. **Dependència sense ús**: `web/package.json` `@angular/forms` (dependencies). Zero imports a web/src i cap ngModel, formControl ni formGroup als html. Dubtosa només si hi ha un ús per plantilla que el grep no veu (no n'he trobat).
2. **Pintors sense importador de producció (12.15)**: `web/src/app/simulation/fire-field.ts:41` (`class FireField`) i `web/src/app/simulation/fire-appearance.ts:9` (`class FireAppearance`). Només els importen proves: `graphics.spec.ts:27` i `fire-appearance.spec.ts:2`. Decisió pendent: mantenir com a alternativa sense WebGL2, o eliminar. No es decideix aquí.
3. **Comentari que descriu un pintor que no es veu**: `web/src/app/map/map.service.ts:843-844` diu que la capa de foc és «un camp continu (fire-field.ts)». La capa real és raster de `FIRE_SOURCE`, que no usa `fire-field.ts`. Nom o referència obsolets.
4. **Funcions que només fan servir proves**: `web/src/app/simulation/scenario.ts:167` `parseScenario` (el simulador escriu escenaris amb `formatScenario` a `simulator/simulator-view.ts`, però mai no els llegeix; només `scenario.spec.ts:52` i `load-points.spec.ts:84`). Si la lectura és intencionada o és codi mort, és una decisió. També `web/src/app/simulation/point-locator.ts:28` `shapeAt` (només specs, però també l'usa la classe a les línies 55 i 64, així que és export sobrer, no mort).
5. **Constants i funcions exportades sense cap ús fora del fitxer**: `web/src/app/simulation/fire-emitters.ts:11` `FLAME_MIN_M` (només spec); `fire-spread.ts:43` `SpreadInput` (només spec); `fuel-treatments.ts:12` `WETTING` (només spec); `simulator/simulator-view.ts:88` `SIMULATE_FIRE` (només spec); `map/map.style.ts:53` `REGIONS_SOURCE` i `:57` `CONTOURS_SOURCE` (zero referències fora); `simulation/countermeasures.ts:60` `crewMeasure` (s'usa dins, l'export sobra); `:222` `legMin` i `:227` `passInterval` (usats a `load-points.spec.ts`, dins del fitxer també); `:50` `CREW_KINDS`; `:202` `MAX_LOAD_MIN`; `:375` `MAX_COUNTERMEASURES`.
6. **Tipus exportats sense cap importador** (baixa gravetat, dubtoses perquè el grep no distingeix ús intern): `map/countermeasure-display.ts:8` `DrawnMeasure` i `:17` `DrawnDraft`; `map/map.config.ts:128` `NamedView`; `simulation/agents.ts:11-13` `GroundKind`, `AircraftFigure`, `AgentKind`; `simulation/countermeasures.ts:136` `CrewSchedule`, `:147` `CrewHead`, `:721` `CountermeasureField`; `simulation/fire-display.ts:65` `FrontSegment`; `simulation/fuel-data.ts:1` `FuelSource`; `simulation/fuel-treatments.ts:28` `TreatedFuel`; `simulation/levels.service.ts:13` `Level`; `simulation/spotting.ts:13` `EmberWind`; `simulator/countermeasure-plan.ts:23` `PlanNote`; `simulator/icon.ts:44` `IconName`; `simulation/scenario.ts:71` `ScenarioRead`.
7. **Duplicació: conversió de metres a graus** amb `111_320` i `Math.cos(lat·π/180)`, escrita cinc vegades: `map/countermeasure-display.ts:44` (constant `M_PER_DEGREE`) i `:73-74`; `simulation/domain.ts:25` (mateixa constant) i `:39-40`; `map/agents-3d.ts:283` (funció `offset`); `simulation/countermeasures.ts:206-207` (`distanceM`); `simulator/countermeasure-plan.ts:161-162`.
8. **Duplicació: clamp** escrit de set maneres. Identitat exacta: `simulation/slope-classes.ts:50` i `simulation/terrain.ts:205`, la mateixa lambda `inner = Math.min(Math.max(v, 1), GRID - 2)`. Altres: `map/map.service.ts:107` (`between`), `map/agents-3d.ts:45` (`clamp01`), `simulation/rothermel.ts:437` i `:451`, `simulation/scenario.ts:226`, `simulation/terrain.ts:120-121`, `map/map.style.ts:125`, `simulator/simulator-view.ts:1610` i `:2192`, `map/hotspots.service.ts:76`, `api/src/app.ts:92`.
9. **Duplicació: distància**: `simulation/countermeasures.ts:205` `distanceM` (pla, 111_320 m/grau) i `api/src/weather.ts:228` `distanceKm` (haversine, R = 6371). Dos mètodes per al mateix concepte, un a cada meitat.
10. **Nombres màgics repetits**: `1852` a `simulation/countermeasures.ts:223`; `Math.PI / 180` a `api/src/weather.ts:229` i a les línies de conversió del punt 7.
11. **Nom que menteix**: `map/map.service.ts:106` `between(value, low, high)` no respon «està entre» sinó que retalla el valor (és clamp).
12. **Ombra de nom** (baixa): `simulation/spotting.ts:71` declara `const distanceM` dins d'una funció que també té el camp `distanceM` a la línia 66-76.
13. **Funcions que fan més d'una cosa**: no verificat funció per funció, només per mida: `simulator/simulator-view.ts` té 2.195 línies i `map/map.service.ts` 1.271. Caldria una lectura específica.

## Dependències que no entren al recompte del paquet

- `@angular/common`: cap import directe; és peer de `@angular/router` i `@angular/platform-browser`. Dubtosa: potser no és sobrer.
- `tslib`: cap import directe a `web/package.json`. Dubtosa: sol ser necessària per als helpers de TypeScript.
- `jsdom`: el fan servir 3 specs (`bootstrap.spec.ts`, `graphics.spec.ts`, `input-services.spec.ts`), és a devDependencies i és correcte.
- `rxjs`: usat a `map/hotspots.service.ts:4`.

## Mida del paquet inicial (~1,5 MB)

Mesurat sobre `web/dist/web/browser/`, d'un build anterior que pot no coincidir amb el codi actual. `index.html` carrega només quatre fitxers:
- `chunk-IOGLVTCG.js`: 1.063.338 B. És **maplibre-gl** (345 aparicions de «maplibre»).
- `chunk-MOAMR3SP.js`: 298.899 B. És **maplibre-contour** (31 aparicions de «contour»). S'importa de forma estàtica: `map/map.style.ts:8` → `map/contours.ts`.
- `styles-*.css`: 75.540 B.
- `main-*.js`: 64.601 B.

Fora del paquet inicial: `chunk-QHKSYEMT.js` (578.656 B, **three**, carregat sota demanda pels agents 3D) i `maplibre-gl-worker.mjs` (518.806 B, `map/map.service.ts:47`, també sota demanda). El pressupost inicial és d'1,6 MB d'avís i 1,75 MB d'error (`web/angular.json:36-41`).

## Mida de `web/public/data` (~25 MB, publicats tal qual)

- `municipalities/`: 12.623.491 B en 81 fitxers (ES i PT per províncies, p. ex. `ES111.geojson` 160 KB). Carregats per província a `simulation/municipalities.service.ts:68` i `simulation/point-locator.ts:59`.
- `places/`: 11.580.946 B en 81 fitxers. Carregats per província a `map/places.service.ts:84`.
- `municipality-index.json`: 556.983 B, carregat a `simulation/search.service.ts:159`.
- `provinces.geojson`: 389.505 B. `regions.geojson`: 218.249 B.
- Precisió: els fitxers de municipis tenen soroll de coma flotant (p. ex. `43.14721299900003`, a `municipalities/ES111.geojson` i a 81 fitxers). `places/` s'arrodoneix a 5 decimals a `web/scripts/fetch-places.mjs:51`. No s'ha revisat `web/scripts/fetch-municipalities.mjs` per veure si arrodoneix.
- Compressió: `api/src/fuels.ts:295` només gzippa la seva pròpia cache. No s'ha trobat compressió per als fitxers estàtics a `api/src/`. No s'ha revisat `web/proxy.config.json`.

## Limitacions

- Els recomptes són per nom amb grep, sense graf de crides. Els falsos positius són possibles, sobretot en tipus i en noms curts.
- No s'ha executat cap prova ni build durant aquest inventari.

## Resolució de codi mort — fase 4 (20/11/2026)

- `@angular/forms` eliminada; exports només interns o només de test s'han fet
  locals (`SpreadInput`, `WETTING`, `FLAME_MIN_M`, `DrawnMeasure`, `DrawnDraft`,
  entre d'altres). Les proves obtenen el tipus de la funció o declaren la dada
  que proven, sense eixamplar l'API de producció.
- `FireField` i `FireAppearance`, sense importador de producció, i les proves
  exclusives s'han retirat. El pintor actiu és `FireSurface`.
- El wrapper `parseScenario`, que només feien servir proves, s'ha tret; la
  pantalla llegeix amb `readScenario`.
- `loadPoint`, `loadMin`, els càlculs de trajecte/temps de càrrega i les proves
  d'aquesta funcionalitat s'han retirat. Els fitxers nous són versió 8; un
  fitxer de la versió 7 amb aquests camps ara es rebutja perquè el pla canviaria
  silenciosament si s'ignorés. L'interval manual entre passades es manté.
- Les funcions, tipus i constants provats i/o usats per producció es mantenen.
  La llista de duplicacions i els fitxers grans no s'han tractat com a codi
  mort.
