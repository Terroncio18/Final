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
      queden fora de `member-ordering`.

## Queda decidir

Són a «Per decidir» d'`estil.md`.

- [ ] **Com es diu «aquesta resposta ja no la vull»**: comptador, clau del que
      s'ha demanat, o `AbortController`. Avui n'hi ha tres maneres.
- [ ] **Cadena de promeses o `async`/`await`**.
- [ ] **Com es diu «això no l'espero»**: `void` o un ajudant que enganxi el
      `catch`.
- [ ] **Els comentaris.** Pere vol codi sense comentaris. S'ha fet la prova a
      `map/hotspots.service.ts`, que ha passat de 182 a 117 línies sense
      perdre res que no sigui a la bitàcola —es perd el punter, no el
      coneixement—. Cal decidir si es fa a tot el repositori. Si es fa, s'ha
      d'esmenar la portada de la fase 1 de la bitàcola, que diu que el codi
      cita els números de les decisions als comentaris. **Afecta la fase 5**:
      les funcions noves de la §11.63 porten comentari, com la resta.
