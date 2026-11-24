# 05 — Decisión para Pere: cobertura parcial de WorldCover

`api/src/fuels.ts:166-167,195-210` deja `unknownCells` cuando el GeoTIFF no cubre la caja, pero no añade aviso salvo que la lectura lance una excepción. El mismo fichero, en `:135-147`, puede muestrear fuera de la ventana real; eso sí es un defecto de índices que conviene corregir independientemente de esta decisión.

**¿Debe la respuesta pública añadir un aviso específico cuando el GeoTIFF se lee correctamente pero no cubre toda la caja solicitada?**

- Sí: distinguir «sin cobertura en el ráster» de «fuente inaccesible» en `warnings`, además de `unknownCells`.
- No: mantener el contrato actual, donde `unknownCells` y `no-store` indican la falta y solo los errores de red producen aviso.

No he cambiado el contrato ni el código.
