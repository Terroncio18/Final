# Fase 0b — El linter

**Qui**: un de sol. **Depèn de**: 0. **Acaba quan**: `npm run lint` existeix a
les dues meitats i és verd, i la 12.28 està tancada a la bitàcola.

## Fet a `web/`

- [x] ESLint 10 amb `eslint.config.mjs`: regles recomanades de TypeScript i
      d'Angular, accessibilitat de plantilles, `no-floating-promises`, i les
      del full d'estil. La primera passada va donar 278 problemes; 233 eren
      membres sense modificador (`83b48b2`).
- [x] Els 44 que quedaven, a zero (§11.63). Eren:
  - [x] 20 `no-explicit-any`, tots a les proves: tipats.
  - [x] 15 `complexity`: cinc partides, deu al trinquet (vegeu la fase 5).
  - [x] 3 `no-unused-vars`, que **no eren codi mort**: dos `...rest` que deixen
        fora una clau a posta i un paràmetre `_`. S'ha ajustat la regla.
  - [x] 5 d'accessibilitat a plantilles: retirats els silenciadors HTML.
        Focus i teclat resolts als controls; el fons del modal és un botó.
  - [x] 1 expressió amb coma, que ara és un bloc.
- [x] `member-ordering` per a la regla 1 del full d'estil.
- [x] `npm run lint`, i la línia a `CLAUDE.md`.
- [x] La 12.28, tancada a la §11.63, que diu què vigila el linter i què no.

## Tancament del 20/11/2026

- [x] Regla 7 a `web/`: `any` i `unknown` es marquen com a error, també a
      les proves. Comprovat el selector `TSUnknownKeyword` amb un tipus
      prohibit, un tipus concret i un literal de text. La primera passada
      va detectar 99 usos de `unknown`; la migració a tipus explícits ja
      està resolta a `web/`, amb `JsonValue` aprovat per a entrades JSON.

- [x] **El mateix a `api/`**: ESLint 10, regles recomanades TypeScript,
      complexitat màxima 15, promeses gestionades, membres explícits i
      prohibició d’`any`/`unknown`, també a les proves. Les proves no tenen
      límit de complexitat, igual que al web. Cap excepció per fitxer font.
      Dividides `validateGrid` i `rasterProjection`, que superaven 15.
- [x] `npm run lint` a `api/`, i les ordres a `CLAUDE.md`.
- [x] **Prettier a `api/`**, amb dependència pròpia i la mateixa base del web
      (100 columnes, cometes simples). Ordres `format` i `format:check` per
      a fonts, proves i configuració. Dades preparades i artefactes exclosos.
- [x] Comprovació de tipus per fonts/proves API i per integració. La segona
      conserva la configuració del model web que importa; la compilació de
      producció manté el `tsconfig.json` estricte de l’API.
- [x] Resolts els usos explícits d’`unknown` de l’API. Els dobles de fetch
      meteorològic retornen `Response` real, inclosa la codificació AEMET.
      Passen ESLint, Prettier, compilació i les 88 proves API.
