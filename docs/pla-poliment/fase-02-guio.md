# Fase 2 — El guió

Escrit amb Pere el 19/11/2026. El passa Pere al navegador, en **quatre
seients**: cada bloc es tanca sol i es pot deixar per un altre dia sense
perdre el fil.

## Com s'anota un defecte

Cada defecte, una línia a «La llista» del final, amb tres coses: **com es
reprodueix**, **què s'esperava** i **què ha passat**. Sense les tres, la fase 3
no el pot ordenar.

I una separació que estalvia feina: **defecte** és el que no fa el que diu que
fa; **no m'agrada** és el que funciona i no et convenç. Els segons van a una
llista a part al final, perquè la fase 3 només arregla els primers.

## Els dos escenaris de referència

Fixos per a tot el pla: la fase 6 compara temps entre passades i la 7 els torna
a passar, i això només val si són els mateixos.

| | Oficial | Estimat |
| --- | --- | --- |
| On | Mallorca, `ES53/ES532/ES_07061` | un municipi de la península |
| Per què | l'únic conjunt oficial preparat és `ideib-balears-20261019` | fora de les Balears la procedència cau a estimada |
| Es comprova que | el recompte de cel·les oficials és més de zero | totes les cel·les són estimades i surt l'avís |

Tria el de la península una vegada, escriu-lo aquí, i no el canviïs més.

---

## Seient 1 — La portada

A punt: l'API engegada amb la seva clau, `/peninsula` obert.

1. **Focus actius.** Carrega `/peninsula`. Han de sortir deteccions sense tocar
   res. Si no en surt cap, mira `/api/health`: si diu `firmsKey: missing` no és
   un defecte de la portada, és la clau.
2. **La llegenda.** Que el que explica es correspongui amb els colors del mapa.
3. **Dates i presets.** Passa pels presets un per un. A cada un, el rang que
   queda escrit ha de ser el que el preset diu.
4. **Un rang a mà** que no sigui cap preset. I un **rang imposible** (final
   abans del principi): ha de dir alguna cosa, no quedar-se en blanc.
5. **El comptador per territori.** Que la suma per territoris quadri amb el
   total de deteccions que es veuen.
6. **Obrir una detecció.** El panell ha de dir d'on surt i quan.
7. **El botó al simulador.** Ha d'obrir-se en una pestanya nova, sense barra
   de dalt i sense deteccions.
8. **`/canaries`.** El mateix enquadrament però a les Canàries, i que les
   deteccions siguin d'allà.

Tanca: les línies de defectes del bloc 1.

---

## Seient 2 — El formulari

A punt: `/simulacio`.

1. **Els quatre nivells**, en ordre: comunitat → província → municipi →
   ignició. A cada pas, que el que es tria es vegi reflectit al mapa de sota.
2. **El mapa no es destrueix.** Entre pas i pas, el mapa de sota no ha de
   pampallugar ni tornar a carregar-se: és el motiu pel qual `MapShell` porta
   el camí buit. Si parpelleja, és un defecte.
3. **El cercador.** Busca un municipi pel nom. Busca'n un amb accent. Busca una
   cosa que no existeix.
4. **L'enllaç compartit.** Copia la URL d'un pas qualsevol, obre-la en una
   finestra nova i comprova que arriba al mateix lloc.
5. **Una URL feta a mà amb un codi que no existeix** (`/simulacio/ES99`): ha de
   caure a la portada, no en una pantalla trencada.
6. **El botó enrere** del navegador, pas a pas cap enrere fins a la portada.

Tanca: les línies de defectes del bloc 2.

---

## Seient 3 — El simulador

A punt: els **dos** escenaris de referència, un darrere l'altre. Tot el bloc es
passa dues vegades, i a la llista s'anota amb quin dels dos ha sortit.

1. **Posar ignicions**: una, i després tres. Treure'n una.
2. **El vent**: direcció i velocitat. Que el foc s'estiri cap on bufa.
3. **El combustible.** A Mallorca, el recompte de cel·les oficials ha de ser
   més de zero. A la península, han de ser totes estimades **i ha de sortir
   l'avís**; si no surt, és un defecte, perquè una simulació estimada que no
   es presenta com a estimada enganya.
