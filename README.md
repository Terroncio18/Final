# IgnisLab

Simulador d'incendis forestals. Treball de Fi de Grau de Pere Terrón.

Calcula la propagació d'un incendi sobre terreny real amb el model de
Rothermel, amb vent, combustible, brases i contramesures, i la dibuixa sobre
un mapa amb relleu. Les deteccions de focs actius surten de la NASA i la
meteorologia d'AEMET i de l'IPMA.

Són **dues meitats independents**, cada una amb el seu `package.json`:

| Carpeta | Què és                                                       | Com s'executa |
| ------- | ------------------------------------------------------------ | ------------- |
| `web/`  | L'aplicació: Angular 22, _zoneless_, amb MapLibre i three.js | `npm start`   |
| `api/`  | El servidor: Fastify i TypeScript                            | `npm start`   |

**No és un monorepo**: s'entra a cada carpeta per separat i s'hi instal·len les
dependències per separat. No hi ha base de dades ni Docker; no cal res més que
Node.

## 1. Què et cal abans de començar

**Node.js** i **npm**. La versió no és opcional: l'Angular 22 d'aquest
projecte declara que necessita

```
node: ^22.22.3 || ^24.15.0 || >=26.0.0
npm:  >=8
```

Comprova què tens:

```powershell
node --version
```

```powershell
npm --version
```

