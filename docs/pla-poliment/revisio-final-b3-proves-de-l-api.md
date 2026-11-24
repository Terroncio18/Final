# B3 — Auditoria creuada de les proves de l'API

24/11/2026. Fase B de [`revisio-final.md`](revisio-final.md), la part de
Claude. Les 124 proves d'`api/`, que no les ha escrit qui les audita: Codex
revisa les del web i Claude les de l'API. Només lectura.

## La mostra

`routes.test.ts` (18 proves, la superfície HTTP), `weather.test.ts` (15),
`fuels-build.test.ts` (10), `fuel-raster.test.ts` (7), `firms.test.ts` (9) i
`config.test.ts` (4). S'han llegit les assercions, els dobles i el codi que
proven. És una mostra dirigida, no una estimació de les 124.

## Primer, el que està bé, perquè aquí és la majoria

**Les esperances són literals, no recalculades.** És justament el vici que
Codex ha trobat a les proves del web, i aquí gairebé no hi és:
`assert.equal(addDays('2024-02-28', 1), '2024-02-29')`,
`assert.equal(tile[0], 4)`, la clau de tessel·la `'-132_227'` escrita a mà.
Les de `fuel-raster.test.ts` escriuen un **GeoTIFF de debò** i comproven
cel·les concretes. No es pot trencar la geometria i deixar-les verdes.

**Els dobles que he comprovat són fidels.** L'`Observation` de
`routes.test.ts:20-28` té exactament els set camps que declara
`api/src/weather-data.ts:10-22`. I el `vi.mock('../src/weather.js')` que
només exposa `nearestObservation` és complet, perquè `app.ts:22` no importa
res més d'aquell mòdul. Això era el que calia mirar després del doble sense
`retry` del web.

**Les branques d'error es recorren.** Dels onze estats que poden tornar les
rutes, les proves toquen 400, 404, 502 i 503.

## Les troballes

### 1. Els set refusos de meteorologia no comproven què es diu

`api/tests/routes.test.ts:300-313` recorre set URL dolentes i comprova
**només el codi 400**. Les tres branques del codi —país que no és ES ni PT
(`app.ts:135`), falta `lon` o `lat` (`:143`) i coordenades fora de rang
(`:146`)— són **indistingibles** per a la prova: si la ruta contestés
«Coordenades fora de rang» a una petició sense `lon`, les set passarien
igual.

El que fa que aquesta valgui la pena és que **el patró correcte és catorze
línies més amunt, al mateix fitxer**: `routes.test.ts:112-127` fa exactament
això bé per als sis refusos de deteccions, amb la seva expressió regular per
cas. Són textos que veu l'usuari —regla 12— i no estan coberts.

### 2. El contracte entre les dues meitats s'escriu dues vegades i ningú ho comprova

`Observation` és declarada **dues vegades, diferent a posta**:
`api/src/weather-data.ts:10-22` amb set camps, i
`web/src/app/simulator/weather.service.ts:4-23` amb nou —hi afegeix
`distanceKm` i `stale`—. La ruta fa el pont a mà, amb un literal:
`app.ts:151-157` escampa l'observació i hi suma els dos camps.

No hi ha res que comprovi que les dues declaracions encaixen. Si algú afegeix
un camp a l'API, en reanomena un, o canvia l'arrodoniment de `distanceKm`, no
falla res fins que algú ho mira a la pantalla: el navegador fa
`response.json() as Promise<Observation>` i se'n refia. Que el web es refiï de
la nostra API és una decisió deliberada de la regla 7; **que el pont no
tingui cap prova que el travessi, no**.

És la mateixa família que el defecte del doble sense `retry`: una costura que
ningú recorre sencera.

### 3. Una assercio compara dos derivats entre ells

`api/tests/config.test.ts:57`:
`assert.equal(platform.nrt.replace('_NRT', ''), platform.sp.replace('_SP', ''))`.
Si les dues constants fossin igualment dolentes, passaria. És menor i el
fitxer en general és una xarxa de seguretat sobre la configuració, no una
prova de comportament: aquesta distinció és legítima i no cal canviar-la.

## El que no he avaluat

Les 124 senceres: he llegit sis fitxers dels onze. No he fet mutacions ni he
executat les suites, perquè aquesta fase és de només lectura i Codex hi
treballava en paral·lel. Les tres troballes són anàlisi de sensibilitat de la
prova, no defectes demostrats a producció.

I una cosa que he de dir del mètode: la troballa 1 va néixer malament. La
primera passada va buscar els textos literals dels errors als fitxers de
prova, no en va trobar cap, i la conclusió va ser que **cap** dels set
missatges estava comprovat. Era fals: les proves de deteccions els comproven
amb expressions regulars, que la cerca de text literal no veu. Comprovar-ho
abans d'escriure-ho va deixar la troballa en el que realment és.
