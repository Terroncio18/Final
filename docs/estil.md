# Full d'estil

Com és un fitxer d'aquest projecte. És la fase 0 de
[`pla-poliment.md`](pla-poliment.md), i es va escrivint a mesura que es
decideix: el que hi ha aquí està decidit i es pot aplicar; el que és al final,
a «Per decidir», encara no.

**El que Prettier ja decideix no es discuteix aquí**: cent columnes, cometes
simples, comes finals, on van els salts de línia. Això és `web/.prettierrc` i
es comprova amb `npx prettier --check .`. Aquest document és l'altra meitat: la
que cap eina no mira.

## 1. L'ordre de dins d'una classe

Primer l'estat, i després el que fa coses. Tot l'estat va **just després de la
capçalera de la classe**, en aquest ordre:

1. **Entrades i sortides** —`input()`, `output()`, `model()`—, que és el
   contracte amb qui fa servir el component: el primer que vol veure qui hi
   arriba.
2. **Injeccions** (`inject(...)`): de qui depèn.
3. **Senyals** (`signal`, `toSignal`): l'estat que canvia.
4. **Constants i derivats** (`computed`, i les constants de la classe): el que
   se'n dedueix i el que no canvia mai.
5. **El constructor**, si n'hi ha.
6. **Mètodes públics i protegits**: el que es pot demanar a aquesta classe.
7. **Mètodes privats**: com se'n surt.

La idea és que qui obre el fitxer llegeixi de fora cap a dins: primer què rep i
de què depèn, després què recorda, i al final com ho fa. Qui només vol
fer-la servir no ha de passar del punt 6.

Les constants de mòdul —les que no són de cap instància— van **abans de la
classe**, sota els imports, que és on es busquen.

<details>
<summary>Com queda <code>map/hotspots.service.ts</code></summary>

```ts
@Injectable({ providedIn: 'root' })
export class HotspotsService {
  // 2. injeccions
  private readonly maps = inject(MapService);
  private readonly router = inject(Router);
  private readonly area = inject(StudyArea);

  // 3. senyals
  private readonly navigated = toSignal(...);
  readonly loading = signal(false);
  readonly failed = signal(false);
  private readonly answer = signal<FeatureCollection | null>(null);
  readonly earliest = signal<string | null>(null);
  private asked = 0;

  // 4. derivats
  readonly range = computed<Range>(...);
  readonly count = computed(...);

  // 5. constructor
  constructor() { ... }

  // 6. públics
  choose(range: Range): void { ... }
  reset(): void { ... }

  // 7. privats
  private stampWhen(...): void { ... }
  private load(range: Range): void { ... }
}
```

No té entrades ni sortides perquè és un servei. **És el fitxer on es va
aplicar primer**, el 19/11/2026, i serveix d'exemple: abans barrejava els
punts 3 i 4 —`range` i `count` eren entre els senyals—, i de passada se li van
posar els modificadors de la regla 2 i es va tancar el bloc d'imports de la
regla 3. Vint-i-dues línies canviades, cap de comportament, i les 281 proves
segueixen passant.

</details>

### Qui no la compleix, avui

Mirat el 19/11/2026 sobre les 37 classes de `web/src/app`: **30 ja la
compleixen** i 7 barregen els grups. La primera, `map/hotspots.service.ts`, ja
està feta; queden `map/map-view.ts`, `simulation/ignition-step.ts`, `simulation/search.service.ts`,
`simulator/countermeasure-plan.ts`, `top-bar/range-picker.ts` i
`simulator/simulator-view.ts`. A cinc d'elles és moure dues o tres línies.

Les altres dues són un cas a part, i és una pregunta oberta: `simulator-view.ts`
—2.169 línies, més de vuitanta peces d'estat— i `countermeasure-plan.ts` no
estan desordenades per descuit, sinó **agrupades per tema**: el senyal i el
derivat d'una mateixa cosa, un al costat de l'altre. Posar-les per tipus
escamparia coses que es llegeixen juntes al llarg de mil línies. O s'hi aplica
igualment, o la regla val per blocs dins del fitxer, o el que cal no és
reordenar sinó partir el component. Decidir-ho és part de la fase 5.

## 2. Cap membre sense dir qui el pot veure

**Res dins d'una classe es queda sense `private`, `protected` o `public`:
ni els camps ni els mètodes.**
TypeScript deixa posar `readonly nom = signal(0)` i entendre-ho com a públic,
però «públic per omissió» vol dir que ningú no ho ha decidit: qui llegeix no
sap si és part del contracte de la classe o és que algú no hi va pensar. Si
ho és, que ho digui.

```ts
private readonly maps = inject(MapService);   // de dins
protected readonly compassTurn = computed(…);  // per a la plantilla
public readonly loading = signal(false);       // per a qui faci servir la classe
```

En una classe d'Angular els tres tenen un sentit propi i no és cap formalitat:
`protected` és el que veu la plantilla i no el món, i `private` és el que es
pot canviar sense mirar qui més ho fa servir.

