# Ayuda de Codex para Claude: aspecto y animación del fuego

14/11/2026. Preparado a petición de Pere mientras el simulador está en desarrollo.

> **Estado posterior, mismo día (bitácora §11.20).** Este documento describe la
> propuesta tal como se entregó y se conserva como registro. El pintor se
> conectó como aquí se indica y después fue sustituido en pantalla por
> `fire-field.ts`, un campo continuo, porque el pintado celda a celda se veía a
> cuadros. Las partículas que aquí se dejaban para una segunda integración
> existen en `web/src/app/map/fire-particles.ts`. `fire-appearance.ts` y sus
> siete pruebas siguen en el repositorio **sin usarse**: es el pintor de la
> huella exacta. Las frases «todavía no está conectado» y el fragmento de
> integración de más abajo ya no describen el visor actual.

## Qué hay listo

- `web/src/app/simulation/fire-appearance.ts`: pintor independiente, sin nuevas dependencias.
- `web/src/app/simulation/fire-appearance.spec.ts`: siete pruebas del contrato visual.
- Este documento: propuesta concreta para conectarlo al visor actual.

**Todavía no está conectado a la aplicación.** He añadido estos tres archivos sin
editar los archivos existentes que estás trabajando: `simulator-view.ts`,
`map.service.ts`, `fire-spread.ts`, `rothermel.ts` y la bitácora.

El módulo conserva exactamente la máscara `arrival <= minute`, separa el reloj
visual del reloj de propagación, añade parpadeo desfasado por celda, suaviza los
cambios de amarillo a naranja, brasas y carbón, y mantiene una textura de ceniza
estable al retroceder por la línea temporal. No modifica las llegadas ni las
métricas. Las edades de color son una decisión de presentación, no tiempos de
residencia ni temperaturas calculados por Rothermel.

## Qué aprovechar de FireCast

Referencia local: `C:/Proyectos/TFG/Codex/incendios/firecast/dist/terrain.js`.

- Líneas 48–54: partículas luminosas con mezcla aditiva y humo transparente sin
  escritura de profundidad.
- Líneas 87–89: fases distintas por partícula, ascenso y deriva a favor del viento.
- Línea 94 y siguientes: reloj visual independiente de los minutos simulados.

**No trasladar el perímetro de `model.js`:** FireCast utiliza una elipse ilustrativa;
Pere ya tiene una rejilla de tiempos de llegada con pendiente y viento. Para
partículas futuras, seleccionar emisores entre las celdas recientemente alcanzadas
por esa rejilla, no alrededor de una elipse inventada. La dirección `towardsDeg`
ya apunta hacia donde sopla el viento; no sumarle otros 180 grados.

Este primer módulo mejora el raster que ya se drapea sobre el terreno. No añade
llamas volumétricas ni humo: pintarlos en ese raster los pegaría al suelo. La
parte de partículas 3D requiere una capa adicional que comparta cámara,
coordenadas y profundidad del terreno de MapLibre. Es una segunda integración,
no un motivo para sustituir ahora el visor por Three.js.

## Integración propuesta en `simulator-view.ts`

1. Importar `FireAppearance` desde `../simulation/fire-appearance`.
2. Quitar `paintFire` del import de `fire-spread`, conservando `spread` y el tipo.
3. Mantener el efecto que crea `fireCanvas` y llama a `maps.setFire`.
4. Sustituir **solo** el efecto que llama a `paintFire` por el siguiente. El bucle
   de reproducción que actualiza `minutes` permanece como está.

```ts
effect((onCleanup) => {
  const result = this.result();
  const canvas = this.fireCanvas;
  if (!result || !canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const painter = new FireAppearance(result.arrival);
  const image = new ImageData(painter.pixels, GRID, GRID);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let last = performance.now();
  let lastPaint = -Infinity;
  let visualSeconds = 0;
  let previousMinute = NaN;
  let previousMotion: boolean | undefined;

  const draw = (now: number) => {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    const motion = !reduced.matches;
    if (!document.hidden) {
      if (motion) visualSeconds += dt;
      if (now - lastPaint >= 50) {
        lastPaint = now;
        const minute = untracked(this.minutes);
        if (
          minute !== previousMinute ||
          motion !== previousMotion ||
          (motion && painter.activeCellCount > 0)
        ) {
          painter.paint(minute, visualSeconds, motion);
          context.putImageData(image, 0, 0);
          this.maps.refreshFire();
          previousMinute = minute;
          previousMotion = motion;
        }
      }
    }
    frame = requestAnimationFrame(draw);
  };

  // First paint even if playback starts paused; cleanup on reset/new result/destroy.
  draw(performance.now());
  onCleanup(() => cancelAnimationFrame(frame));
});
```

La propiedad `firePixels` y su asignación con `new ImageData(GRID, GRID)` quedan
sin uso y pueden retirarse tras integrar. El nuevo `ImageData` comparte el buffer
del pintor; no hace falta copiarlo con `.set()` cada fotograma.

La pausa detiene la propagación, pero deja el parpadeo ambiental. Con movimiento
reducido se congela el parpadeo y la línea temporal sigue funcionando. No se
suben texturas con la pestaña oculta. El muestreo visual está limitado a 20 fps;
el mapa y sus controles mantienen su propia cadencia.

Con un minuto fijo solo se repintan las celdas de menos de 40 minutos. Cuando
cambia el minuto se recorre la rejilla. Se reutilizan los buffers: unos 9 MiB
adicionales para 1024² celdas, sin contar la rejilla de entrada ni canvas/GPU.
La subida al mapa sigue siendo una textura completa; medir su coste en el
navegador antes de aumentar la cadencia.

## Nota sobre el refresco del canvas

He revisado el código instalado de
`web/node_modules/maplibre-gl/src/source/canvas_source.ts`: `pause()` llama a
`prepare()` mientras `_playing` aún es verdadero, y `prepare()` sube la textura
si hay tiles. Por tanto, el `play(); pause(); triggerRepaint()` actual tiene
fundamento en esta versión. No hace falta cambiarlo por `animate: true` para
este módulo. Esto no sustituye una comprobación visual de la caché del terreno.

Si el raster no aparece, comprobar primero con un canvas rojo fijo, a vista
cenital y después con relieve; confirmar orden de coordenadas NO, NE, SE, SO,
posición de la capa y estado de carga del estilo. La bitácora §11.19 ya recoge
que faltaba verificar el dibujo sobre el terreno: más partículas no arreglarán
un problema de actualización de esa textura.

## Validación realizada y pendiente

Desde `web/`:

```powershell
node node_modules/vitest/vitest.mjs run src/app/simulation/fire-appearance.spec.ts
node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit
```

Resultado: **7 pruebas pasan y TypeScript no informa de errores**. Las pruebas
cubren máscara exacta (incluidas celdas inalcanzables), entradas sin mutar,
parpadeo con minuto fijo, retroceso temporal, movimiento reducido, carbón
inmóvil, reutilización del buffer y continuidad de color en las transiciones.

Pendiente tras conectar: revisión visual en MapLibre con relieve, movimiento de
cámara, pausa, reinicio, cambio de escenario y preferencia de movimiento reducido.
El fragmento de integración de este documento es una propuesta; no se ha aplicado
ni ejecutado dentro del componente Angular.
