# Correccions de la revisió de qualitat — Codex i Claude

20/11/2026. Encàrrec de Pere després de la valoració 82,20/100. Treballem
sobre el working tree actual de `C:/Proyectos/TFG/Pere/Final`: conté canvis
previs de tots dos. Aquest repartiment preval sobre els repartiments antics
per a aquestes correccions.

## Regles compartides

- No descartar canvis ni restaurar fitxers amb Git. Pere autoritza commits
  per mòduls quan el pla complet estigui acabat i verificat. Codex farà
  aquesta integració final; cap dels dos commiteja durant el treball paral·lel.
- No editar els fitxers de l'altre. Si apareix una dependència, comunicar
  fitxer, línia i canvi necessari abans de travessar el límit.
- Llegir `CLAUDE.md` i `docs/estil.md`. Complexitat màxima 15; cap `any`,
  `unknown` explícit, silenciador nou ni asserció que amagui un error.
- Mantenir les fórmules, unitats, escenaris antics i contractes públics.
  No modificar els resultats del model de propagació per arreglar la UI.
- Afegir proves dels defectes reproduïts: errors, reintents, navegació,
  concurrència i destrucció. Les proves han de verificar comportament.
- Comentaris només per a comportaments no evidents; HTML sense comentaris.
- Codex manté aquest document i els índexs compartits. Claude retorna a
  Pere un resum dels fitxers modificats, proves i pendents, sense editar
  aquest document mentre Codex hi treballa.

## Claude — `web/src/app/map/` i `web/src/app/simulator/`

Pot crear fitxers dins d'aquestes dues carpetes i modificar-ne les proves.
No modifica `web/tsconfig*.json`, `simulation/`, `api/` ni índexs compartits.

### CL1. Meteorologia vinculada al domini

- [ ] Corregir `simulator/weather.service.ts` i, si cal,
      `simulator-view.ts` i `weather-panel.ts`.
- L'observació només pot alimentar el domini per al qual s'ha consultat.
  Identificar país i coordenades de la petició. Conservar l'última lectura
  quan es refresca el mateix domini; invalidar-la quan canvia el domini.
- Una resposta antiga no pot publicar-se després de navegar, canviar de
  país o destruir la pantalla. Mantenir el control de peticions superades.
- Provar: AEMET a Palma → escenari de Portugal → mode en directe amb
  petició pendent/fallida. El càlcul ha d'utilitzar els valors manuals
  mentre no hi hagi observació vàlida del domini portuguès. Provar també
  refresc fallit del mateix domini, resposta tardana i neteja.

### CL2. Importació 3D i destrucció del mapa

- [ ] Corregir `map/map.service.ts::withAgents` i les proves.
- Quan es resolgui l'import dinàmic, comprovar que la instància destinatària
  continua sent l'activa. Si s'ha destruït o substituït, descartar el treball.
- Gestionar el rebuig de l'import sense promeses rebutjades sense tractar.
  Permetre un reintent després d'un error de càrrega.
- Provar amb import diferit: destruir abans de resoldre, crear un mapa nou,
  fallar l'import i reintentar. Cap capa s'afegeix al mapa antic i cap passada
  antiga apareix al mapa nou.

### CL3. Responsabilitats de les classes grans

- [ ] Després de CL1/CL2, extreure responsabilitats completes de
      `SimulatorView` i `MapService`, mantenint els seus contractes públics.
- Prioritzar el control del càlcul/cancel·lació/publicació i l'estat de
  meteorologia de la pantalla; al mapa, la gestió dels agents 3D i els seus
  recursos. Utilitzar classes o serveis petits amb dependències explícites.
- Evitar traslladar la mateixa classe sencera o crear ajudants que només
  deleguin una línia. Preservar els 24 efectes, el seu ordre i el context
  d'injecció. Mantenir les animacions aturades abans de destruir el mapa.
- Comparar fitxers, membres i responsabilitats abans/després. La millora
  s'ha de veure en la separació d'estat i dependències, no només en línies.
- Si Codex comunica errors de `strictTemplates` en aquestes carpetes,
  resoldre'ls aquí amb tipus i bindings correctes, sense desactivar la regla.

## Codex — localitzador, API i configuració de tipus

### CX1. Recuperar el localitzador després d'un error temporal

