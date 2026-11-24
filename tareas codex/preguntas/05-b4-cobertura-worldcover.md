# 05 — Decisión para Pere: cobertura parcial de WorldCover

`api/src/fuels.ts:166-167,195-210` deja `unknownCells` cuando el GeoTIFF no cubre la caja, pero no añade aviso salvo que la lectura lance una excepción. El mismo fichero, en `:135-147`, puede muestrear fuera de la ventana real; eso sí es un defecto de índices que conviene corregir independientemente de esta decisión.

**¿Debe la respuesta pública añadir un aviso específico cuando el GeoTIFF se lee correctamente pero no cubre toda la caja solicitada?**

- Sí: distinguir «sin cobertura en el ráster» de «fuente inaccesible» en `warnings`, además de `unknownCells`.
- No: mantener el contrato actual, donde `unknownCells` y `no-store` indican la falta y solo los errores de red producen aviso.

No he cambiado el contrato ni el código.

---

## Respuesta de Pere — 24/11/2026

**Sí: un aviso propio, distinto del de «fuente inaccesible».**

El motivo, que es el que debería guiar la redacción: **los dos casos piden
cosas distintas de quien mira la pantalla.** Si no hay ráster para esa caja,
reintentar no sirve de nada y el combustible estimado es lo mejor que va a
haber. Si la fuente falló, reintentar sí sirve. Hoy los dos se ven igual
—combustible «estimado» y nada más— y el usuario no puede saber cuál le ha
tocado.

Lo que eso implica:

- **El texto sale en pantalla.** `web/src/app/simulator/fuel-panel.html:67`
  lista cada `warning` como texto, así que va en catalán, por la regla 12, y
  tiene que decirle al usuario qué puede hacer: en este caso, nada.
- **No lo metas en el aviso que ya existe.** El de «Cap conjunt de combustible
  oficial configurat» es otra cosa: dice que no hay cartografía oficial, no
  que el ráster estimado no llegue.
- **Cuidado con el recuento.** `api/tests/fuels-build.test.ts:85` comprueba
  `grid.warnings.length === 1`. Una caja con cobertura parcial pasará a tener
  dos avisos, así que mira qué pruebas cuentan avisos antes de dar por buena
  la tanda.
- **La regresión**: una lectura correcta que no cubre toda la caja produce el
  aviso nuevo, y una fuente inaccesible conserva el suyo, distinto. Los dos
  casos en la misma prueba, para que no se confundan.
- `unknownCells` y el `no-store` se quedan como están: siguen siendo la señal
  máquina a máquina, y el aviso es la señal para la persona.
