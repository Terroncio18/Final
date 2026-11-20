// Rothermel (1972), INT-115, with Albini (1976) developments as collected by Andrews (2018),
// RMRS-GTR-371. Empirical constants use feet, pounds, minutes and BTU; convert only at the
// boundaries. Surface spread only: no crown-fire model or effective-wind cap.
const FT_PER_M = 3.28084;
/** Tons per acre to pounds per square foot. */
const LB_FT2_PER_TON_ACRE = 2000 / 43560;

/** Oven-dry particle density, lb/ft³. The same for every standard model. */
const PARTICLE_DENSITY = 32;
/** Total mineral content, as a fraction. */
const TOTAL_MINERAL = 0.0555;
/** Effective (silica-free) mineral content, as a fraction. */
const EFFECTIVE_MINERAL = 0.01;
/** Low heat content, BTU/lb. */
const HEAT_CONTENT = 8000;

interface Particle {
  /** Oven-dry load, in tons per acre, as Anderson's table gives it. */
  readonly load: number;
  /** Surface-area-to-volume ratio, ft⁻¹. */
  readonly sav: number;
  readonly kind: 'dead1' | 'dead10' | 'dead100' | 'live';
}

export interface FuelModel {
  readonly id: number;
  readonly name: string;
  /** Fuel bed depth, ft. */
  readonly depth: number;
  /** Dead fuel moisture of extinction, as a fraction. */
  readonly extinction: number;
  readonly particles: readonly Particle[];
  // Anderson reference spread, chains/hour: 8% dead moisture, 100% live, 5 mi/h midflame wind,
  // flat ground.
  readonly reference: number;
}

// Anderson (1982), INT-122, table 1, supplies loads/depth/extinction
// (https://research.fs.usda.gov/treesearch/6447); Albini/NWCG PMS 437 supplies particle SAV.
// Models 5 and 7 differ from Anderson’s printed reference rates; model 7 is checked against
// current SWCC tables.
export const FUEL_MODELS: Readonly<Record<number, FuelModel>> = {
  1: {
    id: 1,
    name: 'Pastura curta',
    depth: 1.0,
    extinction: 0.12,
    particles: [{ load: 0.74, sav: 3500, kind: 'dead1' }],
    reference: 78,
  },
  2: {
    id: 2,
    name: 'Pastura amb arbrat',
    depth: 1.0,
    extinction: 0.15,
    particles: [
      { load: 2.0, sav: 3000, kind: 'dead1' },
      { load: 1.0, sav: 109, kind: 'dead10' },
      { load: 0.5, sav: 30, kind: 'dead100' },
      { load: 0.5, sav: 1500, kind: 'live' },
    ],
    reference: 35,
  },
  3: {
    id: 3,
    name: 'Pastura alta',
    depth: 2.5,
    extinction: 0.25,
    particles: [{ load: 3.01, sav: 1500, kind: 'dead1' }],
    reference: 104,
  },
  4: {
    id: 4,
    name: 'Matollar alt i dens',
    depth: 6.0,
    extinction: 0.2,
    particles: [
      { load: 5.01, sav: 2000, kind: 'dead1' },
      { load: 4.01, sav: 109, kind: 'dead10' },
      { load: 2.0, sav: 30, kind: 'dead100' },
      { load: 5.01, sav: 1500, kind: 'live' },
    ],
    reference: 75,
  },
  5: {
    id: 5,
    name: 'Matollar baix i verd',
    depth: 2,
    extinction: 0.2,
    particles: [
      { load: 1, sav: 2000, kind: 'dead1' },
      { load: 0.5, sav: 109, kind: 'dead10' },
      { load: 2, sav: 1500, kind: 'live' },
    ],
    reference: 18,
  },
  6: {
    id: 6,
    name: 'Matollar sec',
    depth: 2.5,
    extinction: 0.25,
    particles: [
      { load: 1.5, sav: 1750, kind: 'dead1' },
      { load: 2.5, sav: 109, kind: 'dead10' },
      { load: 2, sav: 30, kind: 'dead100' },
    ],
    reference: 32,
  },
  7: {
    id: 7,
    name: 'Matollar sota arbrat',
    depth: 2.5,
    extinction: 0.4,
    particles: [
      { load: 1.13, sav: 1750, kind: 'dead1' },
      { load: 1.87, sav: 109, kind: 'dead10' },
      { load: 1.5, sav: 30, kind: 'dead100' },
      { load: 0.37, sav: 1550, kind: 'live' },
    ],
    reference: 20,
  },
  8: {
    id: 8,
    name: 'Fullaraca compacta',
    depth: 0.2,
    extinction: 0.3,
    particles: [
      { load: 1.5, sav: 2000, kind: 'dead1' },
      { load: 1, sav: 109, kind: 'dead10' },
      { load: 2.5, sav: 30, kind: 'dead100' },
    ],
    reference: 1.6,
  },
  9: {
    id: 9,
    name: 'Fullaraca poc compacta',
    depth: 0.2,
    extinction: 0.25,
    particles: [
      { load: 2.92, sav: 2500, kind: 'dead1' },
      { load: 0.41, sav: 109, kind: 'dead10' },
      { load: 0.15, sav: 30, kind: 'dead100' },
    ],
    reference: 7.5,
  },
  10: {
    id: 10,
    name: 'Bosc amb sotabosc i restes',
    depth: 1,
    extinction: 0.25,
    particles: [
      { load: 3.01, sav: 2000, kind: 'dead1' },
      { load: 2, sav: 109, kind: 'dead10' },
      { load: 5.01, sav: 30, kind: 'dead100' },
      { load: 2, sav: 1500, kind: 'live' },
    ],
    reference: 7.9,
  },
  11: {
    id: 11,
    name: 'Restes lleugeres de tallada',
    depth: 1,
    extinction: 0.15,
    particles: [
      { load: 1.5, sav: 1500, kind: 'dead1' },
      { load: 4.51, sav: 109, kind: 'dead10' },
      { load: 5.51, sav: 30, kind: 'dead100' },
    ],
    reference: 6,
  },
  12: {
    id: 12,
    name: 'Restes mitjanes de tallada',
    depth: 2.3,
    extinction: 0.2,
    particles: [
      { load: 4.01, sav: 1500, kind: 'dead1' },
      { load: 14.03, sav: 109, kind: 'dead10' },
      { load: 16.53, sav: 30, kind: 'dead100' },
    ],
    reference: 13,
  },
  13: {
    id: 13,
    name: 'Restes abundants de tallada',
    depth: 3,
    extinction: 0.25,
    particles: [
      { load: 7.01, sav: 1500, kind: 'dead1' },
      { load: 23.04, sav: 109, kind: 'dead10' },
      { load: 28.05, sav: 30, kind: 'dead100' },
    ],
    reference: 13.5,
  },
};

