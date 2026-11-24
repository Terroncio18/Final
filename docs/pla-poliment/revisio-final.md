# La revisió final, a fons

24/11/2026. Demanada per Pere en acabar l'avaluació de la §11.77–§11.79, i
deixada al criteri de Claude. L'objectiu és **tancar-ho tot fins a la fase
7**, que és la seva: la prova de la interfície al navegador.

## Per què una altra revisió

Perquè les tres que hi ha hagut buscaven la mateixa cosa. La de la §11.74
—82,20/100— i la segona —91— buscaven **defectes**: lectures que fallen i no
es reintenten. La d'avui, amb les dues meitats a 88, buscava el mateix i en va
trobar sis més. Tot això està arreglat.

El que **ningú ha mirat mai** és això:

- **Repetició.** Nou fitxers implementen el mateix patró de «descarta la
  resposta que ja no vull», i el de «oblida la lectura fallida» s'ha replicat
  a mà cinc vegades només avui. El parell avís-més-botó ja és a dos llocs.
- **Codi mort, altra vegada.** La fase 4 es va fer el 20/11 i des d'aleshores
  el codi s'ha mogut molt: cinc fases, dues revisions i sis arranjaments.

  > **Esmena del mateix dia.** Aquest pla deia que
  > `simulation/fire-appearance.ts` i les seves set proves continuaven sense
  > importador, «confirmat avui». **Era fals**: aquells fitxers no existeixen,
  > es van retirar a la §11.66. La comprovació estava mal feta —un `grep`
  > d'importadors sobre un fitxer absent no diu que sigui mort, diu que no
  > hi és— i l'error va arribar també a l'encàrrec 05. Ho va trobar Codex a
  > `de-codex/05-b2-codigo-muerto.md`. El que sí queda són **referències
  > velles** a `docs/ajuda-foc-codex.md`, `docs/inventari-web.md`,
  > `web/angular.json` i `web/vitest.config.ts`, que encara els anomenen.
- **Si les proves proven.** Són 440 i passen totes. Avui es va descobrir que
  el doble del servei de deteccions no tenia `retry`, de manera que el botó
  de la §11.78 **no l'havia premut cap prova**. Quantes més n'hi ha com
  aquella?
- **El que no s'ha llegit a fons.** Unes 1.900 línies de `simulator-view.ts` i
  `countermeasure-plan.ts` llegides per estructura; `agent-models.ts`,
  `fire-particles.ts` i `agents-3d.ts` només pel cantó dels recursos; i a
  l'API, `fuels.ts` —557 línies— i `fuel-raster.ts`.

## Com es treballa, amb el que s'ha après avui

Vuit regles, i cada una ve d'una cosa que va passar:

1. **El contracte es fixa abans.** Quan una cosa té dos costats, s'acorden els
   noms per escrit abans que ningú escrigui res. És el que va fer caure el
   defecte de la cobertura parcial amb els dos treballant alhora.
2. **Les anàlisis són de només lectura.** Sense edicions no hi ha xocs, i tots
   dos poden anar a la vegada. Això ja va funcionar.
3. **Els canvis es reparteixen per fitxers, escrits a l'encàrrec.** Per
   carpetes no serveix quan tot cau al mateix lloc.
4. **Cada canvi amb la seva regressió, comprovada revertint-lo.** I
   **comprovant la comprovació**: el primer script que ho mirava buscava
   `× nom` en una sortida amb colors i deia que cap prova fallava. Les quatre
   donant el mateix resultat va ser el que ho va delatar.
5. **Els números de l'altre es tornen a comptar.** Un informe deia 120 proves
   i n'hi havia 121.
6. **Les portes es passen quan l'altre ha sortit**, no mentre el seu procés
   encara escriu.
7. **La bústia no avisa ningú.** Un encàrrec es llança amb
   `codex exec --approve-for-me` —i `-s` no s'hi pot combinar—.
8. **Qui revisa no commiteja.** Ho autoritza Pere.

## Fase A — El contracte, i les tres decisions obertes

Les tres decisions de la fase 0 bloquegen la unificació: no es pot treure la
repetició del patró dels nou fitxers sense dir **quina** de les tres maneres
és la del projecte. Pere ho ha deixat al criteri de Claude, de manera que
aquí hi ha la proposta, per a vetar-la si cal:

