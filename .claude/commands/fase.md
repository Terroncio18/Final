---
description: Obre una fase del pla de poliment i la porta fins al commit.
argument-hint: <numero de fase>
---
Portes la fase **$1** del pla de poliment. Tu coordines i no escrius res: ni
codi ni documentació. Cada pas, en ordre, i pares al primer que falli.

**1. Comprovar que es pot agafar.** Llegeix la taula d'estat de
`docs/pla-poliment/README.md`. Si les dependències de la fase $1 no estan
fetes, para i digues quines falten. Si la fila ja té algú, para.

**2. Llegir la fase.** Obre **només** `docs/pla-poliment/fase-$1-*.md`. No
obris la carpeta sencera ni les altres fases.

**3. Comprovar que el repositori està net.** `git status --short`. Si hi ha
canvis sense desar, para i pregunta: hi ha feina d'una altra sessió i
commitejar-la de propina és com es va estar a punt de perdre la de Codex
(§11.62).

**4. Triar el treballador** segons aquesta taula, i cridar-lo **un de sol**:

| Fase | Agent | Per què |
| --- | --- | --- |
| 1, 4, 10 | `inventari` | només llegeixen i recompten |
| 3, 5, 6, 8 | `codi` | la feina la mana el linter o la llista |
| 5 · `spreadRun`, `ellipse`, `windyTravel`, `measure`, `FuelTreatments.at`, i partir `simulator-view.ts` o `countermeasure-plan.ts` | `codi-dificil` | partir-ho es paga en temps (§11.36) |
| 0, 2, 9 | **cap** | són decisions de Pere, no feina d'agent |

Al brief que li passis, hi va: el camí del fitxer de la fase, els fitxers
concrets que pot tocar, i què vol dir acabat. **No li passis aquesta conversa
sencera**; cada token que li dones el paga a cada torn seu.

**5. Comprovar que és verd.** Tu mateix, no l'agent:

    cd web && npm test && npm run build && npx prettier --check . && npm run lint
    cd api && npm test

Si alguna cosa és vermella, torna a cridar el mateix agent amb l'error. Un cop.
Si torna a fallar, para i reporta.

**6. Tancar.** Crida `bitacola` amb el camí del fitxer de la fase i un resum
del que s'ha fet. Ell marca les caselles, posa al dia la fila de la taula i
commiteja.

**7. Reportar** en cinc línies: què s'ha fet, què queda, i si hi ha quedat
alguna decisió oberta per a Pere.
