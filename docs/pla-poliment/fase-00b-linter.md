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
  - [x] 5 d'accessibilitat a plantilles, que eren **falsos positius**: als tres
        llocs el teclat ja hi arriba per una altra banda. Silenciats línia per
        línia, amb el motiu.
  - [x] 1 expressió amb coma, que ara és un bloc.
- [x] `member-ordering` per a la regla 1 del full d'estil.
- [x] `npm run lint`, i la línia a `CLAUDE.md`.
- [x] La 12.28, tancada a la §11.63, que diu què vigila el linter i què no.

## Queda

- [ ] **El mateix a `api/`**: instal·lar ESLint, configurar-lo sense la part
      d'Angular, i arreglar el que surti.
- [ ] `npm run lint` a `api/`, i la línia a `CLAUDE.md`.
- [ ] **Prettier a `api/`**, que no en té ni configuració ni dependència:
      `npx prettier --check` hi fa servir un Prettier solt amb les opcions per
      defecte i hi suspèn 12 fitxers. Seria el mateix `.prettierrc` que a
      `web/`.
