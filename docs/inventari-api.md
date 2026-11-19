# Inventari — api/ (Fase 1)

Fet només amb lectura, amb grep i sense graf de crides complet: els falsos positius
són possibles, sobretot en tipus i en noms curts (marcats com a dubtosos).

## Per gravetat

1. **Export sense ús fora del fitxer**: `api/src/fuels.ts:58` `worldCoverTile` (s'usa a la línia 77; l'export sobra); `api/src/firms.ts:208` `windowsFor` (usat a la línia 285; l'export sobra); `api/src/fuels.ts:24-26` `FUEL_DATA_DIR`, `FUEL_VERSION` (només als tests i a `api/scripts/prepare-fuels.mjs`); `api/src/fuel-grid.ts:92` `paintPolygon` (només a `api/tests/fuels.test.ts:61` i `:87`: export de test, no mort); `api/src/fuel-grid.ts:4` `TILE_DEGREES` (usat a dins).
2. **Tipus sense importador** (baixa): `api/src/weather.ts:32` `Country`; `api/src/firms.ts:13` `HotspotProperties`, `:40` `HotspotAnswer`, `:29` `HotspotCollection` (també sense ús fora).
3. **Dependències**: `fflate` només a `api/scripts/prepare-fuels.mjs:14`; `proj4` i `shapefile` només a `api/scripts/prepare-fuels.mjs:12-13`. Els tres són `dependencies`, no `devDependencies`, així que s'instal·len a la producció encara que només els usi l'script. `geotiff` sí s'usa a producció (`api/src/fuels.ts:13`). `fastify` s'usa a `api/src/app.ts:1`.
4. **Fitxers sobrers a `api/dist/`** (no versionat, fora de git): `lakes.js.map`, `lakes-routes.js.map`, `osm-routes.js.map`, `water.js.map`, `water-routes.js.map`. No tenen font a `api/src/`: és sortida d'un build antic.
5. **Entrypoints sense importador (correcte, no és codi mort)**: `api/src/server.ts` i els fitxers d'arrel de rutes.

## Duplicació compartida amb web/ (referència)

- **Distància**: `api/src/weather.ts:228` `distanceKm` (haversine, R = 6371) duplica el concepte de `simulation/countermeasures.ts:205` `distanceM` (pla, 111_320 m/grau) a web/.
- **Clamp**: `api/src/app.ts:92` és una de les set variants de clamp repetides al projecte (veure `docs/inventari-web.md`).
- **Nombre màgic**: `Math.PI / 180` a `api/src/weather.ts:229`.

## Limitacions

- Els recomptes són per nom amb grep, sense graf de crides. Els falsos positius són possibles, sobretot en tipus i en noms curts.
- No s'ha executat cap prova ni build durant aquest inventari.
