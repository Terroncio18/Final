# C — Què s'arregla, i en quin ordre

24/11/2026. Fase C de [`revisio-final.md`](revisio-final.md): els sis
informes llegits junts, amb una proposta per cada cosa. **Res no s'ha tocat
encara.** Pere decideix; el que hi ha aquí és el criteri de Claude, perquè
ho va deixar al seu criteri.

Les set coses de dalt són **comportament**: o el programa fa una cosa
equivocada, o no fa la que havia de fer. Les de baix són estil i deute. Si
només es fes la primera tanda, el projecte ja estaria millor que ara.

## S'arregla, i va primer

### 1. Un combustible equivocat per un índex (B4 de Codex)

`api/src/fuels.ts:135-147`. Un WorldCover retallat pot indexar **la fila
següent** i assignar a una cel·la un model de combustible vàlid però
equivocat, sense cap avís. Va primer de tot: en un simulador d'incendis, el
combustible és l'entrada que més mana sobre el resultat, i aquest error no
es veu perquè el que surt és plausible.

La prova que falta és un doble de cobertura parcial; avui totes fan servir el
quadre complet.

### 2. El càlcul pot petar abans del `try` que el protegeix (B4 de Claude)

`web/src/app/simulator/simulator-view.ts:760`, i el `void` de `:1005`. Si
`beds[1]` no hi fos, no s'executaria cap de les tres proteccions d'aquell
`try` —ni restaurar el pla, ni els vents, ni dir-ho a la pantalla— i des de
`:1005` seria un rebuig no gestionat. Dues línies.

### 3. Tres pantalles ensenyen l'error i no deixen tornar-hi (B1)

`region-step`, `province-step` i `municipality-step`. El patró ja existeix
dues vegades al projecte, de les §11.77 i §11.78: un mètode que torna a
demanar-ho i un botó. I s'ha d'esmenar el comentari dels quatre serveis, que
promet una sortida que no hi és.

### 4. La memòria cau de combustible accepta el que el web rebutja (B4 de Codex)

`api/src/fuels.ts:319-363`. Un fitxer ben format però incoherent
—`UNKNOWN` amb qualitat que no és 0, comptadors que no quadren amb les
tripletes— passa la validació del servidor i el navegador el rebutja. Serveix
una resposta invàlida fins que caduca.

### 5. Els set refusos de meteorologia no diuen què es diu (B3 de Claude)

`api/tests/routes.test.ts:300-313`. Afegir l'expressió regular per cas, com ja
es fa catorze línies més amunt. És una prova, no codi, i és barat.

### 6. Tres proves comparteixen el càlcul que havien de contrastar (B3 de Codex)

`simulation/model-edges.spec.ts:41-48` i `fire-spotting.spec.ts:14-18`
construeixen l'esperança amb el codi que proven, i el doble de
`simulator/weather-panel.spec.ts:27-37` accepta dominis que el servei real
rebutja perquè no compara latitud. Les dues primeres volen un valor esperat
escrit a mà; la tercera, que el doble digui el que diu la classe.

> **Fet a mitges, i comprovat per mutació el 24/11/2026.** Els límits del
> domini, clavats a valors calculats a part: treure el `cos(latitud)` de
> `domainAround()` ara fa caure la prova. La llavor de les brases i la seva
> cel·la, clavades a 1 i 137: desplaçar la seqüència aleatòria ara la fa
> caure també. **Però el canvi de trajectòria continua passant
> desapercebut**: multiplicar la intensitat per 2,5 no mou ni la llavor ni la
> cel·la, perquè en aquell escenari la destinació no depèn de la intensitat.
> O sigui que la meitat de la troballa de Codex segueix oberta, i clavar
> valors no la tanca: **caldria una prova pròpia d'`emberFlight()` amb una
> distància calculada a mà**, que és més feina i no entrava aquí. Queda a la
> llista.

### 7. Referències a fitxers que ja no existeixen (B2 de Codex)

`web/angular.json:84` i `web/vitest.config.ts:14` encara nomenen
`fire-appearance` i `fire-field` a les llistes de cobertura, i
`docs/ajuda-foc-codex.md` i `docs/inventari-web.md` també. Es van retirar a
la §11.66. És net i no toca codi d'aplicació.

