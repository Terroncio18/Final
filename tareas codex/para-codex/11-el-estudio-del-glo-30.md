# 11 — El estudio del GLO-30: qué trabajo supone y qué mejora de verdad

24/11/2026. Encargo de Claude para Codex. Esfuerzo alto. **Lo pide Pere**, y
es la condición para cerrar la 12.1: no quiere elegir el DEM sin saber qué
costaría y qué ganaría.

## Qué se pide

Un estudio que conteste, en este orden, y con números donde los haya:

1. **Qué usamos hoy, medido en el repositorio.** Qué fuente de teselas, con
   qué zoom se pide, cuántos metros de suelo mide un píxel del ráster a ese
   zoom y en la latitud de Baleares, y cómo se deriva de ahí la pendiente que
   entra en Rothermel. Dónde mirar: `web/src/app/map/map.style.ts` y
   `map.config.ts` para la fuente y el zoom; `web/src/app/simulation/terrain.ts`
   para la lectura y el cálculo de pendiente; `domain.ts` para el tamaño del
   dominio y de la celda; `rothermel.ts` para cómo pesa la pendiente.
2. **Qué es el Copernicus DEM GLO-30**: de dónde sale el dato, resolución
   nominal y real, exactitud vertical publicada, licencia y **cómo se
   distribuye** —que es lo que la 12.1 dice que es el problema: no viene como
   teselas abiertas—. Compáralo con lo que alimenta de verdad a Terrarium, que
   no es una fuente única sino una mezcla, y dilo: comparar «Terrarium» con
   «GLO-30» como si fueran dos datos equivalentes sería impreciso.
3. **La pregunta que de verdad decide**: a la resolución de celda que este
   simulador usa, ¿cambiaría la pendiente lo suficiente para cambiar el fuego?
   Si la celda del modelo es más grande que el píxel del DEM, un DEM mejor se
   promedia y se pierde. Esto se puede **medir**, no solo razonar: la pendiente
   que entra en el modelo es una función del ráster, y el repositorio tiene las
   dos cosas. Si puedes acotarlo con una cuenta, hazlo; si no, di qué haría
   falta para medirlo.
4. **El trabajo**, desglosado: servir las teselas o leer los ficheros, adaptar
   la lectura, qué pruebas caen y qué habría que volver a comprobar, y si
   afecta al relieve sombreado del mapa además del modelo. En horas o en
   tamaño de tarea, no en «sería fácil».
5. **Tu recomendación**, y por separado **lo que la memoria podría afirmar**
   en cada caso. No es lo mismo entregar con Terrarium y citar el GLO-30, que
   entregar con GLO-30 y no poder justificar la diferencia.

## Lo que ya está decidido

- El proyecto se entrega: fase 7 es la prueba de interfaz de Pere y fase 8 los
  manuales. Un cambio de DEM hoy es una fase nueva, no un retoque. Dilo si es
  así, pero **no decidas tú**: el estudio es para que Pere elija.
- La pendiente de Terrarium ya alimenta el modelo desde el 29/10/2026, no es
  solo relieve sombreado. Está en la 12.1 y en la §11.19.
- Nada de código en este encargo. Medir, leer y escribir.

## Qué queda abierto

Puedes decidir cómo estructurar el estudio y qué medir. Lo que no: cambiar
nada, ni proponer un cambio de DEM como si estuviera aprobado.

Si **no puedes consultar la red**, dilo en la primera línea del informe y haz
las partes 1, 3 y 4, que son del repositorio; para la 2, escribe lo que sepas
marcándolo como pendiente de verificar, y no des por publicado un número que
no has visto. Que un dato falte es un resultado; inventarlo, no.

## Forma de la respuesta

`tareas codex/de-codex/11-....md`. Un estudio, en castellano, con las cifras
en tablas donde se puedan comparar. **No toques ningún otro fichero.**
Las resoluciones de la bitácora las escribo yo.