- [x] `web/src/app/simulation/point-locator.ts` i les seves proves.
- Retirar de la memòria cau les promeses rebutjades, tant de províncies com
  de municipis. Les consultes simultànies comparteixen la mateixa lectura.
- Provar error → reintent correcte, reutilització de lectures reeixides i
  dues consultes concurrents. No esborrar una lectura nova des d'un error vell.

### CX2. Validar les deteccions FIRMS

- [x] `api/src/firms.ts` i `api/tests/firms-network.test.ts`.
- Validar nombres finits, coordenades geogràfiques, FRP no negativa, dia i
  hora real abans de construir una detecció. Distingir camp absent de zero.
- Ometre files invàlides mantenint les deteccions vàlides. Conservar els
  codis de fallback aprovats, la deduplicació i l'ordre per FRP.
- Provar files mixtes, coordenades no numèriques/fora de rang, FRP invàlida,
  dates impossibles i hores invàlides. Cap `NaN`, `Infinity` ni `null` als
  camps numèrics d'una detecció retornada.

### CX3. Limitar la memòria cau de rangs FIRMS

- [x] `api/src/app.ts`, proves de rutes i un mòdul de memòria cau si aporta
      una responsabilitat clara.
- Fixar un màxim d'entrades amb expulsió de les menys utilitzades. El TTL
  continua determinant frescor; conservar el fallback antic dins del límit.
- Provar límit, ordre d'expulsió, refresc i servei de dades antigues quan
  FIRMS falla. Evitar canviar el contracte de les rutes.

### CX4. Activar les proteccions del compilador

- [x] `web/tsconfig.json` activa les regles heretades per
      `web/tsconfig.app.json` i `web/tsconfig.spec.json`.
- Activar `strict` de TypeScript i `strictTemplates` d'Angular. Comprovar
  producció i proves. No afegir conversions o valors arbitraris per silenciar.
- Codex resol els errors fora de les carpetes de Claude; comunica els que
  corresponen a `map/` i `simulator/`. No desactivar comprovacions per acabar.

## Verificació i lliurament

Claude: ESLint, Prettier i proves Angular afectades, incloent les noves
regressions CL1/CL2. Informar del resultat i de qualsevol comprovació pendent.

Codex: proves del localitzador i de l'API, compilació API i verificació de
tipus/configuració web. Després que totes dues parts estiguin disponibles,
passar suites completes, compilacions, ESLint i Prettier de web i API.

La prova global manual i Sonar continuen a la fase 7. Aquestes correccions
no es donen per integrades només perquè una de les dues parts estigui verda.

## Estat

- Claude: CL1–CL3 resoltes. L'observació guarda el domini que se li ha
  demanat i només es llegeix amb `observationFor()`, que vol el país i el
  centre; en canviar de domini s'invalida a l'instant, i el comptador de
  peticions continua descartant les respostes superades. La importació 3D
  comprova que el mapa de destinació continuï sent l'actiu, tracta el rebuig
  de l'import i permet reintentar; en destruir, les figures s'aturen i la capa
  s'allibera abans que el mapa marxi. Tres classes noves amb dependències
  explícites: `map/map-agents.ts`, `simulator/fire-run.ts` i
  `simulator/screen-weather.ts`. `SimulatorView` passa de 90 a 76 camps i de
  1402 a 1322 línies; `MapService`, de 4 camps d'agents a 1 i de 820 a 797
  línies. Es conserven els 24 efectes i el seu ordre de registre. 7 proves
  noves de comportament; els trossos diferits no es mouen (inicial 1,51 MB,
  `agents-3d` 578 kB, `simulator-view` 219 kB).
- Codex: CX1–CX4 resoltes. Lectures fallides descartades amb comprovació
  d'identitat; 3 regressions noves del localitzador. FIRMS descarta files
  malformades i rebutja un conjunt sense cap fila vàlida, diferenciant-lo
  d'un CSV només amb capçalera. 19 casos nous de FIRMS. Memòria cau LRU de
  32 rangs a `api/src/hotspot-cache.ts`, amb 5 proves noves entre unitàries
  i ruta. `strict` i `strictTemplates` activats al `tsconfig` compartit,
  sense conversions ni excepcions afegides. Passen 147 proves del model i
  112 API i 154 de components amb les regles estrictes activades: 413 en
  total. Tipus de fonts/proves/integració, ESLint i compilacions en verd.