Si Node és més antic, **`npm install` no falla: només avisa**, i el problema
apareix més tard, quan l'Angular CLI es nega a arrencar. Val més comprovar-ho
ara. Node es descarrega de [nodejs.org](https://nodejs.org/); la versió LTS 22
o 24 serveix.

**Git**, només per a clonar. Si has rebut el projecte en un ZIP, no el cal.

**Espai al disc.** El projecte entregat ocupa uns **65 MB** —els 21 MB de
dades administratives hi són a dins—, i instal·lar les dependències hi afegeix
uns **520 MB**: 392 MB al `web/` i 129 MB a l'`api/`. Compta amb 600 MB.

**Dues claus d'API, gratuïtes.** Es demanen en un minut i arriben per correu:

- **NASA FIRMS**, per a les deteccions de focs actius:
  https://firms.modaps.eosdis.nasa.gov/api/area/
- **AEMET OpenData**, per a la meteorologia d'Espanya:
  https://opendata.aemet.es/centrodedescargas/altaUsuario

L'aplicació **arrenca i funciona sense cap de les dues**; el §6 diu què es
perd. La meteorologia de Portugal surt de l'IPMA i no demana clau.

## 2. Què porta el projecte i què no

**Sí que hi és**, dins del repositori: tot el codi i les **dades
administratives** —regions, províncies, els 81 fitxers de municipis, els 81
de topònims i l'índex de cerca, 165 fitxers en total—, uns 21 MB a
`web/public/data/`. No cal baixar-les ni
generar-les.

**No hi és**, i no cal per a arrencar:

- Les **carpetes `node_modules`**. Es creen amb `npm install` al pas 3. Per
  això el projecte s'entrega net: les dependències es descarreguen al teu
  ordinador.
- Les **dades de combustible preparades**, a `api/data/fuels/`. Sense elles el
  combustible surt **estimat** a partir d'ESA WorldCover, que es llegeix per
  xarxa i no demana clau. El §7 explica com preparar-les si les vols.

## 3. Instal·lar

Dues ordres, una a cada meitat. Des de l'arrel del projecte:

```powershell
cd api; npm install
```

```powershell
cd ../web; npm install
```

Tarden una estona i es baixen moltes dependències; és normal. Si `npm install`
del `web/` es queixa de la versió de Node, torna al §1.

## 4. Posar-hi les claus

A la carpeta `api/` hi ha un `.env.example`. Copia'l a `.env`:

```powershell
cd api; Copy-Item .env.example .env
```

Obre `api/.env` i enganxa les dues claus:

```
FIRMS_MAP_KEY=la_teva_clau_de_firms
AEMET_API_KEY=la_teva_clau_d_aemet
```

Sense cometes i sense espais. El fitxer `.env` **no es puja mai al
repositori**.

## 5. Arrencar

Fan falta **dues terminals**, una per meitat, i l'ordre importa: el web parla
amb l'API.

**A la primera**, l'API. Compila i arrenca:

```powershell
cd api; npm run build; npm start
```

Ha de dir que escolta a `http://127.0.0.1:3000`. Deixa-la oberta.

**A la segona**, el web:

```powershell
cd web; npm start
```

Ha de dir que serveix a `http://localhost:4200`. Obre-ho al navegador.

El servidor de desenvolupament del web redirigeix tot el que comenci per
`/api` cap al port 3000, de manera que **l'API ha d'estar engegada** o no hi
haurà deteccions ni meteorologia. Això és a `web/proxy.config.json`.

### Comprovar que l'API et veu les claus

Amb l'API engegada, en una tercera terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json
```

Al PowerShell, `curl` és un àlies d'`Invoke-WebRequest` i no ensenya el JSON
pelat; `Invoke-RestMethod` sí. En un terminal de debò —Linux, macOS, o el Git
Bash— `curl http://127.0.0.1:3000/api/health` fa el mateix.

Respon si cada clau hi és o falta, i quines fonts de la NASA hi ha
disponibles:

```json
{ "ok": true, "firmsKey": "present", "aemetKey": "present", "sources": {} }
```

Si diu `"missing"`, el `.env` no s'ha llegit: comprova que és a `api/`, que es
diu exactament `.env` i que has reiniciat l'API.

## 6. Què funciona sense les claus

Res no peta; es degrada, i la pantalla ho diu:

| Sense                        | Què passa                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FIRMS**                    | No hi ha deteccions de focs actius. El selector de dates diu «falta la clau FIRMS» i no ofereix tornar-ho a provar, perquè no ho arreglaria. **Tota la resta del simulador funciona.**                              |
| **AEMET**                    | La meteorologia en directe d'Espanya no arriba i la pantalla diu que el servei no respon. Es poden posar vent, humitat i temperatura **a mà**, que és el mode per omissió. Portugal continua funcionant amb l'IPMA. |
| **Les dades de combustible** | El combustible surt **estimat** des d'ESA WorldCover per xarxa, i la pantalla ho diu. Sense connexió, les cel·les queden desconegudes.                                                                              |

## 7. Opcional: preparar les dades de combustible

Només si vols combustible oficial en lloc d'estimat. Demana cartografia que no
ve amb el projecte i triga.

```powershell
cd api; npm run fuels:prepare
```

```powershell
cd api; npm run fuels:official
```

Escriuen a `api/data/fuels/`. Si les vols en una altra carpeta, posa
`FUEL_DATA_DIR` amb un camí absolut a `api/.env`.

## 8. Comprovar que tot està bé

Les proves no demanen cap clau ni cap connexió:

```powershell
cd web; npm test
```

```powershell
cd api; npm test
```

Han de passar totes. També hi ha el linter i el format:

```powershell
cd web; npm run lint
```

```powershell
cd api; npm run lint
```

## 9. Compilar per a publicar

```powershell
cd web; npm run build
```

```powershell
cd api; npm run build
```

El web deixa fitxers estàtics a `web/dist/` que es poden servir des de
qualsevol lloc. **L'API no és estàtica**: és un servidor que ha de viure, amb
els seus caus en memòria, de manera que necessita una màquina o un servei que
l'executi. On va cada meitat és una decisió oberta; és a
`docs/pla-poliment/fase-09-publicar.md`.

## 10. Si alguna cosa falla

**`npm : No es pot carregar el fitxer ... npm.ps1`**, al Windows amb
PowerShell. És la política d'execució de scripts del sistema, no del projecte.
Fes servir `npm.cmd` en lloc de `npm`:

```powershell
cd api; npm.cmd install
```

**`EADDRINUSE` al port 3000 o 4200.** Ja hi ha alguna cosa escoltant. Tanca
l'altra terminal, o canvia el port de l'API posant `PORT=3001` a `api/.env`
—i recorda que llavors el proxy del web ha d'apuntar-hi: hi ha un
`web/proxy.fuels.config.json` que ja apunta al 3001.

**El mapa surt però no hi ha deteccions.** Mira que l'API estigui engegada i
que `/api/health` digui `"firmsKey": "present"`.

**`npm install` falla amb un error de versió de Node.** §1.

**El relleu no es veu o el simulador va a batzegades.** Demana WebGL2 i una
targeta gràfica que el suporti; en una màquina virtual sense acceleració pot
no anar.

## On és la resta de la documentació

- **`docs/README.md`** i **`docs/bitacola/README.md`**: les decisions del
  projecte i per què es van prendre. És on es busca el motiu de qualsevol
  cosa.
- **`docs/estil.md`**: les dotze regles d'estil del codi.
- **`docs/pla-poliment/README.md`**: l'estat del treball i què queda.
- **`CLAUDE.md`**: les ordres de cada meitat i com s'hi treballa.

El manual d'usuari —què fa cada eina i quines hipòtesis té el model— és
pendent; és la fase 8 del pla de poliment.
