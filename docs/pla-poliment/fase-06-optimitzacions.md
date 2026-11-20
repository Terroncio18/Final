# Fase 6 — Optimitzacions

**Qui**: per carpetes, si no toca el que toca la 5. **Depèn de**: 1 i 2.
**Acaba quan**: cada canvi té el número d'abans i el de després.

Candidats que ja es veuen:

- [ ] El paquet inicial, d'1,5 MB (1,50 MB el 19/11/2026).
- [ ] Els 25 MB de `web/public/data`, que es publiquen tal qual.
- [ ] La política de neteja del cau de combustible de l'API, que no s'ha
      mesurat mai amb el disc ple.

## Inici — 20/11/2026

La fase 2 encara no s'ha passat (vegeu [`fase-02-provar-l-aplicacio.md`](fase-02-provar-l-aplicacio.md)); per tant, aquesta sessió comença amb
inventari i mesures de partida, sense canviar codi de producte.

- `web/public/data`: 165 fitxers, 25.369.174 bytes (24,19 MiB; 25,37 MB
  decimals) en aquest commit.
- Paquet inicial: l'última xifra registrada és 1,50 MB (19/11). No s'ha pogut
  repetir: `npm run build` falla perquè no hi ha instal·lades les dependències
  de `web` (`@angular/build`).
- Cau de combustible: `api/src/fuels.ts` conserva fitxers de fins a 30 dies i
  intenta retallar el directori a 96 entrades després d'escriure el nou fitxer.
  La neteja no s'executa si l'escriptura falla per manca d'espai; falta mesurar
  la mida real i decidir com tractar `ENOSPC`.

Falta repetir el build amb dependències disponibles i mesurar el cau en un
escenari reproduïble. No s'ha simulat un disc ple.

Si `spreadRun()` es parteix a la fase 5, els seus números d'abans i després
també serveixen aquí.
