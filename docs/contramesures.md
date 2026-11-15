# Contramesures del simulador

Implementació del pla de contramesures d'IgnisLab, 15/11/2026. Desenvolupada en
paral·lel: Codex, model i escenaris; Claude, panell i mapa. La coordinació local
viu a `C:/Proyectos/TFG/Pere/CONTRAMESURES_COORDINACIO.md`.

## Què es calcula

El pla existeix sencer a **T=0**. Canviar-lo invalida el resultat i requereix tornar
a calcular. No es modelen construcció, arribada de recursos ni operacions sobre
un foc ja en marxa. Aquesta decisió conserva la reproduïbilitat del solver de
temps mínim de viatge i impedeix aplicar una intervenció retrospectivament.

| Tipus | Efecte numèric | Geometria |
| --- | --- | --- |
| Línia de defensa / tallafoc | Cèl·lules que no propaguen foc | Franja permanent |
| Tala i desbrossament | Multiplicador permanent de velocitat | Franja |
| Línia d'aigua | Multiplicador fins a la caducitat | Franja |
| Helicòpter / avió amfibi | Multiplicador fins a la caducitat | Disc |
| Retardant | Multiplicador fins a la caducitat | Franja |
| Contrafoc | Ignicions addicionals a T=0 | Franja |

Els presets són **paràmetres experimentals editables**, no rendiments mesurats
de brigades o aeronaus. No provenen d'una calibració d'extinció. La reducció
modifica la velocitat de propagació i, amb aquesta, la intensitat derivada; no
recalcula la humitat ni les classes de càrrega del combustible de Rothermel.
En particular, el desbrossament és una aproximació de reducció de velocitat,
no una reconstrucció del llit de combustible.

Les barreres són ideals dins del model de foc de superfície. No hi ha spotting,
salt de brases, foc de capçades, ruptura d'una línia per intensitat o probabilitat
de fallada. Que el model aturi el foc no demostra que una línia real el contingui.
El contrafoc pot **augmentar** l'àrea cremada; no es resta de l'estadística ni es
converteix en una franja impermeable. Ignicions sobre barreres donen error.

## Espai i temps

La graella és de 30 m. Un disc o franja inclou totes les cèl·lules que toca,
inclòs un contacte amb la vora. El càlcul usa la distància exacta entre cada
quadrat i el segment, amb extrems arrodonits. És una rasterització conservadora:
la petjada efectiva pot ser més ampla que la geometria dibuixada, especialment
per a línies de 30 m. No ofereix precisió de brigada ni línies subcel·lulars.
Els vèrtexs han de ser dins del domini; la part de l'amplada que en surt es retalla.

El combustible original no es modifica. Les barreres s'apliquen al camp de
velocitats; els passos llargs comproven totes les cèl·lules travessades i els
contactes diagonals. Els desbrossaments s'apliquen una vegada al camp de velocitats.

En les superposicions preval la reducció més forta. Dues reduccions del 70 % no
es multipliquen per crear una del 91 %. Una reducció temporal més feble que el
desbrossament permanent no afegeix efecte.

L'aigua i el retardant mantenen un factor constant fins al minut de caducitat,
quan l'efecte desapareix. És una caducitat discreta, no una evaporació física.
Cada trajecte s'integra per trams temporals: si el front entra abans de caducar
i surt després, només la distància recorreguda abans es frena. Això conserva
l'ordre d'arribada (FIFO) necessari per Dijkstra. Velocitat i intensitat de les
sèries es corregeixen pel tractament actiu quan arriba el foc a cada cèl·lula.

## Fitxers i validació

Els escenaris nous són versió 2 i afegeixen `contramesures = [...]` en JSON dins
del fitxer de text existent. Els fitxers versió 1 continuen obrint-se. Un pla
malformat es rebutja sencer amb un missatge: perdre una barrera silenciosament
canviaria la pregunta simulada. També es rebutgen versions futures desconegudes.

Límits: 100 mesures, 64 vèrtexs per mesura, 512 en total, amplades de 30 a 3000 m,
reducció de 0 a 95 %, durades temporals d'1 a 720 min i 0 per efectes permanents.
IDs únics; coordenades finites; franges amb almenys dos punts diferents.

## Verificació

Les proves cobreixen el resultat base sense mesures, obstacles continus i
diagonals, reducció permanent, caducitat abans d'arribar i durant el trajecte,
superposicions, FIFO, geometria, límits, entrada corrupta, immutabilitat del
combustible, contrafoc i persistència. No substitueixen una calibració amb dades
d'extinció ni una validació operativa.

Des de `web`: `npm test -- --watch=false` i `npm run build`.

La suite pura s'executa amb Vitest i les proves Angular amb el seu builder: aquest
últim no admet els mocks de mòduls relatius de les proves de propagació.
Verificació final: 71 proves passen (48 de simulació i 23 Angular); build de
producció sense avisos. El càlcul de distància a les ignicions usa una transformada
euclidiana exacta de cost lineal quan un contrafoc genera moltes llavors.

El panell permet editar amplada, durada i reducció experimental. Una franja
inacabada impedeix iniciar o desar, fins que es finalitza o es cancel·la.
No s'ha pogut completar la comprovació visual interactiva: el navegador integrat
no connecta amb localhost i el control del navegador local rebutja entrades per
interferència d'usuari. Per tant, dibuix real, aspecte sobre el relleu i interacció
amb el mapa queden pendents de revisió manual; no es donen per verificats pels tests.
