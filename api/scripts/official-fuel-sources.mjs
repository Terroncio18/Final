/** Audited sources, not inferred land-cover conversions. See docs/combustibles/FUENTES-OFICIALES.md. */
const canariasRoot =
  "https://www.gobiernodecanarias.org/medioambiente/descargas/Biodiversidad/modelos_combustibles/";
const canariasLegend =
  "https://www.gobiernodecanarias.org/medioambiente/descargas/descargas/Biodiversidad/Forestal/cartografia-forestal-documentos/Modelos_Combustible_proceso.pdf";
const islands = [
  ["tenerife", "Tenerife", "TENERIFE", "tf_mc_gen.tif"],
  ["gran-canaria", "Gran Canaria", "GRAN CANARIA", "gc_mod_gen.tif"],
  ["la-palma", "La Palma", "LA PALMA", "lp_mc_gen.tif"],
  ["la-gomera", "La Gomera", "GOMERA", "go_mc_gen.tif"],
  ["el-hierro", "El Hierro", "HIERRO", "hi_mc_gen.tif"],
];
const cvBase =
  "https://terramapas.icv.gva.es/0506_PATFOR?service=WFS&version=2.0.0&request=GetFeature&typeNames=Regulacion.Incendios.Combustible";
export const officialFuelSources = [
  {
    id: "cetemas-asturias",
    label: "CETEMAS / Principat d’Astúries · Rothermel LiDAR 25 m",
    url: "https://www.cetemas.es/wp-content/uploads/2026/05/Mapa_mcb_2cob-1.zip",
    member: "ROTHERMEL_ASTURIAS_filter.tif",
    rangeMember: true,
    // QML: 7 means "Modelo 7 o 10" (ambiguous); 21 = "Sin modelo". -128 is unclassified.
    excludedValues: [-128, 7, 21],
    date: "LiDAR 2020 (2a cobertura) · MFE/IFN4 2009–2010",
    attribution:
      "© CETEMAS / Gobierno del Principado de Asturias · CC BY · reprojectat i mostrejat",
    license: "CC BY (catàleg CETEMAS)",
    legendUrl: "https://www.cetemas.es/descargas-ide/",
    priority: 20,
  },
  ...islands.map(([slug, label, archive, member]) => ({
    id: `canarias-${slug}`,
    label: `Govern de Canàries · ${label} · NFFL 25 m`,
    url: `${canariasRoot}${encodeURIComponent(archive)}.zip`,
    member,
    date: "Metodologia 2015 · LiDAR 2011–2013; edició del fitxer no declarada",
    attribution: "© Gobierno de Canarias · GRAFCAN / AGRESTA",
    license: "Avís legal del Gobierno de Canarias; no es declara CC",
    legendUrl: canariasLegend,
    priority: 20,
  })),
  {
    id: "icv-valencia-patfor",
    label: "ICV / Generalitat Valenciana · PATFOR Rothermel",
    url: `${cvBase}&outputFormat=shp`,
    hitsUrl: `${cvBase}&resultType=hits`,
    member: "Regulacion.Incendios.Combustible.shp",
    field: "mod_comb",
    date: "PATFOR · any de referència del fitxer no declarat",
    attribution:
      "© Generalitat Valenciana · Institut Cartogràfic Valencià · CC BY",
    license: "Creative Commons Attribution (catàleg GVA)",
    legendUrl:
      "https://icvficherosweb.icv.gva.es/04/geonetwork/definicion_datos/fore_patfor_modelo_combustible.pdf",
    priority: 20,
  },
  {
    id: "sitna-navarra",
    label: "SITNA / IDENA · Navarra · Rothermel LiDAR",
    url: "https://idena.navarra.es/descargas/FOREST_Pol_ModeCombus.zip",
    member: "FOREST_Pol_ModeCombus.shp",
    field: "IDCOMBUSTI",
    date: "2019 · actualització LiDAR del mapa de 2005",
    attribution:
      "© Gobierno de Navarra · SITNA / IDENA · LIFE-IP NAdapta-CC · CC BY 4.0",
    license: "CC BY 4.0",
    legendUrl:
      "https://datosabiertos.navarra.es/dataset/spasitnaforest_pol_modecombus-xml",
    priority: 20,
  },
];
