# B1 — Repetició i reutilització

24/11/2026. Fase B de [`revisio-final.md`](revisio-final.md), la part de
Claude. Tot el projecte, les dues meitats. Només lectura: no s'ha tocat res.

## El que ha sortit, i no era el que es buscava

Buscant repetició ha aparegut **el mateix defecte que avui s'ha arreglat dues
vegades, viu a tres pantalles més**. Va primer perquè no és estil, és
comportament.

### 1. Tres passos del formulari ensenyen l'error i no deixen tornar-hi

`simulation/region-step.ts:37`, `province-step.ts:45` i el de municipis
criden `load()` **només des de `ngOnInit()`**. Els serveis sí que oblidem la
lectura fallida des de la §11.75 —`asked = false` al `catch`—, de manera que
tornar a demanar-ho funcionaria; però **res no ho torna a demanar**, i la
plantilla ensenya «No s'han pogut llegir els límits administratius» sense cap
control.

L'usuari es queda en aquella pantalla sense sortida fins que navega enfora i
torna, cosa que recrea el component i torna a passar per `ngOnInit`. És
menys greu que el de les deteccions —allà ni això funcionava—, però és el
mateix forat.

I el comentari que la §11.75 va deixar als quatre serveis diu: «sense això la
pantalla no té manera de tornar d'una fallada de xarxa passatgera». **La
promet i no la té.** El comentari descriu la meitat que es va fer.

Afecta `regions`, `provinces`, `municipalities` i `search`. El patró de
l'arreglament ja existeix dues vegades: `hotspots.service.ts` amb
`retry()` i el botó del selector (§11.77), i `terrain.service.ts` amb el del
pas d'ignició (§11.78).

## La repetició, mesurada

### 2. Nou fitxers escriuen la mateixa lectura de JSON

El bloc `fetch(url)` → `if (!response.ok) throw new Error(...)` →
`response.json() as Promise<T>` és **idèntic** a `map/places.service.ts`,
`map/study-area.ts`, `simulation/municipalities.service.ts`,
`point-locator.ts`, `provinces.service.ts`, `regions.service.ts`,
`search.service.ts`, `terrain.ts` i `simulator/weather.service.ts`.

I cinc d'ells repeteixen també, **paraula per paraula**, el comentari del
`new URL(..., document.baseURI).href`.

`provinces.service.ts` i `regions.service.ts` tenen el `load()` sencer
idèntic: la guarda, el `failed.set(false)`, la URL amb el seu comentari, el
`fetch`, el `then`, i el `catch` amb el seu comentari i el `asked = false`.
Canvien la constant de la URL i el tipus.

**Això és una funció**: llegir JSON d'una URL i queixar-se si no arriba. Amb
les regles 9 i 10 acabades d'escriure, `async` i amb el `catch` enganxat on
toca.

A l'API hi ha sis llocs de `firms.ts` i `weather.ts` amb el mateix
`if (!res.ok) throw`, cada un amb el seu format de missatge:
`FIRMS answered 503`, `AEMET: 503`, `IPMA stations: 503`.

> **Esmena del 24/11/2026.** Aquest paràgraf deia que a l'API «passa el
> mateix» i no és exacte: **només tres dels sis llegeixen JSON**. Els altres
> tres són dos CSV de FIRMS i uns bytes d'AEMET que volen ISO-8859-15. El que
> comparteixen tots sis és la comprovació de l'estat HTTP, no la lectura. Ho
> va trobar Codex en anar a fer-ho, i per això en van sortir dues funcions
> —`fetchChecked()` per a la comprovació i `readJson()` per als tres que
> parsegen— en lloc d'una de forçada.

### 3. Set fitxers oblidem la lectura fallida a mà

`map/map-agents.ts`, `map/places.service.ts`, `municipalities.service.ts`,
`provinces.service.ts`, `regions.service.ts`, `search.service.ts` i
`terrain.service.ts`. Cada un amb el seu `if` i el seu comentari.

### 4. Quatre noms per a dues idees, i una classe que ja ho fa bé

La regla 8 diu que són tres problemes. Al codi hi ha **quatre noms de camp**
per a dos d'ells:

