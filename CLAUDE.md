# IgnisLab

Simulador d'incendis forestals, TFG de Pere. `web/` és l'aplicació Angular 22
—zoneless, signals— i `api/` un servidor Fastify amb TypeScript. No és un
monorepo: cada meitat té el seu `package.json` i s'hi entra per separat.

## On és cada cosa

- **Decisions i motius: `docs/README.md`, i l'índex a `docs/bitacola/README.md`.**
  Mira-hi abans de proposar res: gairebé tot ja s'hi ha discutit, i els
  comentaris del codi citen aquests números (§2.29, §11.27). Una decisió és un
  fitxer; no llegeixis la carpeta sencera.
- Model de foc: `web/src/app/simulation/` —Rothermel, propagació, brases,
  contramesures, combustible—, amb les seves proves al costat.
- Pantalla: `web/src/app/map/` (MapLibre i three.js), `simulator/` (la consola)
  i `top-bar/`.
- API: `api/src/` —deteccions de FIRMS, combustibles, punts d'aigua,
  meteorologia—. Les dades preparades viuen a `api/data/`, que és fora del
  repositori: sense elles, el combustible surt «estimat».

## Ordres

```
cd web && npm test              # les proves del model i les d'Angular
cd web && npm run build
cd web && npx prettier --check .
cd api && npm test              # les de l'API, que llegeixen src/ i no dist/

# La cobertura, a cada meitat. Deixa l'lcov a punt per a Sonar, amb els
# camins des de l'arrel; l'escàner es llança des de l'arrel (§11.55).
cd web && npm run test:coverage
cd api && npm run test:coverage
```

## Com es treballa aquí

- Es commiteja directament a `master`, un canvi per commit, amb el missatge en
  anglès i en minúscula, descrivint què passa a ser cert.
- Tot el que sigui una decisió s'escriu a la bitàcola de la fase oberta, en un
  fitxer nou amb el número següent, i s'hi afegeix una línia a l'índex.
- La pantalla no explica: les explicacions van a la bitàcola i al manual
  d'usuari (pendent 12.18).
- La interfície la prova Pere al navegador. Aquí es compila i es passen les
  proves; no cal obrir el navegador a cada canvi.
- Es proposa la decisió abans d'escriure el codi, i no s'encadenen fases.
