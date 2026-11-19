# Pla de poliment

Demanat per Pere el 19/11/2026, abans del manual d'usuari: deixar l'aplicació
acabada —provada, sense codi mort, amb un estil únic i llegible, optimitzada,
documentada i publicada—. Aquest fitxer és el contracte entre els qui hi
treballen: Pere, Claude i Codex. **Qui agafa una fase hi posa el seu nom aquí
abans de començar**, i l'estat quan la deixa.

La xarxa de seguretat ja hi és: 97,9 % de cobertura i 0 avisos de Sonar
(§11.62). Esborrar i refer coses té avui un cost que fa un mes no tenia.

## Les regles de treballar-hi dos alhora

1. **Dos no toquen mai el mateix fitxer al mateix temps.** El repartiment és
   per carpetes, no per tasques: `web/src/app/{map,simulator,top-bar,hotspot-panel}`
   d'una banda, `web/src/app/simulation` i `api/` de l'altra.
2. **Qui acaba una fase, commiteja i avisa.** Res de deixar fitxers oberts:
   la feina de Codex del 19/11 es va quedar sense desar i va caldre rescatar-la
   (§11.62).
3. **Cada fase acaba en verd**: les proves passen, compila i `prettier --check`
   no diu res. Si una fase deixa alguna cosa vermella, no està acabada.
4. **El que es decideixi, a la bitàcola**, com sempre: fitxer nou a `fase-2/`
   i una línia a l'índex.

## Les fases

| # | Fase | Depèn de | Es pot partir |
| --- | --- | --- | --- |
| 0 | El full d'estil | — | No: l'ha d'escriure un de sol |
| 1 | Inventari del que sobra i del que fa mal | — | **Sí**: web i api alhora |
| 2 | Provar l'aplicació sencera | — | És de Pere, amb guió |
| 3 | Arreglar el que surti de l'1 i el 2 | 1, 2 | Sí, si les llistes no es creuen |
| 4 | Treure el codi mort | 1 | Sí, per carpetes |
| 5 | Passar-hi el full d'estil | 0, 4 | Sí, per carpetes, mai el mateix fitxer |
| 6 | Optimitzacions | 1, 2 | Sí, si no toca el que toca la 5 |
| 7 | Prova global final, amb UI | 3, 4, 5, 6 | És de Pere |
| 8 | Manuals i README | 7 (els esborranys, abans) | Sí: un manual cadascú |
| 9 | Publicar | 8, i una decisió | No |
| 10 | Sonar i tancament | 9 | No |

**Les independents de veritat són la 1 i la 2**: es poden fer avui i alhora,
i les dues només llegeixen. Tot el que ve després menja de les seves llistes.

### 0. El full d'estil

Un document curt —`docs/estil.md`— que digui com és un fitxer d'aquest
projecte. Primer el que val per a tots: l'ordre de dins (capçalera que diu què
fa i per què, imports, tipus, constants, el que s'exporta, els ajudants a
sota), que els comentaris expliquin **per què** i no què, que no hi hagi
abreviatures ni noms d'una lletra, que una funció càpiga a la pantalla i que
el que sigui llest es deixi per al que no es pot fer d'una altra manera.
Després, les variacions per tipus: servei d'Angular, component, prova,
plantilla HTML, CSS, script `.mjs`, configuració. Prettier ja decideix les
cometes i les comes; això és l'altra meitat, la que una eina no pot mirar.

### 1. Inventari

Només llegir i escriure dues llistes a `docs/`. Què s'hi busca: codi mort
—fitxers que ningú importa, exports que ningú fa servir, branques impossibles,
`TODO` vells—, duplicació, funcions massa llargues o massa llestes, noms que
menteixen, dependències que no es fan servir, i on es gasta el temps i els
bytes. **Surt d'aquí la 12.15**: `fire-field.ts` i `fire-appearance.ts` tenen
proves però no els fa servir ningú, i cal decidir si es treuen o es queden com
a alternativa.

### 2. Provar l'aplicació sencera

La fa Pere al navegador, amb un guió escrit abans: cada pantalla, cada camí i
els casos lletjos —sense clau de FIRMS, sense dades de combustible, sense
xarxa, una detecció al mar, un domini a la frontera, la finestra estreta—.
Surt una llista de defectes, cadascun amb com reproduir-lo.

### 3. Errors

El que diguin la 1 i la 2, ordenat per si trenca o només molesta. Cada arreglo
amb la seva prova, que per això n'hi ha.

### 4. Codi mort

Treure. Amb el 97,9 % cobert, si després de treure una cosa les proves
segueixen verdes i la pantalla també, no feia falta. El que es tregui s'escriu
a la bitàcola: a la memòria hi ha d'anar **el que es va provar i no es va
quedar**, que és la part que explica les decisions.

### 5. Estil

Passar el full de la fase 0 per tot el codi. És la fase que toca més fitxers,
i per això va després de la 4 —no es poleix el que s'ha de treure— i per
carpetes separades. No canvia comportament: les proves han de passar sense
tocar-les.

### 6. Optimitzacions

Amb números al davant, no d'intuïció. Candidats que ja es veuen: el paquet
inicial és d'1,5 MB —abans de les dades—, `web/public/data` són 25 MB de
geometria que es publiquen tal qual, i el cau de combustible de l'API té una
política de neteja que no s'ha mesurat mai amb el disc ple.

### 7. Prova global final

El mateix guió de la 2, sencer, amb tot ja arreglat. I la suite automàtica, la
compilació i Sonar. És la porta de la 8.

### 8. Manuals i README

El manual d'usuari és la pendent 12.18 i ha de dir el que la pantalla no diu
(§11.34): què fa cada eina, les hipòtesis del model i que això no serveix per
a decidir en una emergència. Al costat, un manual d'instal·lació —claus,
dades preparades, ordres— i els README del repositori, que avui no n'hi ha
cap a l'arrel.

### 9. Publicar

**Aquí hi ha una decisió abans de res**, i és la que pot moure la resta del
pla: a Vercel hi va bé el `web/`, que és estàtic, però **l'API no hi encaixa
tal com és**. És un servidor Fastify que viu, i a Vercel seria una funció que
neix i mor a cada petició: perdria els tres caus que té en memòria —les
deteccions, la taula de disponibilitat, les observacions—, el cau en disc del
combustible (`api/data/cache`) i el comptador que limita a dues preparacions
alhora. A més, els 21 MB de dades de combustible preparades no són al
repositori.

Les tres sortides, i cap és dolenta:

- **El web a Vercel i l'API en un servidor que viu** (Render, Fly, Railway, una
  màquina). És el que menys toca el codi: el que canvia és d'on penja `/api`.
- **Tot a Vercel**, amb l'API com a funcions: s'ha de decidir on viuen les
  dades i què es fa amb els caus. Toca codi i la memòria ho ha d'explicar.
- **Només el web a Vercel**, amb l'API apagada i les dades congelades per a la
  demostració. Barat, però deixa de ser una aplicació que respon.

### 10. Sonar i tancament

L'últim escàner, el panell per a la memòria i una etiqueta a la versió que es
defensa.
