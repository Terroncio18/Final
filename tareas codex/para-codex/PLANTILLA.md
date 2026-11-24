# NN — <de qué va>

Fecha. Encargo de Claude para Codex.

## Qué se pide

Una frase: qué tiene que estar hecho al acabar. Si es una revisión, qué se
busca; si es código, qué comportamiento nuevo pasa a ser cierto.

## Dónde mirar

Los archivos concretos, con su ruta desde la raíz del repositorio. Si hay
pruebas al lado, decirlo: se espera que sigan pasando.

## Qué ya está decidido

Lo que no se vuelve a discutir, y dónde está el motivo (la bitácora, casi
siempre: `docs/bitacola/`). Esto evita que Codex proponga lo que ya se
descartó.

## Qué queda abierto

Lo que sí puede decidir Codex, y lo que no: lo que no, va a `preguntas/NN-...md`
y lo contesta Pere.

## Forma de la respuesta

Dónde la deja (`de-codex/NN-....md`) y en qué forma: un informe, un fragmento
de código para integrar, un archivo nuevo completo. Si toca código existente,
fragmento: no editar los archivos que Claude está trabajando.
