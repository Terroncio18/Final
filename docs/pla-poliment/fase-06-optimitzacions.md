# Fase 6 — Optimitzacions

**Qui**: per carpetes, si no toca el que toca la 5. **Depèn de**: 1 i 2.
**Acaba quan**: cada canvi té el número d'abans i el de després.

Candidats que ja es veuen:

- [x] El paquet inicial, d'1,5 MB (1,50 MB el 19/11/2026).
- [x] Els 25 MB de `web/public/data`, que es publiquen tal qual.
- [x] La política de neteja del cau de combustible de l'API, que no s'ha
      mesurat mai amb el disc ple.

## Progrés — 20/11/2026

La fase 2 continua pendent (vegeu [`fase-02-provar-l-aplicacio.md`](fase-02-provar-l-aplicacio.md)); Pere ha autoritzat completar la fase 6 abans de tancar aquella prova manual. Els canvis són a `web/scripts`, `web/public/data` i `api/`, sense tocar els fitxers de la fase 5.

- [x] Paquet inicial: 1,50 MB abans i després, per sota de l'avís de 1,60 MB.
- [x] Dades públiques: 25.369.174 → 20.836.889 bytes en 165 fitxers; estalvi
      de 4.532.285 bytes (17,9%). Els 81 GeoJSON municipals passen de 12.623.491
      a 8.091.206 bytes (−35,9%) arrodonint coordenades a sis decimals. La
      transferència gzip estimada de totes les dades baixa de 5.299.214 a
      4.000.169 bytes (−24,5%).
- [x] Cau de combustible: abans, un `ENOSPC` en escriure el fitxer temporal
      avortava la petició; ara s'esborra l'entrada més antiga i es reintenta. La
      prova simulada va requerir 2 intents i va conservar 2 entrades (la vella es
      va substituir per la nova). Si no hi ha entrades per alliberar, queda sense
      cau després d'1 intent i no propaga l'error. La còpia local tenia 39 fitxers
      i 4.687.683 bytes abans del canvi; no s'ha mesurat el cau desplegat ni omplert
      un disc real.

Validació de dades: 11.847 anells poligonals, cap anell obert ni degenerat; el
canvi màxim és 0,0000005° (uns 5,6 cm en latitud). Decisió a §11.67.

Comprovació: build web i API; proves web (273), API (74), i les dues proves de
precisió; lint i Prettier en verd. El cas de disc ple s'ha simulat amb `ENOSPC`;
no s'ha omplert cap disc real. La fase 2 manual continua pendent per a la fase 7.

Si `spreadRun()` es parteix a la fase 5, els seus números d'abans i després
també serveixen aquí.
