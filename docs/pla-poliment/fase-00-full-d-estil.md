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

Res que bloquegi. Les tres que quedaven obertes les va tancar Pere el
24/11/2026, deixant el criteri a Claude, i són les regles 8, 9 i 10
d'`estil.md`:

- [x] **Com es diu «aquesta resposta ja no la vull»**: són **tres** problemes
      i es diuen diferent —`AbortController` quan la feina és un `fetch`, un
      testimoni amb nom quan no ho és, i deduplicació per clau quan del que
      es tracta és de no repetir el que ja s'ha demanat—. Regla 8.
- [x] **Cadena de promeses o `async`/`await`**: `async`/`await`. Regla 9.
- [x] **Com es diu «això no l'espero»**: un ajudant amb nom que enganxi el
      `catch` i registri amb el prefix del mòdul, mai un `void` nu. Regla 10.
- [x] **Els comentaris.** Decidit per Pere el 20/11/2026 (§11.70): es treuen
      per defecte; es mantenen només per aclarir comportaments no evidents o
      instruccions per a eines. Regla 5.
- [x] **El prefix dels missatges de consola** (regla 11) i **les llengües**
      (regla 12), que ja es complien i només calia escriure-les.

**La fase queda feta.** El que continua a «Per decidir» d'`estil.md` no és
d'aquesta fase: l'apòstrof dels textos de pantalla, els índexs per carpeta
—que Pere va aplaçar el 19/11— i el muntatge del mapa amb nom propi, que
s'ha de valorar cas per cas.

Les regles 8, 9 i 10 **encara no les compleix el codi**: unificar els nou
fitxers que repeteixen el patró és feina de
[`revisio-final.md`](revisio-final.md), no d'aquesta decisió.
