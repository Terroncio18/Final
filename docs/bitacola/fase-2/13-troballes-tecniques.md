# 13. Troballes tècniques

Coses que costen temps i convé no redescobrir. La de la fase 1 és al §4 de
l'altre document.

### 13.1. Què drapeja MapLibre sobre el terreny, exactament

A `maplibre-gl` 6.15.0, `isRenderedToTexture()` ho decideix amb dues regles: per
a una capa normal, `LAYERS_TO_TEXTURES[layer.type] === true`, i la taula és
`{background, fill, line, raster, hillshade, color-relief}`; per a una capa
pròpia, que implementi `renderToTerrainTile`. Les capes `symbol` i `circle` no
hi són: no es drapegen, se situen a l'alçada del terreny i es dibuixen dretes,
que és el que es vol d'una marca.

Les capes consecutives que es drapegen es renderitzen juntes en una pila
(`getRenderStacks`), de manera que una que no es drapeja —un `symbol` al mig—
parteix la pila en dues i costa una passada més. Ordenar l'estil pensant-hi
estalvia passades.

### 13.2. Dues animacions de càmera al mateix fotograma: la segona talla la primera

La primera versió del 3D inclinava la càmera amb un `easeTo` en encendre el
terreny, i el pas enquadrava la seva extensió amb un `fitBounds` immediatament
després. El resultat no era ni una cosa ni l'altra: la segona animació avortava
la primera on fos, i el mapa es quedava a **9°** d'inclinació, que sembla un
error de càlcul i no un punt de vista.

La inclinació ha d'anar **dins** de l'enquadrament: `fitBounds` accepta `pitch`
perquè `FitBoundsOptions` estén `CameraOptions`, i així una sola animació fa les
dues coses. Com a efecte secundari, cada pas pla torna a posar la càmera a zero
sense que ningú ho hagi de recordar: la inclinació surt de l'estat del servei i
no d'una crida a part.

### 13.3. Amb el relleu encès, pujar un llenç no repinta el que hi ha drapejat

Una font `canvas` que no és animada es fa llegir amb `play()` i `pause()`
seguits: en aturar-se puja la textura una darrera vegada. En mapa pla n'hi ha
prou. **Amb el terreny 3D no**: a `maplibre-gl` 6.15.0 el relleu desa en una
textura pròpia el que hi té drapejat (§13.1) i la reaprofita, de manera que el
llenç nou arribava a la GPU i a la pantalla seguia l'anterior. El símptoma és
un foc que no avança, o una capa que s'apaga al menú i segueix dibuixada, fins
que es mou la càmera.

El que ho invalida és dir-li a la font que el seu contingut ha canviat, i la
via pública és `setCoordinates()` amb les mateixes coordenades. Va a
`refreshFire()`, després del `play()` i el `pause()`.

És, molt probablement, el que hi havia darrere de les dues comprovacions que
la §11.19 i la §11.20 van deixar sense fer —«no s'ha pogut comprovar el dibuix
del foc sobre el mapa»—, atribuïdes llavors al navegador de proves.

> **Revisat el 16/11/2026** (§13.6): `setCoordinates()` només ho arreglava a
> mitges, i ja no es fa servir.

### 13.4. Les proves del model no corren amb el *builder* d'Angular

Les proves de propagació substitueixen mòduls relatius amb *mocks* de Vitest,
i el *builder* `@angular/build:unit-test` no ho admet. Des del 15/11/2026 les
proves van en dues tandes: `npm run test:simulation` executa
`src/app/simulation` amb Vitest directament, i `ng test` en queda exclòs a
`angular.json`. `npm test` encadena les dues.

### 13.5. Molts contrafocs fan quadràtica la distància a la ignició

L'avanç màxim (§11.25) buscava, per a cada cel·la cremada, la ignició més
propera recorrent-les totes. Amb un o dos focus no importa; un contrafoc en
genera centenars o milers —una per cel·la de la franja—, i el cost es
multiplica. A partir de 33 llavors es calcula ara la transformada de
distància euclidiana exacta en dues passades (`fire-distances.ts`), lineal en
la mida de la graella. I l'avanç només compta les ignicions que ja s'han
desplegat en cada minut.

