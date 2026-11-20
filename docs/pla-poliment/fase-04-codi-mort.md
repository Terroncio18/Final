# Fase 4 — Codi mort

**Qui**: per carpetes. **Depèn de**: 1. **Va abans de la 5**: no es poleix el
que s'ha de treure. **Acaba quan**: no queda res de la llista de la fase 1 i
les proves segueixen verdes.

- [ ] Treure el que digui la llista de la fase 1. Fets: dependència
      `@angular/forms` eliminada; `fflate`, `proj4` i `shapefile` passen a
      `devDependencies`; exports només interns retirats; comentari de `fire`
      actualitzat. La prova d'avui depenia d'una data que ja havia passat; la
      disponibilitat de FIRMS de la seva fixture ara s'ancora al dia actual.
      Pendents de decisió: els pintors de 12.15 i `parseScenario`.
- [x] Escriure a la bitàcola el que es tregui. A la memòria hi ha d'anar **el
      que es va provar i no es va quedar**, que és la part que explica les
      decisions.

La part mecànica de la fase 5 es va fer abans d'aquesta, a petició de Pere
(§11.63). Si `fire-field.ts` o `fire-appearance.ts` es treuen (12.15), el
poliment que se'ls va fer es perd, i no passa res.