**On som avui**, mirat el 19/11/2026 sobre `web/src/app`: dels camps, 295 duen
modificador i **79 no**; dels mètodes, 160 el duen i **240 no**. Són 31
fitxers. Part dels que no en duen són obligats per una interfície de fora
—`id`, `type`, `renderingMode` i `onAdd` de `CustomLayerInterface`, a
`map/agents-3d.ts` i `map/fire-particles.ts`—: aquests passen a `public`
explícit, que és el que ja són.

Això no és feina de llegir-s'ho tot: és la regla
`@typescript-eslint/explicit-member-accessibility`, que un linter comprova i
arregla sol —els 319 membres, amb una ordre—. És un argument a favor de la
12.28.

## 3. Els imports, tots seguits

**Un sol bloc, sense cap línia en blanc enmig.** Les separacions d'avui no
diuen el mateix a tot arreu —en un fitxer separen el que ve de fora del que és
nostre, en un altre separen Angular de la resta— i una ratlla que no vol dir
sempre el mateix no val la pena. Tot seguit es llegeix d'una ullada i no s'ha
d'endevinar què vol dir el forat.

L'ordre dins del bloc es queda com està: primer el que ve de fora —Angular,
MapLibre, Fastify— i després el que és nostre, dels més generals als més
propers. Prettier no els ordena, de manera que això ho sosté qui escriu.

**On som avui**: de 101 fitxers amb imports, **37 tenen línies en blanc** al
mig del bloc, gairebé sempre una.



## 4. Res de codi espagueti

**Una funció fa una cosa, cap en una pantalla i no s'endinsa més de dos o tres
nivells.** Si per a saber què fa cal recordar en quina branca s'és, la funció
ja és massa gran. Els camins curts —comprovar el que no val i sortir al
principi— abans que un `else` que tanca cent línies més avall.

El termòmetre és la complexitat: **cap funció per sobre de 15**. No és
l'objectiu, és el senyal d'alarma; una funció de 14 també pot ser
inintel·ligible. Ho comprova sol el linter (`complexity: ['error', 15]`) i
també Sonar, amb la seva complexitat cognitiva.

**On és l'espagueti, avui.** De 329 funcions amb nom, **13 passen de 15**, i
quatre són les que de debò pesen:

| Funció | Complexitat | Línies |
| --- | --- | --- |
| `simulation/fire-spread.ts` · `spreadRun()` | ~185 | 483 |
| `simulation/countermeasures.ts` · `finite()` | ~91 | 153 |
| `simulator/simulator-view.ts` · `constructor()` | ~84 | 443 |
| `simulation/scenario.ts` · `readScenario()` | ~52 | 123 |

Per fitxer, Sonar diu el mateix: `fire-spread.ts` (complexitat cognitiva 365),
`simulator-view.ts` (285) i `countermeasures.ts` (199) són els tres que
concentren el problema.

**Un avís abans de desfer el primer**: `spreadRun()` és el bucle que recorre
la graella cel·la a cel·la —1.024² cel·les— i partir-lo en funcions petites es
paga en temps de càlcul. Aquí la claredat i la velocitat estiren cap a
costats diferents, i la §11.36 diu que el càlcul ha d'anar per sota del segon.
Es parteix, però mesurant abans i després; si costa massa, el que es fa és
deixar-lo sencer i explicar per què, que també és una decisió.

## Per decidir

Surten de llegir `map/hotspots.service.ts` junts, el 19/11/2026. Cap no s'ha
aplicat encara.

- **Com es diu «aquesta resposta ja no la vull».** El mateix problema està
  resolt de dues maneres: un comptador a `map/hotspots.service.ts`
  —`asked`, i tres `if (token !== this.asked) return`— i un `AbortController`
  a `simulation/fuel.service.ts`. Una de les dues ha de ser la del projecte.
- **Cadena de promeses o `async`/`await`.** `load()` és
  `.then().then(async …).catch()`, amb un `await` dins d'un `then`; tota l'API
  està escrita amb `async`/`await`.
- **Com es diu «això no l'espero».** `void this.router.navigate(...)` en un
  lloc i `writeSource()` —que sí que enganxa un `catch`— a l'altre.
- **El prefix dels missatges de consola.** `[hotspots]`, `[firms]`, `[map]`:
  ja es fa, només cal escriure-ho.
- **Les llengües.** Comentaris i noms en anglès; pantalla, bitàcola i manuals
  en català. També es fa ja.
- **Índexs per a escurçar els imports.** Plantejat per Pere el 19/11/2026 com
  a cosa de més endavant: un `index.ts` per carpeta que reexporti el que en
  surt, de manera que un import llarg passi a ser `from '../simulation'`. El
  que cal mirar abans de fer-ho: a Angular, un índex que ho reexporta tot pot
  arrossegar codi cap al paquet inicial i desfer la separació en trossos que
  avui deixa el simulador i les figures 3D fora de la primera càrrega (1,5 MB
  contra 0,7 MB). Val la pena per carpeta tancada —`simulation/` i `map/` ho
  són—, i mesurant el paquet abans i després.