- Integració global: feta. Compilacions, ESLint, Prettier i 420 proves en
  verd a les dues meitats; queden la prova manual global i Sonar, de la
  fase 7.
- Commits: fets. Vuit per mòduls, seguint l'agrupació de sota, més la
  bitàcola. Recullen també la feina de les fases 0 a 5 que era al diff.
  Res empès al remot. L'estat final és el verificat; dels commits
  intermedis s'ha comprovat que cap no deixa un import ni una plantilla
  inexistents, però no s'han compilat per separat.

### Segona revisió — troballes de Claude (20/11/2026)

Verificat a les dues meitats: compilacions, ESLint, Prettier i 420 proves
(147 model, 161 web, 112 API) en verd amb `strict` i `strictTemplates`.

Dins de les carpetes de Claude, dos defectes més de la família de CX1,
corregits amb regressions que fallen sense l'arreglament:

- `map/places.service.ts`: una petició de topònims fallida deixava `asked`
  amb la clau, i la província es quedava sense etiquetes per sempre. Ara
  s'oblida la clau al `catch`.
- `map/study-area.ts`: la promesa de lectura es conservava encara que hagués
  fallat, i les deteccions quedaven sense filtrar tota la sessió. Ara la
  lectura fallida s'oblida i `failed` es torna a posar a fals en reeixir.

A `simulation/`, que és de Codex, el mateix defecte en quatre llocs més. El
senyalador `asked` no es restaura al `catch`, i aquestes dades només es
demanen una vegada per sessió: després d'una fallada de xarxa transitòria la
pantalla deia «No s'han pogut llegir els límits administratius» i no hi havia
manera de tornar-ho a provar sense recarregar la pàgina. Comunicat aquí amb
fitxer i línia; **Pere autoritza Claude a travessar el límit** i els arregla
ell, amb una regressió per cada un:

- `simulation/regions.service.ts` — `asked` torna a fals al `catch`, i
  `load()` reinicia `failed` en començar.
- `simulation/provinces.service.ts` — igual.
- `simulation/search.service.ts` — igual.
- `simulation/municipalities.service.ts` — `asked` s'oblida la província
  fallida, de manera que ara es reintenta la mateixa i no només una altra.

Dues observacions més, sense corregir, que Claude deixa a Codex:

- `top-bar/range-picker.ts:38` — `today` es captura en construir el
  component: passada la mitjanit el màxim del calendari es queda endarrerit.
- `api/src/hotspot-cache.ts:30` — l'expulsió fa `while (size > limit)` i
  comprova `oldest !== undefined` en lloc de sortir del bucle. Avui és
  inabastable, però seria un bucle infinit si mai ho fos.

Valoració de Claude: **91/100**, amb els sis reintents tancats. Els quatre
defectes de la primera revisió i els sis d'aquesta tenen regressió pròpia, i
s'ha comprovat una per una que falla sense l'arreglament. El que encara no
s'ha verificat és la prova manual global al navegador i Sonar, que són de la
fase 7, i les dues observacions de sobre.

## Agrupació prevista dels commits

Només després de completar CL1–CL3 i la verificació conjunta. Incloure la
feina prèvia que continua al diff, respectant les dependències entre tipus,
fixtures i consumidors:

1. Suport de proves i tipus compartits del web, si cal separar-los perquè
   els commits següents siguin compilables.
2. Model de simulació, parsers i serveis de dades de `simulation/`.
3. Mapa, capes i recursos 3D de `map/`.
4. Pantalla i estat del simulador de `simulator/`.
5. Aplicació, barra superior i panell de deteccions.
6. API: ingesta, combustibles, meteorologia, memòria cau i proves.
7. Configuració transversal d’estil i compilador, quan tots els consumidors
   ja compleixin les regles.
8. Documentació, bitàcola i estat del pla.

Ajustar agrupacions si hi ha dependències que ho exigeixin; no partir un
canvi deixant un commit amb imports inexistents, proves trencades o regles
que els fitxers d’aquell commit encara no compleixin. Missatges en anglès,
en minúscula, segons `CLAUDE.md`.