| Fitxer | Camp | Què és |
| --- | --- | --- |
| `hotspots.service.ts` | `requests` | testimoni |
| `terrain.service.ts` | `token` **i** `last` | testimoni **i** clau |
| `weather.service.ts` | `token` i `asked` | testimoni i domini demanat |
| `fire-run.ts` | `token` | testimoni, **encapsulat** |
| `places.service.ts` | `asked` | clau |
| `municipalities.service.ts` | `asked` | clau |
| `provinces`, `regions`, `search` | `asked` | clau degenerada a booleà |

**`FireRun` és l'excepció i és el model a seguir**: el testimoni és privat i
el que es pot fer amb ell té nom —`begin`, `owns`, `publish`, `fail`,
`discard`, `abandon`—. Els altres tres repeteixen
`if (meu !== this.token) return` a cada `then` i a cada `catch`.

### 5. L'avís d'error a la pantalla, cinc vegades

`region-step.html`, `province-step.html`, `municipality-step.html`,
`ignition-step.html` i `range-picker.html`. **Només els dos últims tenen
botó**, i els dos s'han afegit avui. Els dos botons tenen classes diferents
—`retry` i `apply`— perquè el full de `step-panel.css` no en tenia cap i el
del selector sí.

### 6. Els metres a graus, cinc vegades — i això ja estava escrit

`map/agents-3d.ts:249`, `map/countermeasure-display.ts:50`,
`simulation/domain.ts:13` i `simulator/countermeasure-plan.ts:139-140`. Dos
fitxers declaren la seva pròpia constant `M_PER_DEGREE = 111_320`, un la
porta escrita dins d'una expressió i l'altre dues vegades; i el
`Math.cos(lat · π / 180)` que converteix longituds hi va al costat cada
vegada. També a `simulation/countermeasures.ts`.

És la repetició amb més risc de totes les d'aquest informe, perquè no és
forma: **és aritmètica de coordenades**. Si un dia es canvia el valor o la
latitud de referència, cal canviar-ho a cinc llocs i res no avisa si se
n'oblida un.

> **Això ja ho sabia el projecte.** El punt 7 de
> [`../inventari-web.md`](../inventari-web.md), de la fase 1, ho té escrit
> amb els cinc llocs. Aquest informe no ho duia: la primera passada de B1 va
> buscar repetició al codi i **no va llegir l'inventari que la fase 1 ja
> havia fet**, que és justament el que el `CLAUDE.md` demana abans de
> proposar res. Hi va arribar de rebot, mirant una referència vella que
> Codex havia assenyalat. El punt 5 del mateix inventari també llista una
> dotzena d'`export` sobrers que coincideixen amb el que B2 ha trobat avui.

## On hauria de viure cada cosa

Sense carpeta `utils/`: Pere ho ha descartat i l'estructura d'aquest projecte
és per domini. La proposta:

- **La lectura de JSON del web**: a `simulation/`, que és la carpeta que les
  dues meitats del web ja importen —`map/study-area.ts` importa
  `simulation/bounds`— i que és un domini tancat, no un calaix. A l'API, al
  costat de les fonts.
- **El testimoni amb nom**: també a `simulation/`, i amb les seves proves. El
  contracte el dicta `FireRun`, que ja existeix i funciona.
- **La deduplicació per clau**: una tercera cosa, i amb un nom que no es
  confongui amb l'anterior.
- **L'avís i el botó**: un component petit, perquè el text canvia i la forma
  no. Però això toca el full compartit dels passos i la mida del paquet, i
  és el que menys corre.

## El que he mirat i no cal tocar

- Els càlculs del model no es repeteixen: `rothermel.ts`, `fire-spread.ts` i
  `fuel-treatments.ts` tenen cada un la seva feina.
- Els `as GeoJSONSource` de `map.service.ts` semblen repetició i no ho són:
  estrenyen una unió de MapLibre i cada un va a la seva font.
- Els tipus no es dupliquen: `Range`, `Point`, `Observation` i `Terrain`
  tenen un sol lloc i els altres els importen.

## El que no he pogut avaluar

Si unificar la lectura de JSON mou codi cap al paquet inicial. La proposta de
posar-la a `simulation/` ho hauria d'evitar —el simulador ja és un tros
diferit—, però **s'ha de mesurar abans i després**, i avui el tros gros són
1,06 MB.
