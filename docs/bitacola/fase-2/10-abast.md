# 10. Abast

El que ha de fer aquesta fase: propagar un foc sobre el domini que el formulari
deixa triat, i mostrar-lo. Fins ara el quart pas acaba en un botó desactivat i
una frase —«el simulador encara no existeix»— i això és exactament el forat que
s'obre aquí.

El que hereta de la fase 1, i que no es torna a discutir:

- **El domini** (§2.5, §2.27): 1024 × 1024 cel·les de 30 m, 30,7 km de costat,
  retallat al voltant del punt d'ignició i sense seguir cap línia
  administrativa. Són tres números lligats: la graella és el que la GPU aguanta,
  la cel·la el que les dades resolen honestament, i el costat el que surt de
  multiplicar-los.
- **El punt d'ignició a la URL** (§2.26): una simulació sencera és un enllaç, i
  l'estat no viu dins de cap component.
- **L'elevació i la pendent del domini, llegides al navegador** (§2.28) de
  tessel·les Terrarium, ja per cel·la, amb el relleu ombrejat que el quart pas
  dibuixa com a comprovació que el terreny llegit és el de sota.
- **El mapa per sobre de les rutes** (§2.20): MapLibre i el seu context WebGL
  sobreviuen cada pas, de manera que la vista de simulació no comença amb un
  mapa nou ni amb una càmera per col·locar.

El que no entra: res del mapa. Les pendents 3.4, 3.7 i 3.11 es queden a la
fase 1, obertes, i no toquen el simulador.
