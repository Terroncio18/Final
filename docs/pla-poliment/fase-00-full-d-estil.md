# Fase 0 — El full d'estil

**Qui**: un de sol, perquè és un document. **Depèn de**: res.
**Acaba quan**: les decisions obertes estan escrites com a regla a
[`../estil.md`](../estil.md).

## Fet

- [x] [`estil.md`](../estil.md) amb quatre regles, cadascuna amb la mesura de
      com està el projecte: l'ordre de dins d'una classe, cap membre sense
      `private`/`protected`/`public`, els imports en un bloc, i res de codi
      espagueti amb el llindar de 15.
- [x] **`simulator-view.ts` i `countermeasure-plan.ts`**, que agrupen l'estat
      per tema i no per tipus. Decidit per Pere el 19/11/2026 (§11.63): ara no
      s'hi aplica la regla 1, i el que cal és partir-los (fase 5). Fins llavors
      quedaven fora de `member-ordering`. Excepcions retirades el
      20/11/2026 després de dividir i ordenar les dues classes.

- [x] **Cicle de vida explícit.** Decidit per Pere el 20/11/2026: els
      components implementen `OnDestroy` i concentren la neteja a
      `public ngOnDestroy(): void`. Regla 6 a `estil.md`, amb l'ordre de
      destrucció i els casos propis de `effect` i MapLibre. La inicialització
      també és explícita amb `OnInit`: aplicada als cinc components del
      formulari el 20/11/2026, mantenint els efectes reactius al constructor.

## Queda decidir

Són a «Per decidir» d'`estil.md`.

- [ ] **Com es diu «aquesta resposta ja no la vull»**: comptador, clau del que
      s'ha demanat, o `AbortController`. Avui n'hi ha tres maneres.
- [ ] **Cadena de promeses o `async`/`await`**.
- [ ] **Com es diu «això no l'espero»**: `void` o un ajudant que enganxi el
      `catch`.
- [x] **Els comentaris.** Decidit per Pere el 20/11/2026 (§11.70): es treuen
      per defecte; es mantenen només per aclarir comportaments no evidents o
      instruccions per a eines. Regla 5 a `estil.md`. S'ha esmenat la portada de
      la fase 1 de la bitàcola i `docs/README.md`, que deien que el codi cita
      els números de les decisions als comentaris. **Afecta la fase 5**: es
      fa fitxer per fitxer dins del seu repartiment per carpetes; les
      funcions noves de la §11.63/§11.69 hi entren igual que la resta.
