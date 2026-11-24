# Fase 8 — Manuals i README

**Qui**: es pot partir, un manual cadascú. **Depèn de**: 7 per a les captures;
els esborranys es poden començar abans. **Acaba quan**: els tres documents són
al repositori i la 12.18 està tancada.

- [ ] **Manual d'usuari** (12.18): què fa cada secció i cada eina; les
      hipòtesis del model —combustible estimat, foc de superfície, retenció i
      assecat de les descàrregues, brases experimentals—; i que **el
      simulador no serveix per a prendre decisions d'emergència**. És el que
      la pantalla no diu (§11.34).
- [ ] **Manual d'instal·lació**: les claus d'AEMET i FIRMS, les dades
      preparades de combustible —21 MB que no són al repositori—, les ordres
      de les dues meitats, i què cal per a publicar-ho.
- [x] **README a l'arrel**, escrit el 24/11/2026: la guia d'instal·lació
      sencera. Les versions de Node que l'Angular 22 exigeix de debò
      —`^22.22.3 || ^24.15.0 || >=26.0.0`, tretes del seu propi
      `package.json`—, les dues claus gratuïtes i on es demanen, què porta el
      repositori i què no, les dues terminals i el proxy, **què funciona sense
      cada clau**, i deu problemes amb la seva sortida. Comprovat que diu la
      veritat: `npm install` **no** falla per la versió de Node, només avisa;
      `curl` al PowerShell és un àlies que no ensenya el JSON pelat; i l'espai
      és 65 MB entregats més 520 MB de dependències, mesurat.

- [x] **`web/README.md`**, escrit el 24/11/2026. Era la plantilla de l'Angular
      CLI —`ng generate component`, i un `ng e2e` que aquí no existeix—, i
      contradeia el de l'arrel. Ara explica només aquesta meitat: les ordres
      de debò, que l'API ha d'estar engegada i per què, el mapa de `src/app/`,
      i les dues bateries de proves amb el parany de la directiva
      `// @vitest-environment jsdom`. La instal·lació no es repeteix: enllaça
      el de l'arrel.

- [ ] **Un README per a l'`api/`.** No en té. Hauria de dir el mateix de la
      seva meitat: les rutes, d'on surt cada dada, què necessita el `.env` i
      per què `npm start` no arrenca sense ell.
