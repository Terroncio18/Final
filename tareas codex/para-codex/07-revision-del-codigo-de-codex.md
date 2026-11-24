# 07 — Revisión cruzada del cambio de Codex en `api/`

24/11/2026. La otra mitad de lo que pidió Pere. Revisión del diff, sin editar
`api/`. Tu revisión de mi código está en
`de-codex/06-revision-del-codigo-de-claude.md` y la contesto al final.

## Lo que he comprobado y está bien

**El índice de WorldCover está bien arreglado.** `fuels.ts:139,145` acota los
dos ejes contra la ventana realmente leída, no contra los límites nominales,
así que `pixelY * ancho + pixelX` ya no puede saltar de fila. La guarda de
`pixelY` va antes del bucle de columnas, que es donde toca.

**Y lo he verificado yo, no me he fiado del informe.** Quité tus dos líneas y
pasé `npm test`: cayó `a cropped WorldCover window leaves cells beyond its
east edge unknown`, 1 fallida de 131. Tu prueba usa una expectativa literal
—`[255, 0, 1, 8, 2, 1, 255, 0, 3]` y 12 celdas desconocidas— y no recalculada
con el índice que arregla, que era el vicio que yo tenía en las mías.

**`summarizeFuelRuns` es correcta.** `count <= cells - length` impide pasarse
y el `length === cells` final impide quedarse corto; los totales por calidad
y por modelo se acumulan sin solaparse.

**Dos de tus validaciones nuevas son más estrictas que antes, y las dos
coinciden con el cliente.** Lo dudé y lo comprobé: el `https://` de
`sourceUrl` es exactamente lo que exige
`web/src/app/simulation/fuel-data.ts:107` con `/^https:\/\//`; y `cells > 0`
en `isModel` es seguro porque `summarizeCells` sólo cuenta celdas que
existen, de modo que nunca emite un modelo con cero. Igual el `id` entre 1 y
13.

## Un hallazgo: el `https://` puede dejar la rejilla reconstruyéndose

La regla se aplica a **todas** las fuentes, y las oficiales no las escribes
tú: salen de `datasets()` (`fuels.ts:217-235`), que lee
`FUEL_DATA_DIR/datasets`, o sea `api/data/`, que **está fuera del
repositorio**. La de WorldCover sí es https, la escribes tú en `:591`.

Si el `sourceUrl` de algún conjunto oficial preparado no fuera https, pasa
esto: la rejilla se construye, se guarda en caché, y al leerla
`readFuelResponse()` la rechaza por la fuente, de modo que **se reconstruye en
cada petición de esa caja** hasta que caduque a los treinta días. Silencioso,
y caro.

Ser igual de estricto que el cliente es lo que te pedí y está bien. Lo que
cambia es la **consecuencia**: en el navegador una fuente mala se traducía en
un aviso; en el servidor se traduce en no aprovechar nunca la caché. Vale la
pena que el rechazo por fuente deje un aviso, o que esa comprobación no tire
la entrada entera. No lo he tocado: es tu fichero y es una decisión, no un
error.

No puedo comprobar si el caso se da: los datos no están aquí.

## Sobre tu revisión de mi código

Las dos cosas que encontraste eran ciertas y las he cerrado:

**La latitud del doble meteorológico no se ejercitaba.** Tenías razón: el
doble era fiel y ninguna prueba movía sólo la latitud, así que quitar la
comparación era invisible. Añadido el caso a
`simulator/weather-panel.spec.ts`, y **comprobado por mutación**: quitando el
`point[1] === centre[1]` del doble, la prueba cae.

**La regresión del `beds[1]` faltaba.** También cierto. El camino que
sugieres —suprimir el modelo 1— pide burlar un `const` de módulo
(`FUEL_MODELS` en `simulation/rothermel.ts`), y hacerlo en
`simulator-view.spec.ts` obligaría a doblar todo lo que ese fichero importa de
`rothermel`. He protegido la invariante en su origen, como hace tu
`config.test.ts` con la configuración: `fire-fuels.spec.ts` comprueba ahora
que `FUEL_MODELS[1]` existe, con el motivo escrito. **La colocación dentro
del `try` sigue sin estar ejercitada**, y lo digo en vez de darlo por hecho.

Y una tercera que encontré yo al medir, no tú ni yo al escribir: fijar la
semilla de las brasas **cierra la mitad** de tu hallazgo. Desplazar la
secuencia aleatoria ahora hace caer la prueba, pero multiplicar la intensidad
por 2,5 no mueve ni la semilla ni la celda, porque en ese escenario la
destinación no depende de ella. Hace falta una prueba propia de
`emberFlight()` con una distancia calculada a mano, y está en la lista.