/** Fuel moistures, as fractions of oven-dry weight. */
export interface Moistures {
  readonly dead1: number;
  readonly dead10: number;
  readonly dead100: number;
  readonly live: number;
}

// Precompute fuel/moisture terms once; wind and slope factors are evaluated per grid cell.
export interface FuelBed {
  /** Rate of spread with no wind and no slope, ft/min. */
  readonly r0: number;
  /** Reaction intensity, BTU/ft²/min. */
  readonly reactionIntensity: number;
  // Heat per ground area, BTU/ft²: reaction intensity × residence time (384/σ minutes, Anderson
  // 1969). Multiply by spread rate for Byram intensity.
  readonly heatPerArea: number;
  /** φw = windC · U^windB, with U the midflame wind in ft/min. */
  readonly windC: number;
  readonly windB: number;
  /** φs = slopeK · tan²(slope). */
  readonly slopeK: number;
  /** Total load, in tons per hectare, for showing. */
  readonly loadTonHa: number;
}

interface FuelPart {
  readonly load: number;
  readonly sav: number;
  readonly live: boolean;
  readonly moisture: number;
  readonly area: number;
}

interface FuelBedStructure {
  readonly parts: readonly FuelPart[];
  readonly dead: readonly FuelPart[];
  readonly live: readonly FuelPart[];
  readonly areaDead: number;
  readonly areaLive: number;
  readonly areaTotal: number;
  readonly sigma: number;
  readonly bulkDensity: number;
  readonly packing: number;
  readonly ratio: number;
  readonly extinctionLive: number;
}

function sumFuelParts(parts: readonly FuelPart[], select: (part: FuelPart) => number): number {
  return parts.reduce((total, part) => total + select(part), 0);
}

function fuelParts(model: FuelModel, moistures: Moistures): FuelPart[] {
  return model.particles.map((particle) => {
    const load = particle.load * LB_FT2_PER_TON_ACRE;
    return {
      load,
      sav: particle.sav,
      live: particle.kind === 'live',
      moisture: moistures[particle.kind],

      area: (particle.sav * load) / PARTICLE_DENSITY,
    };
  });
}