### 13.6. El foc tallat en línies rectes: les tessel·les que `setCoordinates` no arriba

Trobat el 16/11/2026, a partir d'una captura de Pere: amb el relleu encès i el
cursor avançant, el foc sortia tallat per línies rectes, amb un estat a cada
costat, i en fer zoom o girar la vista es tornava a pintar bé. **No era el
navegador ni el model: era MapLibre**, i com la §13.3 l'esquivava.

Amb el terreny, `maplibre-gl` 6.15.0 pinta les capes drapejades dins d'una
textura per a cada tessel·la del terreny i la guarda (`render_to_texture.ts`).
Les línies rectes eren les vores d'aquestes tessel·les vistes en perspectiva:
unes tenien el foc nou i les altres un d'abans. Dues regles decideixen quan es
refà una textura, i el llenç del foc no n'activava cap del tot:

- **L'avís de dades del mapa** (`_handleTerrainDataEvent`, a `map.ts`): quan
  una font canvia, si és de tipus `'image'` es buiden totes les textures; si
  no, només les de les tessel·les de la mateixa línia —mare o filla— que la
  tessel·la de la font. La font del foc és un llenç: per dins hereta d'imatge,
  però s'anuncia com a `'canvas'`, i va pel segon camí. Un llenç només té una
  tessel·la, la que en conté el centre, i el foc —30 km de domini— en cobreix
  diverses del terreny. `setCoordinates()` (§13.3) provocava aquest avís, i per
  això el foc es refeia en part.
- **L'empremta de cada textura** (`RTTFingerprint`): es refà quan canvia el
  zoom, les tessel·les de la font, les capes visibles o la **revisió** de la
  font. Repintar el llenç no en canvia cap; fer zoom canvia el zoom, i per això
  el tall desapareixia en moure la vista.

**La revisió és la de l'estat de les entitats** (`SourceFeatureState`), i es
pot moure amb l'API pública: `refreshFire()` crida
`map.setFeatureState({ source: 'fire', id: 0 }, { revisio: n })` amb un número
que puja a cada repintat. MapLibre ho aplica en preparar la font, abans de
decidir les textures del mateix fotograma, i refà **totes les tessel·les que
tenen el foc a sota, i només aquestes**: les mateixes que buidaria si la font
s'anunciés com a imatge. `setCoordinates()` deixa de fer-se servir.

És un ús de l'estat d'entitats que no és el seu —el foc no té entitats—, i
depèn de com 6.15 construeix l'empremta. Si una versió nova de MapLibre ho
canvia, el símptoma tornarà a ser aquest, i el lloc on mirar és aquí. Seria
un error per comunicar a MapLibre: la comprovació `type === 'image'` deixa fora
`'canvas'` i `'video'`, que són imatges.

**Al navegador no s'ha mirat**: ho prova Pere.

> Comprovat per Pere el mateix dia: el foc ja no es talla.

### 13.7. Les vores entre tessel·les del relleu es veuen, i es deixen

Vist el 16/11/2026, després de la §13.6: amb el relleu inclinat i de prop,
es veu una línia on canvien la nitidesa i el to de la imatge de satèl·lit.
És la vora entre dues tessel·les del terreny carregades a **nivells de zoom
diferents**: MapLibre, amb la càmera inclinada, carrega les tessel·les
llunyanes amb menys detall, i per defecte en deixa conviure fins a nou nivells
a la pantalla. Esri World Imagery fa servir imatges de dates i fonts diferents
segons el zoom, de manera que el to també salta; i el relleu ombrejat, calculat
del DEM de cada nivell, també.

No és del foc ni de la §13.6, i no s'arregla del tot: de lluny el detall ha de
baixar. Es podria reduir amb `map.setSourceTileLodParams()`, que limita quants
nivells hi ha alhora a la pantalla, a canvi de carregar més tessel·les o de
perdre detall a prop de la càmera. **Es deixa com està**, per decisió de Pere:
no val la pena si costa rendiment.
