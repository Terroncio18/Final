# 10 — Cerrar las dieciséis pendientes del punto 12

24/11/2026. Encargo de Claude para Codex. Esfuerzo alto: es la decisión más
grande que queda, y no es código.

## El contexto, que importa

`docs/bitacola/fase-2/12-decisions-pendents.md` tiene treinta entradas. Catorce
están **tachadas** (resueltas, con fecha y el § donde se resolvió) y dieciséis
siguen abiertas. El índice `docs/bitacola/README.md` las lista todas juntas bajo
«Pendents obertes», y Pere ha preguntado si de verdad son dieciséis decisiones
pendientes. No lo son: hay de cuatro clases distintas. Y ha decidido
**cerrarlas todas**.

Dónde está el proyecto: el plan de pulido (`docs/pla-poliment/README.md`) tiene
las fases 0 a 6 hechas; la **fase 7 es la prueba de interfaz, que hace Pere en
el navegador**, y la **fase 8 son los manuales**. Es un TFG que se entrega. Eso
cambia lo que es una resolución honesta: para una pendiente que es *trabajo
futuro*, la resolución es **«no se hace, y este es el motivo y lo que
costaría»**, escrito de manera que la memoria pueda citarlo como línea de
trabajo futuro. Cerrar no significa implementar.

## Qué se pide

Un informe con, **para cada una de las dieciséis**, una resolución propuesta
en la forma que ya usa el fichero:

```
~~**12.N. <título>.**~~ Resolta el 24/11/2026 a la §11.85: <qué se decide, en
media línea>. El que es plantejava: <lo que ya había, intacto>.
```

más dos o tres frases de **motivo**, que es lo que de verdad hace falta: el
fichero existe para que dentro de un año se sepa por qué. Y, por cada una:

- **qué clase de pendiente es** de verdad;
- si **implica código**, qué y cuánto;
- si **la tiene que decidir Pere** y no nosotros.

## Mi clasificación, que quiero que discutas

La he hecho leyendo el fichero entero. **Discútela**: en las dos revisiones
cruzadas anteriores (§11.81, §11.82) encontraste cosas que yo había descrito
mal, así que no la des por buena.

**(a) Decisiones de verdad, con consecuencia técnica** — 12.1 (modelo de
elevaciones: Terrarium o Copernicus GLO-30), 12.2 (polígonos sin modelo de
combustible), 12.10 (meteorología en directo: qué estación habla por un dominio
de 30 km, cada cuánto se refresca, el CORS de IPMA sin comprobar), 12.7 (el
renombrado de «ignició» a «centre», aplazado a conciencia).

**(b) Esperan una fuente, o que digamos que no la hay** — 12.16 (coeficientes
de las contramedidas), 12.25 (rendimientos de las brigadas: cinco letras, y las
(d) y (e) no son bibliografía sino comportamiento), 12.26 (solo la (a): la
lámina de agua mínima del anfibio, que no está publicada).

**(c) Hechas en parte; queda un trozo** — 12.8 (resuelta para el modelo el
14/11: altitud ≤ 0 no arde; queda sacar el mar de las cifras de altitud y
pendiente de la §11.12), 12.20, 12.23, 12.24.

**(d) Trabajo futuro, no decisiones** — 12.19, 12.21, 12.22, y el resto de
12.20, 12.23, 12.24. Y 12.5, que es el caso raro: el modelo de propagación ya
está desde la §11.19; lo que queda abierto es la investigación que lo
justifique.

Y **12.18** (el manual de usuario) no es una pendiente: es la fase 8 del plan,
decidida y planificada.

## Dos cosas concretas que he visto

1. **Una frase muerta** al final del fichero: «La primera que toca és la 12.4,
   perquè condiciona on viu la resta». La 12.4 se resolvió el 5/11/2026 y está
   tachada más arriba. Hay que quitarla o rehacerla.
2. **12.8 es la única de las dieciséis con código pendiente**, y es pequeño:
   excluir el mar de las cifras de altitud y pendiente. Dime si estás de
   acuerdo en que es la única, porque de eso depende que esto sea una sesión de
   escritura o de código.

## Qué ya está decidido, y no se vuelve a discutir

- Las catorce tachadas. No se reabren.
- La bitácora manda: el motivo de cada cosa está ahí, y el `CLAUDE.md` dice que
  se mire **antes** de proponer nada. Si para una pendiente el motivo ya está
  escrito en una §, cítala en vez de razonarla de nuevo.
- Las resoluciones van al **fichero del 12**, tachando la entrada y dejando
  intacto lo que se planteaba, y se resumen en una entrada nueva de bitácora.
  Eso lo escribo yo; tú propones el contenido.
- El idioma: la bitácora en catalán (regla 12 de `docs/estil.md`). Tu informe,
  en castellano como siempre, y las resoluciones que propongas, en catalán, que
  es donde van a acabar.

## Qué queda abierto

Puedes decidir la **forma** de cada resolución y el **motivo**. Lo que no:

- Nada que cambie el comportamiento del simulador sin que Pere lo sepa. Si una
  resolución implica tocar el modelo, dilo y no la toques.
- Las que sean **suyas**: 12.1 y 12.10 tienen consecuencia en lo que la memoria
  puede afirmar, y 12.16 y 12.25 son las hipótesis sobre las que se sostienen
  las conclusiones cuantitativas. Si crees que una la tiene que firmar él, a
  `tareas codex/preguntas/10-....md`, **una pregunta por línea y con tu
  recomendación al lado**, que es lo que le ahorra tiempo.

## Forma de la respuesta

`tareas codex/de-codex/10-....md`. Un informe. **No toques ningún otro
fichero**: ni el del 12, ni el índice, ni código. Yo integro.

Si al leerlo ves que alguna de las dieciséis no se puede cerrar honestamente
—que cerrarla sería escribir que algo está decidido cuando no lo está—, dilo
con esas palabras. Preferimos quince cerradas y una abierta y bien dicha, que
dieciséis cerradas y una mentira en la memoria.
