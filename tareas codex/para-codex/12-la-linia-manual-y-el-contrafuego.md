# 12 — La línea manual a 7 m/h, y el contrato del contrafuego

24/11/2026. Encargo de Claude para Codex. Esfuerzo alto. Sale de las respuestas
de Pere a la 12.25, que están en
`docs/pla-poliment/les-setze-pendents.md`. **Dos de ellas cambian el fuego
calculado**, así que la (c) y la (d) llevan su contrato escrito antes del
código, como manda el `CLAUDE.md`.

## El reparto, y qué ficheros son de quién

Tú, el modelo de brigadas y contramedidas: `web/src/app/simulation/` —
`countermeasures.ts`, `fire-countermeasures.ts`, `agents.ts` y sus pruebas.

Yo, a la vez y sin tocar los tuyos: `simulation/terrain.ts` (la 12.8),
`simulation/ignition-step.*`, `simulation/levels.service.ts`,
`web/src/app/map/`, `web/src/app/simulator/`, `app.routes.ts` y
`form-components.spec.ts` (el renombrado de la 12.7).

**No toques ninguno de los míos**, ni `simulator/countermeasure-panel.*`: la
pantalla de la (c) la hago yo cuando el contrato esté acordado.

## Parte 1 — La (b), que ya está decidida: 7 m/h

Pere ha elegido el NWCG sostenido en lugar de Ortega. Lo que he comprobado en
`countermeasures.ts`, para que no haya que buscarlo:

- **`defense-line`** es la línea manual: `ratePerPerson: 40.2`, fuente
  `ORTEGA_2023`, `placeholder: false`. **Es la única que cambia**: pasa a 7
  m/h por persona.
- **`firebreak`** y **`clearing`** también están a 40.2, pero con
  `placeholder: true` y una nota que dice que el valor **sale de la línea
  manual de Ortega**. Pere ha contestado la (a) diciendo que estos se quedan
  provisionales y sin fuente, así que **sus números no cambian**. Pero su nota
  pasará a ser falsa: dirían que vienen de un valor que ya no existe. Hay que
  reescribirlas para que digan lo que son —un valor editable, no derivado de
  la línea manual— sin inventarles procedencia.
- **`water-line`** (80,5 m/h, NWCG, 4 efectivos) no se toca.

**Cuidado con la cita.** La entrada 12.25 dice «el NWCG sostingut (7 m/h)» y no
da tabla ni modelo. **No inventes una referencia precisa**: ni número de tabla,
ni modelo de combustible, ni página, si no la has verificado. Si la encuentras
publicada, cítala; si no, la fuente dice que es el valor sostenido de las
tablas del NWCG ratificado en la decisión 12.25 (b), y que las dos medidas no
se tomaron en las mismas condiciones —40,2 es rendimiento de construcción y 7
es sostenido a lo largo de un turno—. Eso último es lo que Pere aceptó que la
memoria dijera.

Esto cambia el resultado de todo escenario con línea de defensa: casi seis
veces más lento. **Mira qué pruebas lo dan por supuesto** —`scenario.spec.ts`
tiene un 40.2 escrito— y qué escenarios guardados lo usan. Si una prueba
cambia de número, que cambie porque el comportamiento cambió, no para que
pase.

## Parte 2 — El contrato de la (c) y la (d), antes del código

Pere ha elegido las dos opciones que yo no recomendaba. Son suyas y van
adelante; lo que pido aquí es el contrato, no la implementación.

**(c) El contrafuego deja de ser instantáneo.** Hoy aparece entero cuando se
decide. Ha de tener el mismo trato que el cortafuego: tiempo de llegada,
efectivos y rendimiento, con la celda activándose cuando la brigada llega
(§11.42 ya hace esto para las demás). Preguntas que el contrato debe cerrar:

- ¿Qué rendimiento y qué efectivos por defecto? El contrafuego se enciende, no
  se construye: el rendimiento de línea manual puede no ser la medida
  correcta. Si no hay fuente, que sea `placeholder: true` y se diga.
- ¿Qué pasa si el frente llega a la brigada del contrafuego? La regla de
  seguridad de la §11.40 —flamas de más de 1,2 m y se para— ¿se le aplica
  igual?
- El contrafuego crea igniciones (§11.27). ¿Se encienden una a una conforme la
  brigada avanza, o todas al llegar al final del tramo? **Esto cambia el
  fuego**, y es la pregunta importante.
- ¿Qué pasa con los escenarios guardados que tienen contrafuego sin estos
  campos? El trato de la §11.31 y la §11.49 es que los ficheros viejos se
  siguen abriendo.

**(d) Las pasadas de agua programadas se cancelan.** Hoy, cuando una brigada
de línea de agua se detiene por seguridad, las pasadas futuras sobre las
celdas que ya había hecho se mantienen. Pasan a cancelarse. Preguntas:

- ¿Se cancela todo lo futuro, o solo lo que quedaba por delante del punto
  donde se paró? La celda ya mojada, ¿sigue mojada?
- ¿Y si la brigada vuelve cuando es seguro? ¿Se reprograma?
- ¿Qué se ve en la pantalla? Si una pasada desaparece, el usuario ha de poder
  entender por qué. Eso es mío, pero dime qué estado necesita saber.

## Lo que ya está decidido y no se discute

- Las respuestas de Pere: 7 m/h, contrafuego con llegada y rendimiento, y
  pasadas canceladas. No se vuelven a argumentar. Si ves que una tiene una
  consecuencia que él no sabía, **dilo en el informe** y sigue.
- Determinismo: misma semilla, misma simulación (§11.19, §11.30).
- Los ficheros de versiones anteriores se siguen abriendo.
- Nada se commitea: lo indica Pere.

## Forma de la respuesta

Dos cosas, en `tareas codex/de-codex/12-....md`:

1. **La (b) hecha**: el cambio en `countermeasures.ts` y sus pruebas, aplicado
   en tus ficheros, con las pruebas pasando. Di qué pruebas cambiaron de
   número y por qué.
2. **El contrato de la (c) y la (d)**: propuesta, no código. Las preguntas que
   necesiten a Pere, a `tareas codex/preguntas/12-....md`, una por línea y con
   tu recomendación al lado.

Si al escribir el contrato ves que la (c) es más grande de lo que parece
—que toca el horizonte de cálculo, o el acoplamiento de una sola pasada de la
§11.19—, dilo con esas palabras y no la empieces. Val más saber que son dos
días que descubrirlo a medias.
