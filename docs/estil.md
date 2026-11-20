# Full d'estil

Com és un fitxer d'aquest projecte. És la fase 0 de
[`pla-poliment/`](pla-poliment/README.md), i es va escrivint a mesura que es
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

### Com es comprova

ESLint comprova camps, constructor, mètodes públics/protegits i privats a
web i API. L’ordre dels camps es revisa a mà, preservant les dependències
d’inicialització. El 20/11/2026 també s’han ordenat `simulator-view.ts` i
`countermeasure-plan.ts`; ja no tenen excepcions a `member-ordering`.

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

**On som avui**: complerta a tot `web/` des del 19/11/2026 (`83b48b2`), i la
comprova el linter amb `@typescript-eslint/explicit-member-accessibility`. Els
membres que imposa una interfície de fora —`id`, `type`, `renderingMode` i
`onAdd` de `CustomLayerInterface`, a `map/agents-3d.ts` i
`map/fire-particles.ts`— són `public` explícit, que és el que ja eren.

## 3. Els imports, tots seguits

**Un sol bloc, sense cap línia en blanc enmig.** Les separacions d'avui no
diuen el mateix a tot arreu —en un fitxer separen el que ve de fora del que és
nostre, en un altre separen Angular de la resta— i una ratlla que no vol dir
sempre el mateix no val la pena. Tot seguit es llegeix d'una ullada i no s'ha
d'endevinar què vol dir el forat.

L'ordre dins del bloc es queda com està: primer el que ve de fora —Angular,
MapLibre, Fastify— i després el que és nostre, dels més generals als més
propers. Prettier no els ordena, de manera que això ho sosté qui escriu.

**On som avui**: complerta des del 19/11/2026 (§11.63). Hi havia 36 fitxers
amb línies en blanc al mig del bloc, 35 a `web/` i `api/src/app.ts`. **No la
comprova cap regla**: caldria un connector, `eslint-plugin-import-x`, que no
s'ha afegit. Prettier no la desfà, però tampoc no la manté.

## 4. Res de codi espagueti

**Una funció fa una cosa, cap en una pantalla i no s'endinsa més de dos o tres
nivells.** Si per a saber què fa cal recordar en quina branca s'és, la funció
ja és massa gran. Els camins curts —comprovar el que no val i sortir al
principi— abans que un `else` que tanca cent línies més avall.

El termòmetre és la complexitat: **cap funció per sobre de 15**. No és
l'objectiu, és el senyal d'alarma; una funció de 14 també pot ser
inintel·ligible. Ho comprova sol el linter (`complexity: ['error', 15]`) i
també Sonar, amb la seva complexitat cognitiva.

**Estat el 20/11/2026:** totes les funcions de producció passen el límit
15 d’ESLint a web i API, sense silenciadors ni excepcions per fitxer. Les
funcions del bucle de propagació es van comparar amb nou escenaris abans i
després de dividir-les: mateixos resultats, sense alentiment (§11.69).

La longitud també es revisa a mà. Pere ha aprovat dividir les cinc
funcions que quedaven amb 80 línies o més, inclòs el catàleg declaratiu de
capes. Ara totes les funcions revisades queden per sota de 80 línies;
complexitat màxima 15 al web i 13 a l’API. La fase 5 recull les etapes i
les comparacions de comportament (§11.73).

## 5. Comentaris excepcionals

**Els comentaris es treuen per defecte.** Es mantenen només quan expliquen un
comportament concret que no es pot deduir fàcilment del codi, o quan una eina
els necessita —Prettier, el linter, el compilador—, com un
`eslint-disable-next-line`. La decisió general la va prendre Pere el
20/11/2026 (§11.70); aquesta excepció s'aplica en la revisió fitxer per fitxer.
Les cites de decisions es busquen a la bitàcola, no al codi.

**Les plantilles `.html` no porten comentaris**, tampoc directives per
desactivar ESLint. Les incidències d'accessibilitat es resolen al control.
Decidit per Pere el 20/11/2026.

**On som avui**: revisió completada el 20/11/2026 a les sis carpetes de la
fase 5, també a les proves, els fitxers arrel de l’aplicació i el CSS.
La passada de comentaris conserva els tokens TS i les regles CSS.

## 6. Cicle de vida explícit

**La inicialització que es fa una sola vegada va a `public ngOnInit(): void`,
i la classe implementa `OnInit`.** Decidit per Pere el 20/11/2026: les
càrregues inicials i les accions d'entrada a una pantalla es troben en aquest
mètode. Els `effect` que reaccionen als canvis de dades i d'entrades es
registren al constructor, dins del context d'injecció d'Angular.

**La neteja d'un component va a `public ngOnDestroy(): void`, i la classe
implementa `OnDestroy`.** Decidit per Pere el 20/11/2026: els mètodes del cicle
de vida han de ser fàcils de trobar i llegir. Les dependències que necessita
aquesta neteja es declaren com a camps, amb `private readonly ... = inject(...)`.