function fuelBedStructure(model: FuelModel, parts: readonly FuelPart[]): FuelBedStructure {
  const dead = parts.filter((part) => !part.live);
  const live = parts.filter((part) => part.live);

  const areaDead = sumFuelParts(dead, (part) => part.area);
  const areaLive = sumFuelParts(live, (part) => part.area);
  const areaTotal = areaDead + areaLive;

  const sigma =
    sumFuelParts(dead, (part) => (part.area / areaTotal) * part.sav) +
    sumFuelParts(live, (part) => (part.area / areaTotal) * part.sav);

  const loadTotal = sumFuelParts(parts, (part) => part.load);
  const bulkDensity = loadTotal / model.depth;
  const packing = bulkDensity / PARTICLE_DENSITY;
  const packingOptimum = 3.348 * sigma ** -0.8189;
  const ratio = packing / packingOptimum;

  // Live fuel has no fixed moisture of extinction: it burns only as long as
  const fineDead = sumFuelParts(dead, (part) => part.load * Math.exp(-138 / part.sav));
  const fineLive = sumFuelParts(live, (part) => part.load * Math.exp(-500 / part.sav));
  const fineDeadMoisture =
    sumFuelParts(dead, (part) => part.moisture * part.load * Math.exp(-138 / part.sav)) / fineDead;
  const extinctionLive = fineLive
    ? Math.max(
        2.9 * (fineDead / fineLive) * (1 - fineDeadMoisture / model.extinction) - 0.226,
        model.extinction,
      )
    : model.extinction;

  return {
    parts,
    dead,
    live,
    areaDead,
    areaLive,
    areaTotal,
    sigma,
    bulkDensity,
    packing,
    ratio,
    extinctionLive,
  };
}

function categoryReaction(parts: readonly FuelPart[], area: number, extinction: number): number {
  if (!parts.length) return 0;
  const netLoad =
    sumFuelParts(parts, (part) => (part.area / area) * part.load) * (1 - TOTAL_MINERAL);
  const moisture = sumFuelParts(parts, (part) => (part.area / area) * part.moisture);
  const ratio = Math.min(moisture / extinction, 1);
  const damping = Math.max(
    0,
    1 - 2.59 * ratio + 5.11 * ratio * ratio - 3.52 * ratio * ratio * ratio,
  );
  return netLoad * HEAT_CONTENT * damping;
}

function reactionIntensity(structure: FuelBedStructure, model: FuelModel): number {
  const { sigma, ratio, dead, live, areaDead, areaLive, extinctionLive } = structure;
  const mineralDamping = 0.174 * EFFECTIVE_MINERAL ** -0.19;

  const sigma15 = sigma ** 1.5;
  const maximumVelocity = sigma15 / (495 + 0.0594 * sigma15);
  const a = 133 * sigma ** -0.7913;
  const velocity = maximumVelocity * ratio ** a * Math.exp(a * (1 - ratio));

  const reactionIntensity =
    velocity *
    mineralDamping *
    (categoryReaction(dead, areaDead, model.extinction) +
      categoryReaction(live, areaLive, extinctionLive));

  return reactionIntensity;
}

function spreadTerms(
  structure: FuelBedStructure,
  reactionIntensity: number,
): Pick<FuelBed, 'r0' | 'heatPerArea'> {
  const { sigma, packing, bulkDensity, parts, areaTotal } = structure;

  const propagatingFlux =
    Math.exp((0.792 + 0.681 * Math.sqrt(sigma)) * (packing + 0.1)) / (192 + 0.2595 * sigma);

  const heatSink =
    bulkDensity *
    sumFuelParts(
      parts,
      (part) => (part.area / areaTotal) * Math.exp(-138 / part.sav) * (250 + 1116 * part.moisture),
    );

  return {
    r0: (reactionIntensity * propagatingFlux) / heatSink,
    heatPerArea: (reactionIntensity * 384) / sigma,
  };
}

function windFactors(structure: FuelBedStructure): Pick<FuelBed, 'windB' | 'windC' | 'slopeK'> {
  const { sigma, packing, ratio } = structure;
  return {
    windB: 0.02526 * sigma ** 0.54,
    windC: 7.47 * Math.exp(-0.133 * sigma ** 0.55) * ratio ** -(0.715 * Math.exp(-3.59e-4 * sigma)),
    slopeK: 5.275 * packing ** -0.3,
  };
}

