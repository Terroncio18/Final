# Fase 4 — Codi mort

**Qui**: per carpetes. **Depèn de**: 1. **Va abans de la 5**: no es poleix el
que s'ha de treure. **Acaba quan**: no queda res de la llista de la fase 1 i
les proves segueixen verdes.

- [x] Treure el codi mort confirmat a la llista de la fase 1: dependència
      `@angular/forms`, exports només interns, l'alias `AgentKind`, el wrapper
      de proves `parseScenario`, els antics pintors sense importador de
      producció, i tot el suport a punts de càrrega/temps de càrrega. Les eines
      d'importació de combustibles passen a `devDependencies`; el comentari
      obsolet del mapa es corregeix. La prova FIRMS s'ancora al dia actual.
- [x] Fer la passada sencera pels elements de codi mort dels inventaris. Es
      conserven els símbols que tenen ús real o que sustenten proves de codi
      actiu; duplicacions i funcions grans no són codi mort i queden per a les
      fases que els pertoquen.
- [x] Escriure a la bitàcola el que es tregui. A la memòria hi ha d'anar **el
      que es va provar i no es va quedar**, que és la part que explica les
      decisions.

La part mecànica de la fase 5 es va fer abans d'aquesta, a petició de Pere
(§11.63). Els dos pintors antics (12.15) s'han tret: `fire-surface.ts` i
`fire-particles.ts` són els pintors de producció.