**«Aquesta resposta ja no la vull» són dos problemes, no un.** Quan la feina
és un `fetch`, un `AbortController`: cancel·la de debò la petició i no només
descarta la resposta, cosa que amb FIRMS és quota. Quan no ho és —un càlcul
com `fire-run`, una importació diferida com `map-agents`— un testimoni amb
nom, una classe petita i provada, en lloc de tres `if` repetits a cada
servei. I el cas de `places.service.ts` no és cancel·lar sinó **no repetir**
el que ja s'ha demanat: és una tercera cosa i es diu diferent.

**`async`/`await` a tot arreu.** L'API ja ho és sencera; al web només queda
la cadena de `load()` a `hotspots.service.ts`, amb un `await` dins d'un
`then`, que és el que fa que costi de llegir.

**Res de `void` nu sobre una cosa que pot rebutjar.** Un ajudant amb nom que
hi enganxi el `catch` i registri amb el prefix del seu mòdul. Una navegació
que falla en silenci és justament el que es vol saber.

El que surti d'aquí s'escriu com a **regla a `estil.md`** —amb la dels
prefixos de consola, que ja es compleix al codi i encara no és escrita— i
tanca la fase 0.

## Fase B — Quatre anàlisis, de només lectura, alhora

Cap edició. Les quatre es reparteixen entre els dos, i cada informe va a la
bústia amb fitxer i línia.

- **B1. Repetició i reutilització.** Què es repeteix, quantes vegades, i
  **on hauria de viure** cada cosa compartida. No es proposa cap carpeta
  `utils/`: l'estructura d'aquest projecte és per domini, i un barril
  compartit entre la càscara i el tros diferit pot arrossegar codi al paquet
  inicial, que és l'avís que `estil.md` ja porta escrit.
- **B2. Codi mort, al dia.** Amb el codi d'avui, no el del 20/11.
- **B3. Si les proves proven.** Una mostra, no les 440: per cada una, passaria
  igual amb el comportament trencat? I els dobles, diuen el mateix que la
  classe que imiten?
- **B4. El que no s'ha llegit a fons.** Les 1.900 línies, el 3D i els dos
  fitxers grans de l'API.

## Fase C — La decisió

Els informes es llegeixen junts i **Pere decideix** què s'unifica, què
s'esborra i què es queda com és. Abans d'això no es toca res. És el que diu
el `CLAUDE.md`: la decisió es proposa abans d'escriure el codi.

## Fase D — El canvi, i la revisió creuada

Repartit per fitxers, amb la llista escrita abans. Cada cosa amb la seva
regressió i la seva reversió. Les vuit portes en verd a cada volta. Commits
per mòduls, quan Pere ho autoritzi.

**I en acabar, cadascú revisa el codi de l'altre.** Demanat per Pere el
24/11/2026: Claude revisa el que ha escrit Codex, Codex revisa el que ha
escrit Claude, i es contrasten les dues revisions. El motiu és el que la
fase B ja va demostrar: creuar les auditories de proves va trobar tres coses
a les proves de Claude que Claude no havia vist, i una als dobles de l'API
que Codex no havia vist. Qui ha escrit una cosa és qui pitjor la revisa.

La revisió creuada mira el canvi, no el fitxer sencer: què fa de debò, si la
regressió prova el que diu que prova, i si l'arranjament ha obert res pel
costat. Les dues revisions van a la bústia i es llegeixen juntes; el que
una trobi i l'altra no, es diu.

## Fase E — El full per a la fase 7

El lliurament a Pere, i ara mateix és el deute més gros: **quatre avisos i
dos botons que només existeixen a les proves**. El selector de dates diu
«ha fallat», «són d'abans, de fa tant» i «incompleta», i el pas d'ignició té
el seu botó de reintentar; tots viuen dins de panells que s'obren clicant, de
manera que qui no els obri no en veurà cap.

La fase E recull això en una llista: cada cosa nova des de la fase 5, on es
veu, què s'ha de fer per a veure-la, i què hauria de passar. Perquè la prova
de la fase 7 no sigui recordar-ho de memòria.

## Els límits, que es mesuren

- **El paquet inicial no creix.** El tros gros són 1,06 MB avui; es mesura
  abans i després.
- **Les proves no baixen de 440**, i si alguna desapareix s'explica.
- **La cobertura no baixa** del que digui l'última passada.
- **Complexitat 15** i cap funció de producció per sobre de 80 línies, que
  avui es compleix.
- **Les vuit portes**, cada volta.

## Què no entra

Les fases 8, 9 i 10 —manuals, publicar i Sonar—. Les fórmules, unitats i
escenaris del model. I res visual: això és la fase 7 i és de Pere.