export function fuelBed(model: FuelModel, moistures: Moistures): FuelBed {
  const structure = fuelBedStructure(model, fuelParts(model, moistures));
  const reaction = reactionIntensity(structure, model);
  return {
    ...spreadTerms(structure, reaction),
    ...windFactors(structure),
    reactionIntensity: reaction,
    loadTonHa: loadOf(model),
  };
}

function loadOf(model: FuelModel): number {
  const tonsPerAcre = model.particles.reduce((total, particle) => total + particle.load, 0);
  // Short tons per acre to metric tons per hectare.
  return tonsPerAcre * 2.2417;
}

// Byram fireline intensity, kW per metre of front, for a spread rate in m/min.
export function firelineIntensity(bed: FuelBed, rateMPerMin: number): number {
  return byramIntensity(bed.heatPerArea, rateMPerMin);
}

/** The same, from the heat per area (BTU/ft²) instead of the whole bed. */
export function byramIntensity(heatPerArea: number, rateMPerMin: number): number {
  // BTU/ft² × ft/min ÷ 60 = BTU/ft/s; one of those is 3,459 kW/m.
  return ((heatPerArea * rateMPerMin * FT_PER_M) / 60) * 3.459;
}

/** Byram's flame length (1959), in metres, for an intensity in kW/m. */
export function flameLength(intensityKwM: number): number {
  return intensityKwM > 0 ? 0.0775 * intensityKwM ** 0.46 : 0;
}

// Andrews & Rothermel (1982) fire-characteristic bands at flame lengths of 4, 8 and 11 ft; a
// reading aid rather than a tactic.
export const CONTROL_CLASSES = [
  { upTo: 1.2, name: 'Baixa', note: 'Atac directe amb eines manuals' },
  { upTo: 2.4, name: 'Moderada', note: 'Cal maquinària o mitjans aeris' },
  { upTo: 3.4, name: 'Alta', note: 'Atac al cap del foc inefectiu' },
  { upTo: Infinity, name: 'Extrema', note: 'Fora de capacitat d’extinció' },
] as const;

/** The wind factor φw for a midflame wind in ft/min. */
export function windFactor(bed: FuelBed, midflame: number): number {
  return midflame > 0 ? bed.windC * midflame ** bed.windB : 0;
}

/** The wind, in ft/min, that would give a factor φ: the inverse of the above. */
export function effectiveWind(bed: FuelBed, factor: number): number {
  return factor > 0 ? (factor / bed.windC) ** (1 / bed.windB) : 0;
}

// Ellipse length/breadth for effective midflame wind in ft/min (Anderson 1983, INT-305). Capped at
// 8, the end of the empirical data.
export function lengthToBreadth(wind: number): number {
  const mph = wind / 88;
  const ratio = 0.936 * Math.exp(0.2566 * mph) + 0.461 * Math.exp(-0.1548 * mph) - 0.397;
  return Math.min(Math.max(ratio, 1), 8);
}

// Simard (1968) equilibrium 1-hour moisture: assumes stable air, no solar heating, rain history or
// time lag. The 10/100-hour classes are assumed one/two percentage points wetter.
export function moisturesFor(temperatureC: number, humidity: number, live = 1.0): Moistures {
  const t = temperatureC * 1.8 + 32;
  const h = Math.min(Math.max(humidity, 0), 100);
  const emc =
    h < 10
      ? 0.03229 + 0.281073 * h - 0.000578 * h * t
      : h < 50
        ? 2.22749 + 0.160107 * h - 0.014784 * t
        : 21.0606 + 0.005565 * h * h - 0.00035 * h * t - 0.483199 * h;
  const dead1 = Math.max(emc, 1) / 100;
  return { dead1, dead10: dead1 + 0.01, dead100: dead1 + 0.02, live };
}

// Convert 10 m wind in km/h to 20 ft (÷1.15), then to midflame using Albini & Baughman (1979).
// Assumes unsheltered fuel; no canopy attenuation is modelled.
export function midflameWind(model: FuelModel, windKmh: number): number {
  const at20ft = ((windKmh / 1.15) * 1000 * FT_PER_M) / 60;
  const adjustment = 1.83 / Math.log((20 + 0.36 * model.depth) / (0.13 * model.depth));
  return at20ft * adjustment;
}

export const M_PER_FT = 1 / FT_PER_M;
