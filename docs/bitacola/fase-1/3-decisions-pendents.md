# 3. Decisions pendents

- ~~**3.1. Llenguatge del backend.**~~ Resolta el 25/10/2026: Node amb Fastify
  (§2.12).
- **3.2. Model digital d'elevacions.** Passa a la fase 2, §12.1: qui en depèn
  és el model i no el mapa.
- **3.3. Polígons sense model de combustible.** Passa a la fase 2, §12.2.
- **3.4. Com anomenar la jerarquia a Portugal.** Els NUTS 2 i 3 portuguesos són
  regions estadístiques, no comunitats ni províncies, i els seus 18 districtes
  —amb què treballa l'ICNF— no hi surten. El tercer nivell ja no hi entra:
  confirmat el 29/10/2026 que a Portugal es treballa amb freguesies i que la
  interfície les anomena pel seu nom (§2.25). Queda obert només com anomenar
  els dos nivells de dalt, que ara la interfície escriu «regió» i «província».
- ~~**3.5. Cremes agrícoles i incendis.**~~ Resolta el 29/10/2026: etiqueta per
  potència i cap afirmació sobre què crema (§2.17). Res no es filtra. Distingir
  rostoll de bosc queda per quan hi hagi coberta del sòl (MFE25, COS).
- **3.6. Terreny 3D a la vista de simulació.** Passa a la fase 2, §12.3.
- **3.7. Què és «un focus» en clicar.** Un episodi real dona centenars de
  deteccions de 375 m solapades i FIRMS no les agrupa en incendis.
- ~~**3.8. Pressupost de *bundle*.**~~ Resolta el 29/10/2026: els límits
  passen a 1,5 MB d'avís i 1,75 MB d'error, i `ng build` ja no falla.
  - La mesura del dia: **1,40 MB en cru i 314 kB per la xarxa**. El sòl és
    MapLibre, uns 1,29 MB, que no depèn de res del que s'escrigui aquí; els
    tres passos del formulari sencers van costar uns 110 kB crus i menys de
    15 kB comprimits.
  - Els límits nous no són un xec en blanc: encara detecten un creixement propi
    d'uns 100 kB (avís) o 350 kB (error), que és el que es vol vigilar.
  - El pressupost mira la mida crua i qui pateix és la comprimida, i 314 kB per
    a una aplicació de mapes és normal. Carregar MapLibre a part queda per si
    algun dia es mesura que l'espera de la portada molesta de debò.
- ~~**3.9. L'antiguitat de les dades no arriba a la pantalla.**~~ Tancada el
  5/11/2026 sense fer-la, amb la 3.10: el motiu és allà, perquè és el mateix.
  El servidor publica `x-fetched-at` i `x-stale`, però la font GeoJSON la
  descarrega MapLibre pel seu compte i ningú llegeix les capçaleres.
- ~~**3.10. Deteccions fora de l'àmbit.**~~ Tancada el 5/11/2026 **sense
  fer-la**, i amb ella la 3.9. Les dues es resolien amb el mateix canvi —que el
  navegador es descarregués ell mateix el GeoJSON en lloc de donar-ne la URL a
  MapLibre, cosa que posava les capçaleres a l'abast i donava on etiquetar i
  filtrar cada detecció— i la decisió és no pujar la complexitat del camí de
  dades per dues coses de poc pes. El preu, dit perquè consti: la portada
  dibuixa deteccions del nord del Marroc i d'Algèria —la caixa peninsular hi
  arriba, 65 de les 196 del 25/10/2026, un terç del que es veu— i no diu de
  quan són les dades. El diagnòstic i la via es queden escrits a sota per si
  alguna vegada el preu canvia.
  - Retallar la caixa per latitud no serveix: 41 d'aquestes 65 queden per sobre
    del paral·lel de Tarifa, perquè la costa argelina entre Alger i Dellys va
    dels 36,1° als 36,8°, més al nord que Màlaga.
  - La via és punt-dins-de-polígon contra `regions.geojson`, que el navegador
    ja té carregat, amb un marge d'uns 3 km. Amb el polígon cru hi cauen
    deteccions reals de la costa —el 25/10/2026, dues al Rincón de la
    Victoria— perquè GISCO a 1:3 M retalla la línia de costa. El marge no
    deixa entrar res africà: Ceuta i Melilla no són al fitxer i l'Estret fa
    14 km.
- **3.11. La llengua dels noms de regió.** GISCO dona el nom oficial de cada
  regió, de manera que una interfície en català llista «Cataluña», «País Vasco»
  i «Illes Balears» de cop. Germana de la 3.4.
- ~~**3.12. Clicar una detecció amb el formulari obert.**~~ Resolta el
  29/10/2026: durant el formulari la capa s'apaga i no hi ha clic possible
  (§2.21). Que una detecció porti directament al seu municipi —la unió entre
  els dos camins cap a la simulació— passa a ser una millora, no un forat.
  - Etiquetar i no descartar: una propietat `region` a cada detecció i un
    `filter: ['has', 'region']` a la capa. Tornar a mostrar-les és una línia,
    es pot dir quantes se'n descarten, i el nom de la regió és justament el que
    la barra lateral haurà d'escriure (§2.9).
- ~~**3.13. L'atribució del mapa no és completa.**~~ Resolta el 29/10/2026:
  les tres cadenes diuen ara el que demana cada proveïdor (§6). Preu que es
  paga: els crèdits ocupen tres línies a baix a l'esquerra. Es podrien amagar
  darrere del botó plegable, però GISCO demana que la nota sigui **visible**,
  de manera que es queden a la vista.
  - Implica que el navegador es descarregui ell mateix la resposta en lloc de
    donar-ne la URL a MapLibre, cosa que de passada posa les capçaleres a l'abast
    i desencalla la 3.9.
