# Documentació d'IgnisLab

Com buscar-hi sense gastar: l'índex és [`bitacola/README.md`](bitacola/README.md)
i cada decisió és un fitxer petit amb el número al davant. Obre el fitxer que
l'índex digui, i no la carpeta sencera. Sovint un `grep -rn "<paraula>"
docs/bitacola` ja diu quin és el fitxer i s'estalvia fins i tot l'índex.

## Què hi ha

- **`bitacola/`** — les decisions i els motius, que és el material de base de
  la memòria. L'índex és `README.md`; la fase 1 —el mapa i el formulari,
  tancada el 5/11/2026— a `fase-1/`, i la fase 2 —el simulador i la vista 3D,
  oberta— a `fase-2/`. Una decisió és un fitxer de menys de 150 línies i els
  números no es renumeren mai.
- **`contramesures.md`** — què fa cada contramesura al càlcul: multiplicadors,
  litres, retenció, assecat, i què s'ha mirat al navegador. Els motius són a
  la bitàcola, de la §11.27 a la §11.31.
- **`combustibles/README.md`** i **`combustibles/IMPLEMENTACION.md`** — d'on
  surt el model de combustible de cada cel·la: les fonts oficials, la conversió
  des de la coberta del sòl i què vol dir «estimat» a la pantalla. Al costat hi
  ha `verificar_fuentes.py`, que és com es van comprovar els serveis.
- **`propagacion-firecast.md`** — el prototip FireCast, que és la referència
  visual de la §11.7 i de la §11.20.
- **`ajuda-foc-codex.md`** — la proposta d'aspecte i animació del foc del
  14/11/2026, conservada com a registre: el pintor que descriu ja s'ha
  substituït, i el mateix document ho diu a dalt.

## El que no s'ha d'obrir

Són dades, i els seus README ja expliquen què hi ha:
`combustibles/soller-muestra.geojson` —972 kB en una sola línia— i
`combustibles/verificacion.json`. Fora d'aquí, tampoc `web/public/data/`, que
són 13 MB de geometria, ni `api/data/`, que no és al repositori.

## Si hi escrius

Una decisió nova és un fitxer nou a la fase oberta, amb el número següent, i
una línia a l'índex. Mai no es renumera res: el codi cita aquests números als
comentaris (§2.29, §11.27).
