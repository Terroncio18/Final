# Les setze pendents del punt 12: com es tanquen

Demanat per Pere el 24/11/2026: «anem a tancar-les totes». Això és la proposta,
abans de tocar res. Hi han treballat Claude i Codex per separat —encàrrec 10— i
després s'han contrastat.

## El titular

**No són setze decisions pendents.** Són de quatre classes, i tres de les
entrades parteixen d'una premissa que ja ha caducat:

- La **12.2** diu dins del seu propi cos «Resolta el 14/11/2026 a la §11.21».
  No és una pendent: és un ratllat que falta.
- La **12.7** diu que «el que és realment el punt d'ignició encara no
  existeix». Existeix des de la §11.15, del 13/11: l'eina posa focus amb un
  clic. La condició que l'entrada posava per fer el canvi de nom ja es
  compleix.
- La **12.10** diu que el CORS d'IPMA «no s'ha comprovat». La §11.18 diu «CORS
  obert —comprovat—».

I una **frase morta** entre la 12.12 i la 12.1: «La primera que toca és la
12.4». La 12.4 es va resoldre el 5/11 i és ratllada més amunt.

## El que ho canvia tot: la §11.49

El 16/11 Pere va retirar de la pantalla les marques, els punts d'aigua, els
aeròdroms i la tria del lloc de càrrega —«ens compliquem massa»—, i amb elles
les rutes de l'API i el script de preparació. Les entrades **12.23**, **12.24**
i **12.26** parlen de completar una funció que ja no hi és. No es tanquen dient
«falta la resta»: es tanquen dient que es van retirar.

Això el va trobar Codex, i jo no: jo havia llegit el fitxer del 12 i no la
§11.49. És la segona vegada aquesta setmana que el motiu era a la bitàcola i no
hi vaig anar (§11.82).

## Les setze, una per una

| #         | Què és de debò                                | Es tanca dient                                                          | Pere? | Codi     |
| --------- | --------------------------------------------- | ----------------------------------------------------------------------- | ----- | -------- |
| **12.1**  | Decisió de font, amb efecte a la memòria      | Es queda Terrarium; el GLO-30 és millora futura, no dada emprada        | Sí    | —        |
| **12.2**  | Ja resolta, sense ratllar                     | §11.21: `MODCOMB = 0` és desconegut i hi respon WorldCover              | —     | —        |
| **12.5**  | Model fet; validació, futura                  | És Rothermel de superfície amb els límits de les §11.19–§11.31          | —     | —        |
| **12.7**  | Deute de noms, i ara **viu**                  | Depèn de la teva resposta                                               | Sí    | ~20 refs |
| **12.8**  | Defecte d'una decisió ja presa                | Les xifres exclouran el mar, com el model (§11.19)                      | —     | **Sí**   |
| **12.10** | Decisió presa i no escrita                    | Estació completa més propera, sense interpolació, i es diu la distància | Sí    | —        |
| **12.16** | Hipòtesis sense calibrar                      | Són escenaris amb paràmetres editables, no eficàcia real                | Sí    | —        |
| **12.18** | **No és una pendent**: és l'entrega de fase 8 | No es tanca avui                                                        | —     | —        |
| **12.19** | Feina feta (§11.42)                           | Arribada, efectius, rendiment i parada de seguretat, fets               | —     | —        |
| **12.20** | Visualització feta (§11.43, §11.50)           | Els agents mostren la feina calculada; l'autonomia és fora              | —     | —        |
| **12.21** | Horitzó, no feina                             | Les tres condicions són cada una més grans que el treball               | —     | —        |
| **12.22** | Línia de recerca                              | Un altre treball; depèn de la 12.19 i de la 12.23                       | —     | —        |
| **12.23** | Feta i **retirada** (§11.49)                  | Es retira de l'entrega per decisió teva                                 | —     | —        |
| **12.24** | Recerca d'una funció retirada                 | No s'amplia; i no es diu que Espanya no tingui fonts, que seria fals    | —     | —        |
| **12.25** | Fonts absents + eleccions fetes               | Provisionals i declarats; cinc lletres, cinc respostes                  | Sí    | —        |
| **12.26** | Font no trobada d'una funció retirada         | No s'inventa una mida mínima; la tria de càrrega és fora                | —     | —        |

Compte: **nou** es tanquen sense preguntar-te res, **quatre** amb el teu sí, la
**12.8** quan el codi hi sigui, la **12.7** segons què triïs, i la **12.18**
queda oberta fins que el manual existeixi.

## Les respostes de Pere, del 24/11/2026

Contestades una per una. **Tres no són la recomanació**, i dues d'aquestes
tres canvien el foc calculat:

