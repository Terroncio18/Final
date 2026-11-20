# Fase 1 — Inventari

**Qui**: es pot partir en dos, `web/` i `api/`. **Depèn de**: res.
**Acaba quan**: hi ha dues llistes a `docs/`, ordenades per gravetat, cada
entrada amb fitxer i línia.

Només llegir. Què s'hi busca:

- [x] **Codi mort**: fitxers que ningú importa, exports que ningú fa servir,
      branques impossibles, `TODO` vells. Dels 3 `no-unused-vars` del linter
      cap no ho era (§11.63), i el linter tampoc no veu un fitxer sencer que
      ningú importa: s'ha de buscar a mà. Fet a `docs/inventari-web.md` punts
      1, 4-6 i `docs/inventari-api.md` punts 1-2. No s'ha trobat cap fitxer
      sencer sense importador en aquell inventari (la 12.15 es va resoldre i
      els dos fitxers es van retirar a la fase 4, §11.66).
- [x] **La 12.15**: `fire-field.ts` i `fire-appearance.ts` tenien proves i no
      els fa servir ningú. Decidir si es treuen o es queden com a alternativa
      sense WebGL2. Confirmat a `docs/inventari-web.md` punt 2: cap importador
      de producció, només specs. Decisió tancada a la fase 4: s'han tret amb
      les proves exclusives; §11.66.
- [x] **Duplicació**: el mateix càlcul escrit dues vegades, el mateix patró
      resolt de tres maneres (com el de la primera decisió de la fase 0).
      Fet: conversió metres-graus escrita cinc vegades, clamp escrit set
      vegades, distància resolta de dues maneres (web/ i api/) i nombres
      màgics repetits (`docs/inventari-web.md` punts 7-10, `docs/inventari-
      api.md` secció de duplicació compartida).
- [x] **Noms que menteixen** i funcions que fan dues coses. Trobat un nom que
      menteix (`between` que en realitat retalla, punt 11) i una ombra de nom
      (punt 12). Les funcions de dues coses no s'han revisat una a una: només
      s'han marcat els dos fitxers més grans (`simulator-view.ts` 2.195
      línies, `map.service.ts` 1.271) com a candidats a mirar de prop
      (punt 13).
- [x] **Dependències**: les que no es fan servir, i les que pesen al paquet.
      Fet: `@angular/forms` sense ús a web/, i a api/ `fflate`, `proj4` i
      `shapefile` instal·lats com a `dependencies` de producció quan només
      els usa un script (`docs/inventari-api.md` punt 3).
- [x] **On es va el temps i els bytes**: el paquet inicial és d'1,5 MB, i
      `web/public/data` són 25 MB que es publiquen tal qual. Desglossat a
      `docs/inventari-web.md`: maplibre-gl (1,06 MB) i maplibre-contour
      (299 KB) al paquet inicial; three i el worker de maplibre fora, sota
      demanda. A `web/public/data`: municipis (12,6 MB) i llocs (11,6 MB) en
      81 fitxers cada un, més l'índex de cerca (557 KB).
