# Pla de poliment

Demanat per Pere el 19/11/2026, abans del manual d'usuari: deixar l'aplicació
acabada —provada, sense codi mort, amb un estil únic i llegible, optimitzada,
documentada i publicada—. **Es fa en diverses sessions**, i aquesta carpeta és
la memòria del pla: aquest índex diu què toca i qui ho té, i cada fase és un
fitxer propi amb el que hi ha fet (`[x]`) i el que queda (`[ ]`).

La xarxa de seguretat ja hi és: 97,9 % de cobertura i 0 avisos de Sonar
(§11.62). Esborrar i refer coses té avui un cost que fa un mes no tenia.

## Com es comença una sessió

1. Llegir aquest índex i mirar la taula d'estat. **Obrir només el fitxer de la
   fase que s'agafa**, no la carpeta sencera.
2. Triar **una** fase que tingui les seves dependències fetes, escriure el nom
   de qui l'agafa a la taula, i no agafar-ne dues.
3. Treballar només als fitxers de la fase. Si cal tocar-ne un de fora, dir-ho
   a la taula abans.
4. Acabar en verd: proves, compilació, `prettier --check` i `npm run lint`.
   Commit. I **abans de plegar**, marcar al fitxer de la fase el que s'ha fet
   i posar al dia la fila de la taula, encara que la fase quedi a mitges.

### Les regles de treballar-hi dos alhora

1. **Dos no toquen mai el mateix fitxer al mateix temps.** El repartiment és
   per carpetes: `web/src/app/{map,simulator,top-bar,hotspot-panel}` d'una
   banda, `web/src/app/simulation` i `api/` de l'altra.
2. **Qui acaba, avisa; només es commiteja quan Pere ho indica.** La feina de Codex del 19/11 es va quedar
   sense desar i va caldre rescatar-la (§11.62).
3. **El que es decideixi, a la bitàcola**: fitxer nou a `fase-2/` i una línia
   a l'índex. Les regles d'estil, a [`../estil.md`](../estil.md).

## Estat

| #   | Fase                                                        | Depèn de    | Estat                                                                                                        | Qui    |
| --- | ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 0   | [El full d'estil](fase-00-full-d-estil.md)                  | —           | **A mitges**: 7 regles escrites; decisions pendents a `estil.md`                                             | Claude |
| 0b  | [El linter](fase-00b-linter.md)                             | 0           | **Feta** 20/11: ESLint i Prettier en verd a web i API                                                        | Claude |
| 1   | [Inventari](fase-01-inventari.md)                           | —           | **Feta**: dues llistes a `docs/inventari-web.md` i `docs/inventari-api.md`, les sis categories cobertes      | Claude |
| 2   | [Provar l'aplicació sencera](fase-02-provar-l-aplicacio.md) | —           | **Feta** 20/11: prova manual completada; quatre defectes resolts a la fase 3                                 | Pere   |
| 3   | [Errors](fase-03-errors.md)                                 | 1, 2        | **Feta**: 4 defectes de la fase 2 arreglats, cada un amb la seva prova                                       | Claude |
| 4   | [Codi mort](fase-04-codi-mort.md)                           | 1           | **Feta** el 20/11/2026: rutes de càrrega i pintors sense importador retirats; inventaris revisats            | Codex  |
| 5   | [Estil](fase-05-estil.md)                                   | 0, 0b, 4    | **Feta** 20/11: set regles aplicades, cinc funcions dividides, JSON meteorològic validat; 386 proves en verd | Codex  |
| 6   | [Optimitzacions](fase-06-optimitzacions.md)                 | 1, 2        | **Feta** 20/11: dades −17,9%; recuperació `ENOSPC`; paquet inicial dins del límit                            | Codex  |
| 7   | [Prova global final](fase-07-prova-global.md)               | 3, 4, 5, 6  | Per començar                                                                                                 | —      |
| 8   | [Manuals i README](fase-08-manuals.md)                      | 7           | Per començar                                                                                                 | —      |
| 9   | [Publicar](fase-09-publicar.md)                             | 8 + decisió | **Bloquejada per una decisió**                                                                               | —      |
| 10  | [Sonar i tancament](fase-10-sonar-i-tancament.md)           | 9           | Per començar                                                                                                 | —      |

**Correccions de la revisió de qualitat, abans de la prova global:**
[repartiment Codex/Claude](revisio-qualitat-repartiment.md). Codex té
localitzador, validació FIRMS, memòria cau i proteccions de tipus; Claude,
meteorologia del domini, importació 3D i separació de responsabilitats.
La integració i els commits per mòduls es fan quan les dues parts estan
acabades i verificades, per indicació de Pere.

**Avaluació del codi del 24/11**, també repartida: la meitat de Claude
—`map/`, `simulator/`, `top-bar/`, `hotspot-panel/`— és a
[`avaluacio-del-codi-24-11.md`](avaluacio-del-codi-24-11.md), amb 88/100 i
cinc defectes, tots cinc arreglats i amb la seva regressió (§11.77). La de
Codex —`simulation/` i `api/`— va donar 88/100 i cinc defectes més, repartits
per fitxers i arreglats entre tots dos (§11.78): en queda **un obert**, la
resposta parcial de FIRMS que es desa com a completa, amb la decisió de Pere
ja presa i escrita a `tareas codex/preguntas/`. Les dues meitats, a
`tareas codex/de-codex/`. Estat verificat: 434 proves i les vuit portes en
verd.

**Les independents de debò són la 1 i la 2**: es poden fer avui, alhora, i les
dues només llegeixen. La 0 i la 0b també són independents de tot.