4. **Les contramesures**, les **brigades** i els **mitjans aeris**: posar-ne,
   treure'n, i que el que es posa es vegi al mapa.
5. **La vista 3D**: entrar-hi i sortir-ne, i que en sortir el 2D segueixi bé.
6. **Desar i carregar** un escenari. Carregat, ha de quedar igual que quan es
   va desar: ignicions, vent, contramesures, tot.
7. **El panell de xifres** (§11.63, no s'ha provat mai al navegador): la nota
   de la vora del domini, i que **«No hi arriba»** i **«T + …»** surtin quan
   toca i no quan no toca.
8. **La línia de temps** (§11.63): movent-la, les flames s'han d'animar i
   redibuixar-se. Que no es quedin quietes ni desapareguin.
9. **El temps de càlcul.** Apunta'l a tots dos escenaris. La §11.36 demana per
   sota del segon; si no hi és, no l'arreglis aquí, només escriu la xifra —és
   feina de la fase 6.

Tanca: les línies de defectes del bloc 3, amb la xifra del punt 9.

---

## Seient 4 — Els casos lletjos

**Abans de començar, llegeix això.** Les dades preparades no són al
repositori: `api/data/fuels` són 21 MB, amb el conjunt oficial i 22 fitxers
de cau. Si es perden, s'han de tornar a preparar. Les mous de lloc i **les
tornes**; no les esborres mai. Fes-ho d'un en un i desfés cada cas abans del
següent.

### Els quatre d'avaria

| Cas | Com es munta | Com es comprova que és de debò | Què s'espera |
| --- | --- | --- | --- |
| **Sense clau de FIRMS** | comenta `FIRMS_MAP_KEY` a `api/.env` i reengega l'API | `/api/health` diu `firmsKey: missing` | ho diu clar; no una pantalla buida sense explicació |
| **Sense combustible preparat** | reanomena `api/data/fuels` a `api/data/fuels-apart` i reengega | la crida del combustible ja no troba el conjunt | cau a estimat a tot arreu, amb l'avís; o un error que s'entén |
| **Sense xarxa** | el mode offline de les eines del navegador | la pestanya diu que no hi ha xarxa | el que ja estava carregat segueix; el que falta ho diu |
| **FIRMS caigut, amb cau** | carrega `/peninsula` primer perquè el cau s'ompli, i **després** bloqueja `firms.modaps.eosdis.nasa.gov` amb el bloqueig de peticions del navegador i torna a demanar el rang | `/api/health` llista el rang a `cached` amb la seva edat | serveix el cau i diu de quina edat és |
| **FIRMS caigut, sense cau** | reengega l'API —el cau de deteccions és en memòria i mor amb ella— i bloqueja FIRMS abans de carregar res | `/api/health` té `cached` buit | el 502 que ja hi és, i la pantalla ho explica |

Desfés-ho tot i torna a comprovar `/api/health` abans de passar als cinc de
sota: han de tornar a dir `present`, i `api/data/fuels` ha de tornar a ser al
seu nom.

### Els cinc del navegador

1. **Una detecció al mar.** Que no intenti simular-hi, o que digui per què no.
2. **Un domini a la frontera** (un municipi de la ratlla amb Portugal o
   França). Que la vora no quedi tallada sense dir-ho.
3. **Un escenari antic**: carrega un escenari desat abans dels canvis d'avui.
   Que carregui o que digui que no pot, no a mitges.
4. **La finestra estreta.** Estreny-la fins que les tres columnes del
   simulador no hi càpiguen.
5. **El mòbil.** Al telèfon de debò, no només a les eines del navegador: la
   portada, triar un municipi i obrir el simulador.

Tanca: les línies de defectes del bloc 4.

---

## La llista

Buida fins que es passi el guió. Una línia per defecte, i la fase 3 l'ordena.

| # | Bloc | Com es reprodueix | Què s'esperava | Què ha passat |
| --- | --- | --- | --- | --- |

### I el que no m'agrada

Funciona i no convenç. No és feina de la fase 3.
