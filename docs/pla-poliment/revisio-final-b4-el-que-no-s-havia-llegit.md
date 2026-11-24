# B4 — El que no s'havia llegit a fons, al web

24/11/2026. Fase B de [`revisio-final.md`](revisio-final.md), la part de
Claude: les ~1.900 línies de `simulator/simulator-view.ts` i
`countermeasure-plan.ts` que l'avaluació del matí va llegir per estructura, i
el 3D de `map/`, que només es va mirar pel cantó de l'alliberament de
recursos. Només lectura.

## Les troballes

### 1. El càlcul pot petar abans del `try` que el protegeix

`simulator/simulator-view.ts:760` fa `const { bed, midflame } = beds[1];`, on
`beds` ve de `fuelBedsFor()` (`:918-928`), que retorna un
`Record<number, …>` indexat per `model.id`. **No és un array**: `beds[1]` hi
és només si `FUEL_MODELS` conté un model amb id 1. És una invariant de la
configuració que res no comprova.

El que ho fa valer la pena és **on** és aquesta línia: al cos de `start()`,
**vuit línies abans del `try`** de la línia 768. Si mai hi faltés, no
s'executaria cap de les tres proteccions que aquell `try` porta: no es
restauraria el pla anterior, no es restaurarien els vents, i
`this.runs.fail()` no diria res a la pantalla. El testimoni es quedaria
obert i la consola diria «computing» per sempre.

I pitjor segons qui la cridi: a `:703` s'espera amb `await`, però a `:1005`
és `void this.start(this.minutes(), before)`. Allà el rebuig no té ningú que
l'esculli: **és un rebuig no gestionat**, que és exactament el cas de la
regla 10 que s'acaba d'escriure.

Dues coses petites el resolen: moure la lectura dins del `try`, o comprovar
la invariant. No és una troballa de rendiment ni d'estil: és el camí d'error
d'una execució que no passa pel seu propi camí d'error.

### 2. Les partícules deixen quatre estats de WebGL canviats

`map/fire-particles.ts:245-262`. En acabar de dibuixar, el codi restaura amb
cura tres coses —`depthMask(true)`, el VAO anterior que havia desat, i el
búfer a `null`— i **no en restaura quatre**: `gl.enable(gl.BLEND)`,
`gl.enable(gl.DEPTH_TEST)`, `gl.depthFunc(gl.LEQUAL)` i el darrer
`gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` del fum. El `draw()` privat
també deixa el seu `useProgram` posat.

L'asimetria és el que crida l'atenció: algú va pensar quins tres calia
tornar a deixar com estaven i no va dir per què els altres quatre no. Pot
ser inofensiu —MapLibre fixa el seu propi estat abans de cada capa seva, i
per això `agents-3d.ts:187` crida `renderer.resetState()`—, i **no es pot
confirmar llegint**: si molesta, es veu al navegador i és feina de la fase 7.
Queda apuntat amb el que caldria mirar: una capa que es dibuixi després de
les partícules i doni per fet el barreig per omissió.

## El que he mirat i està bé

- **`start()` (`:747-804`) està ben fet.** El testimoni de `FireRun` es demana
  abans del càlcul i es comprova després; el `catch` restaura el pla i els
  vents **només si encara és el seu torn**, que és el correcte, perquè si
  n'ha començat un de nou l'estat és d'aquell; i el `finally` tanca el
  comptador. És el camí més delicat del component i no hi he trobat res.
- **Els cinc `set…` de `countermeasure-plan.ts` no tenen el forat que
  semblava.** `setWidth`, `setDuration` i `setStrength` comproven rang i
  posen el seu missatge; `setLiquid` i `setRemaining` **no comproven res**, i
  això sembla una omissió fins que es segueix el camí: tots cinc passen per
  `patch()` → `commit()` → `parseCountermeasures()`, i el model sí que
  valida —`finite()`, rangs, `Number.isInteger(passes)`
  (`simulation/countermeasures.ts:421-430`)—. L'asimetria és deliberada: els
  tres primers pre-validen per a donar un missatge més concret. No és un
  defecte i canviar-ho empobriria els missatges.
- `patch()` i `commit()` (`:563-590`) concentren bé el que els cinc
  comparteixen: el bloqueig de l'historial, la validació i la nota. La
  repetició que queda són tres comprovacions de rang amb el seu text, i
  escrites a mà es llegeixen millor que abstretes.
- `fire-particles.ts:238` limita el pas de temps a 100 ms, de manera que
  tornar d'una pestanya oculta no fa un salt; i `triggerRepaint` es guarda
  amb `document.hidden`.
- `agents-3d.ts:187` crida `renderer.resetState()` abans de dibuixar, que és
  el contracte de three.js dins d'una capa de MapLibre.

## El que no he pogut avaluar

La geometria i els *shaders* del 3D: `agent-models.ts` (454 línies) construeix
figures i `fire-particles.ts` té el seu vèrtex i el seu fragment. Si una
figura es veu girada, deformada o del color que no toca, **això no es veu
llegint**. Cal el navegador, i és la fase 7.

Tampoc he recorregut les 1.322 línies de `simulator-view.ts` línia a línia:
he seguit els camins —arrencada, efectes, destrucció, el pla— i les troballes
surten d'allà. Queden els formatadors i les files de la consola.