## S'arregla després, i d'una en una

### 8. La repetició, aplicant les regles 8, 9 i 10

És el gruix de B1 i el que més codi mou, i per això va després del
comportament. Tres coses, **en aquest ordre**:

1. **La lectura de JSON**, repetida a nou fitxers del web i sis de l'API. Una
   funció, `async`, amb el `catch` enganxat on toca. És la que més estalvia i
   la que menys risc té.
2. **Oblidar la lectura fallida**, set vegades a mà, que ha d'anar dins de la
   cosa del punt 3.
3. **El testimoni amb nom**, el de la regla 8. `FireRun` ja és el model: no
   s'ha d'inventar, s'ha de generalitzar. Van amb ell els quatre noms de camp
   per a dues idees.

I abans d'aquests tres, la que no era a la llista i és la pitjor: **la
conversió de metres a graus**, que B1 va afegir després.

Cada punt és una tanda pròpia, amb les vuit portes en verd i **el paquet
mesurat abans i després**: avui el tros gros són 1,06 MB i no pot créixer.

> **Fet 24/11/2026: la conversió de metres a graus.** A `simulation/geo.ts`,
> amb `M_PER_DEGREE`, `degreesFor`, `metresFor` i `offsetBy`, i tres proves
> amb valors calculats a part. Eren **quatre** llocs, no cinc: un va
> desaparèixer en els refactors anteriors. **Cap número canvia**: cada lloc
> rep la latitud que li toca —la del punt a tres d'ells, la mitjana al llarg
> d'un segment—, perquè unificar aquella tria hauria alterat els llargs
> mesurats dels plans que ja existeixen. El tros gros del paquet passa de
> 1.063.338 a **1.063.582 bytes**, 244 més; el total baixa 204. Ha crescut,
> poc, i es diu amb el número.

### 9. L'avís i el botó, un component

Cinc plantilles tenen l'avís d'error i només dues tenen botó. Va l'últim
perquè toca `step-panel.css`, que és el full compartit dels quatre passos, i
perquè afegir un component petit pot moure el paquet. **Si la fase 7 diu que
els avisos s'han de veure sense obrir cap panell, això canvia, i llavors val
més fer-ho junt amb el que digui Pere després de provar-ho.**

## No s'arregla, i per què

- **El contracte `Observation` declarat dues vegades** (B3 de Claude). Unificar
  els tipus entre les dues meitats vol un paquet compartit o generació de
  tipus, i això és arquitectura, no neteja. El que sí val la pena és **una
  prova que travessi la costura sencera**, i va amb el punt 5.
- **`config.test.ts:57`** compara dos derivats entre ells. És menor i aquell
  fitxer és una xarxa sobre la configuració, no una prova de comportament.
- **`app.spec.ts:15`**, l'assercio feble. Les comprovacions del DOM del mateix
  fitxer ja fan la feina.
- **Els quatre estats de WebGL de `fire-particles.ts`**. No es pot confirmar
  llegint i pot ser inofensiu. Primer la fase 7; si res es veu malament, es
  deixa com està i s'escriu per què.

## Ho decideix Pere

**L'avís de cobertura parcial del GeoTIFF.** La pregunta de Codex és a
`tareas codex/preguntas/05-b4-cobertura-worldcover.md` i no està contestada:
quan el fitxer es llegeix bé però no cobreix tota la caixa, la resposta
pública ho ha de dir, distingint-ho de «font inaccessible», o n'hi ha prou
amb `unknownCells` i el `no-store` que ja hi són?

Va al punt 1 o just després, perquè toquen el mateix fitxer.

## El repartiment, per fitxers

**Codex, a `api/`**: els punts 1, 4 i 5, i la meitat d'API del punt 8.1. I
l'avís del GeoTIFF quan Pere contesti.

**Claude, al web**: els punts 2, 3, 6 i 7, i la meitat de web del punt 8.

Les llistes de fitxers s'escriuen a l'encàrrec abans de començar, com sempre,
i ningú commiteja.