```ts
export class MapShell implements OnDestroy {
  private readonly maps = inject(MapService);

  public ngOnDestroy(): void {
    this.maps.destroy();
  }
}
```

S'agrupa en aquest mètode la retirada de listeners, la cancel·lació de tasques
i l'alliberament de recursos que pertanyen al component. Un listener que
s'ha de retirar conserva la mateixa referència de funció en registrar-lo i
retirar-lo. Les animacions i els recursos que fan servir el mapa s'aturen
abans de destruir-lo.

**Cada recurs es neteja quan acaba la seva vida útil.** Un `effect` pot
recrear un recurs diverses vegades mentre el component continua viu:
`onCleanup` el neteja abans de la següent execució i en destruir l'efecte.
Aquesta neteja es manté dins de l'efecte. Si l'ordre de destrucció importa,
el component conserva l'`EffectRef` i el destrueix explícitament des de
`ngOnDestroy()` abans dels recursos dels quals depèn.

`afterNextRender` es conserva quan cal esperar que Angular hagi renderitzat
el DOM, com en crear MapLibre. Passar-lo a un altre hook requereix comprovar
el moment de creació i el comportament al navegador. Les classes de MapLibre
o WebGL continuen amb els seus propis contractes (`onRemove`, `dispose`):
`OnDestroy` correspon als components gestionats per Angular.

**On som avui**: aplicat a `map/map-shell.ts`,
`simulation/simulation-flow.ts`, `simulation/ignition-step.ts` i
`simulator/simulator-view.ts`. Ja no hi ha registres directes amb
`inject(DestroyRef).onDestroy(...)` a `web/src`.
La inicialització amb `OnInit` està aplicada a `simulation/region-step.ts`,
`simulation/province-step.ts`, `simulation/municipality-step.ts`,
`simulation/ignition-step.ts` i `simulation/simulation-flow.ts`.
Els efectes de `simulator/simulator-view.ts` es registren des de 13 mètodes
privats amb nom, cridats pel constructor dins del context d'injecció. El
constructor té 17 línies; els 24 efectes conserven l’ordre de registre,
i cap funció del fitxer supera la complexitat 15 d'ESLint.

## 7. Tipus explícits

**No es fan servir `any` ni `unknown` com a tipus.** És el criteri del
projecte acordat amb Pere el 20/11/2026. Cada dada ha de tenir el seu
contracte expressat amb tipus concrets, interfícies, unions o genèrics
segons el cas. També s'aplica a les proves.

Les dades externes continuen requerint validació: una asserció `as Tipus`
no demostra que un JSON compleixi el contracte. Els validadors han de
comprovar els camps abans de construir el resultat tipat.

Ho detecta ESLint a `web/` i `api/`: `@typescript-eslint/no-explicit-any` i
`no-restricted-syntax` amb el selector `TSUnknownKeyword`, totes dues com
a error. No s'afegeixen excepcions per silenciar els usos existents.

Per a dades JSON abans de validar, Pere ha aprovat `JsonValue`: una unió
explícita de text, nombres, booleans, `null`, arrays i objectes JSON. Després
de validar es retorna el contracte específic de cada dada.

**La validació es fa on entra la dada.** L’API interpreta les respostes de
FIRMS, AEMET i IPMA i exposa contractes coneguts al web. El navegador valida
els fitxers d’escenari que l’usuari hi importa directament. La descodificació
i comprovació del transport de combustibles també es manté al límit de
xarxa del frontend: els tipus estàtics no validen el JSON rebut. `JsonValue`
es limita a aquestes entrades; el model i els components reben tipus
específics després de validar.

**On som avui**: resolts els 99 usos de `unknown` que la primera passada
detectava en 33 fitxers de `web/` (42 d'aplicació i 57 de proves). Els
parsers mantenen la validació; les proves fan servir esdeveniments DOM,
fixtures completes i dobles amb contractes tipats. ESLint i la comprovació
de tipus passen. ESLint també està configurat a `api/`; resolts els seus
usos explícits i verificades les 88 proves. Les respostes meteorològiques
externes també es validen abans de convertir-les al contracte conegut.

## Per decidir

Les primeres propostes surten de llegir `map/hotspots.service.ts` junts, el
19/11/2026. La revisió del cicle de vida del 20/11/2026 hi afegeix el cas
del muntatge del mapa. La inicialització explícita i l'agrupació d'efectes
ja formen part de la regla 6; les propostes següents són pendents de decidir.

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
- **Muntatge del mapa amb nom propi.** A `map/map-shell.ts` i
  `simulator/simulator-view.ts`, valorar un mètode privat amb nom explícit
  per crear el mapa, cridat des de `afterNextRender`. Es conserva l'espera
  del renderitzat; s'ha de comprovar si el mètode aporta claredat a cada cas.