| Pregunta      | Resposta                     | Era la recomanació?                 | Feina que obre                                  |
| ------------- | ---------------------------- | ----------------------------------- | ----------------------------------------------- |
| **12.1**      | Mesurar primer (A/B)         | No (jo deia entregar amb Terrarium) | La mesura: 6–12 h, i cal baixar les dues fonts  |
| **12.10**     | Es queda com ara             | Sí                                  | Escriure-ho                                     |
| **12.16**     | Hipòtesis declarades         | Sí                                  | Escriure-ho                                     |
| **12.25 (a)** | Provisionals i sense font    | Sí                                  | Escriure-ho                                     |
| **12.25 (b)** | **El NWCG, 7 m/h**           | No (jo deia Ortega)                 | **Codi**: canviar el valor per defecte          |
| **12.25 (c)** | **Amb arribada i rendiment** | No (jo deia deixar-lo instantani)   | **Model**: el contrafoc deixa de ser instantani |
| **12.25 (d)** | **Es cancel·len**            | No (jo deia mantenir-les)           | **Model**: les passades programades cauen       |
| **12.8**      | Treure el mar                | Sí                                  | **Codi**: les quatre xifres                     |
| **12.7**      | El canvi de nom, ara         | Sí                                  | **Codi**: unes 20 referències i dos fitxers     |

Això ja no és una sessió d'escriptura: **la 12.25 (c) i la (d) canvien el foc
que surt**, i la (b) el fa gairebé sis vegades més lent a la línia manual. Van
amb la seva decisió escrita abans del codi, com manen les normes de la casa, i
amb la seva regressió.

## El que es va preguntar

Cada una portava la recomanació. Les respostes són a la taula de sobre.

1. **12.1** — S'entrega amb Terrarium com a DEM del relleu i de la pendent, i
   el Copernicus GLO-30 només citat com a millora futura? **Sí**: canviar-lo
   vol dir servir-nos les tessel·les nosaltres i repetir les comprovacions del
   terreny.
2. **12.10** — La meteorologia en directe es queda amb l'estació completa més
   propera al centre, sense distància màxima ni correcció per relleu, ensenyant
   la distància i dient el límit a la memòria? **Sí**: és el que el codi ja fa
   des de la §11.18.
3. **12.16** — Els números de contramesures i brases es presenten com a
   escenaris amb paràmetres editables, sense afirmar eficàcia real? **Sí**, i
   es diu que el pla màxim —100 mesures, 512 vèrtexs— no s'ha mesurat.
4. **12.25 (a)** — Els rendiments de tallafoc, tala i extinció de restes es
   queden provisionals i sense font, sense treure'n conclusions quantitatives?
   **Sí**.
5. **12.25 (b)** — Es ratifiquen els 40,2 m/h per persona d'Ortega et al. com a
   valor per defecte de la línia manual, en lloc dels 7 m/h sostinguts del
   NWCG? **Sí, Ortega**, per àmbit espanyol, dient que les dues mesures no es
   van fer en les mateixes condicions.
6. **12.25 (c)** — El contrafoc segueix instantani, sense arribada ni
   rendiment, com a simplificació declarada? **Sí**: donar-li brigada canvia
   model, pantalla, escenaris i proves.
7. **12.25 (d)** — Quan una brigada d'una línia d'aigua s'atura, les passades
   futures sobre les cel·les ja fetes es mantenen? **Sí**, com a lectura
   literal del contracte, dient que és una simplificació.
8. **12.8** — Trec el mar de les quatre xifres —mínim i màxim d'altitud, màxim
   i mitjana de pendent— amb el criteri d'elevació ≤ 0 que el model ja fa
   servir? **Sí**. Dues coses que cal dir: s'ha de decidir què s'ensenya si el
   domini no té cap cel·la de terra, i la pendent d'una cel·la de costa seguirà
   sortint dels seus veïns, de manera que no es promet una costa exacta.
9. **12.7** — Es fa ara el canvi de nom, o es deixa el deute? **Aquí Codex i jo
   no coincidim.** Ell el deixaria per a després de l'entrega. Jo el faria ara,
   i el motiu és aquest: a `simulator-view.ts` hi ha cinc línies que diuen
   `const centre = this.ignition()` mentre les ignicions de debò són
   `this.starts()`. La mateixa paraula anomena dues coses al mateix fitxer. Són
   unes vint referències i dos fitxers per reanomenar, mecànic i amb les proves
   al costat; i val més que ho tinguis renombrat **abans** de la teva prova de
   fase 7, no després.

## Si dius sí

1. Es tanquen les nou que no et necessiten, ratllant-les i deixant intacte el
   que es plantejava.
2. S'apliquen les teves quatre respostes.
3. Es fa el codi de la 12.8, amb la seva prova del cas costaner, i llavors es
   ratlla.
4. La 12.7, segons el que triïs.
5. Es treu la frase morta de la 12.4, i l'índex de la bitàcola deixa de
   presentar-les totes com a «pendents obertes».
6. Tot plegat és una entrada nova de bitàcola, la §11.85.

La 12.18 es queda oberta fins que el manual d'usuari sigui al repositori. És
l'única de les setze que no es pot tancar avui sense escriure una cosa que no
és veritat.
