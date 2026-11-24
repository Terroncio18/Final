# Avaluació del codi — la meitat de Claude

24/11/2026. Pere demana una avaluació del codi i decideix repartir-la, com
les dues revisions anteriors (§11.74, 82,20/100; §11.75, 91/100). Aquí hi ha
la meitat de Claude: `web/src/app/map/`, `simulator/`, `top-bar/` i
`hotspot-panel/`. La de Codex —`simulation/` i `api/`— va per l'encàrrec
`tareas codex/para-codex/02-evaluacion-de-simulation-y-api.md`.

## El punt de partida, verificat avui

Les vuit portes de les dues meitats, totes verdes: 420 proves (147 del model,
161 de components del web, 112 de l'API), les dues compilacions, ESLint i el
format. Cap funció de producció per sobre de 80 línies, mesurat passant
ESLint amb `max-lines-per-function` afegida a mà, i la complexitat 15 de la
regla 4 també passa.

O sigui que això no va de res que estigui trencat a la vista: va del que una
suite verda no cobreix.

## Nota: 88/100

Per què no més amunt: hi ha un defecte que l'usuari pot trobar —no es pot
tornar a demanar una lectura de deteccions que ha fallat— i una referència
retinguda a un mapa destruït. Per què no més avall: la disciplina de
concurrència i de cicle de vida d'aquestes quatre carpetes és bona de debò.
Cada camí asíncron que he obert té el seu testimoni o la seva clau, i els
`ngOnDestroy` fan el que la regla 6 demana.

Compta, en llegir el número, que uns 1.900 línies —el gruix de
`simulator-view.ts` i tot `countermeasure-plan.ts`— les he llegit per
estructura i no línia a línia. La nota està menys sostinguda que el 91 de la
§11.75.

## Els defectes

### 1. Una lectura de deteccions que falla no es pot tornar a demanar

`map/hotspots.service.ts:81` i `top-bar/range-picker.html:15`.

`load()` es dispara des d'`effect(() => this.load(this.range()))`, i `range`
és un `computed` sobre els paràmetres de la URL **amb `equal: sameRange`**.
Quan la lectura falla, el selector mostra «sense resposta» i no ofereix cap
control per a reintentar-ho. Triar el mateix rang hi torna a navegar amb els
mateixos paràmetres: el `computed` es considera igual, l'efecte no es torna a
executar i no es demana res. Només se'n surt triant un rang **diferent** o
recarregant la pàgina.

El contrast és dins de la mateixa pantalla: `simulator/weather-panel.ts:204`
té `refreshWeather()`, que existeix precisament per això. I FIRMS és la font
més inestable del projecte —el TTL, l'expulsió LRU i el *fallback* de l'API
hi són per això mateix—, de manera que és la lectura que més probablement
falla.

No hi ha prova que ho cobreixi i no ho trobo discutit a la bitàcola.

### 2. `destroy()` es deixa la subjecció de la càmera

`map/map.service.ts:619`, amb `unclamp` (`:126`) i `clamping` (`:127`).

`destroy()` reinicia deu camps i aquests dos no. Un cop destruït el mapa,
`unclamp` continua guardant un tancament sobre la instància de MapLibre que
ja no hi és, de manera que el mapa mort no es pot recollir fins a la següent
crida a `setSandboxBounds()`; i aquella crida farà `map.off('move', clamp)`
sobre un mapa destruït.

Avui no trenca res. Però és justament la referència retinguda que la
disciplina de la regla 6 vol evitar, i és incoherent amb el que el mètode
pretén fer.

### 3. Els prefixos de consola no es diuen igual

Onze crides a `console.*` a les quatre carpetes, i tres desafinen:
`simulator/simulator-view.ts:1272` no porta cap prefix, i
`map/map-agents.ts:73` i `map/map.service.ts:179` diuen `[mapa]` mentre
`map/source-data.ts:9` diu `[map]`.

`docs/estil.md` té el prefix a «Per decidir» amb la nota «ja es fa, només
cal escriure-ho». No acaba de ser cert: queda decidir-ho i acabar-ho.

### 4. Una data malformada pot tombar el panell

`hotspot-panel/hotspot-panel.ts:61-69`. `Intl.DateTimeFormat.format()` llança
`RangeError` amb una data invàlida, i això és un `computed` que llegeix la
plantilla: un `observedAt` dolent no mostraria «desconegut», tombaria el
panell. L'API valida dia i hora (§11.74), de manera que és defensa en
profunditat i no un defecte viu.

### 5. Una resposta superada encara pot escriure `earliest`

`map/hotspots.service.ts:95-96`. `earliest` s'escriu **abans** de la
comprovació de vigència de la línia 100, de manera que una resposta ja
superada pot sobreescriure la data de la dada més antiga. Al `catch`, el
`console.error` de la línia 119 també va abans de la seva comprovació (120) i
registra errors de peticions que ja no espera ningú.

## El que he mirat i està bé

- **`ngOnDestroy` de `simulator-view` (`:663`)**: treu el listener amb la
  mateixa referència de funció, destrueix els dos `EffectRef`, desenganxa els
  dos visors, buida terreny, combustible i meteorologia, i deixa el mapa per
  al final. És l'ordre que la regla 6 demana.
- **`watchFireAnimation` (`:1257`)**: l'`onCleanup` destrueix l'animació i
  buida `redrawFire`; `FireAnimation.dispose()` cancel·la el seu
  `requestAnimationFrame`.
- **Els testimonis**: `FireRun`, `WeatherService`, `PlacesService`,
  `StudyArea` i `MapAgents` tots es protegeixen de les respostes superades, i
  els tres que la §11.75 va arreglar continuen oblidant la lectura fallida
  per a permetre'n una altra.
- **El perill que sospitava de `PlacesService` no hi és**: `asked` no es
  reinicia en destruir el simulador, però `LevelsService.show()` crida
  `places.release()` en entrar a qualsevol nivell del formulari, i el
  comentari diu per què. Tornar-hi no deixa el mapa sense topònims.
- **Les assercions de tipus**: una vintena a les quatre carpetes, i totes
  estrenyen unions de MapLibre (`getSource`). No n'hi ha cap que doni per
  bona una dada externa sense validar-la.

## El que no he pogut avaluar

- `simulator/countermeasure-plan.ts` (591) i el gruix de
  `simulator/simulator-view.ts` (1.322): llegits per estructura, mirant-ne el
  cicle de vida, la concurrència i el camí d'una execució. Unes 1.900 línies
  sense lectura línia a línia.
- `map/agent-models.ts` (454), `map/fire-particles.ts` (358) i
  `map/agents-3d.ts` (298): n'he comprovat l'alliberament de recursos, no la
  geometria ni els *shaders*. Això demana el navegador.
- Res visual: la prova manual és de la fase 7 i és de Pere.
- Si les proves comproven comportament o repeteixen la implementació: n'he
  llegit unes poques, no les 161.
