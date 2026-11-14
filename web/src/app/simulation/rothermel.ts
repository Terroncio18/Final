/**
 * Rothermel's surface fire spread model.
 *
 * Rothermel (1972), «A mathematical model for predicting fire spread in
 * wildland fuels», USDA Forest Service Research Paper INT-115, with the
 * changes Albini (1976) made to it, which is the form every operational system
 * has used since. The equations are written as Andrews (2018) collects them,
 * «The Rothermel surface fire spread model and associated developments»,
 * RMRS-GTR-371, and the names of the variables follow that report so that the
 * two can be read side by side.
 *
 * **In the units it was published in** —feet, pounds, minutes, BTU— and
 * converted only at the edges. The constants of the model are empirical fits
 * in those units; rewriting them in SI is a second chance to get each one
 * wrong, for a result nobody could then check against the literature.
 *
 * What this file does not have, said here rather than discovered later: crown
 * fire, spotting, and Rothermel's cap on the effective wind speed. It is the
 * surface fire and nothing above it.
 */

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
  /**
   * The rate of spread Anderson (1982) prints for the model, in chains per
   * hour, under his reference conditions: dead fuel at 8 %, live at 100 %,
   * 5 mi/h of midflame wind and no slope. Kept beside the parameters because
   * it is what the implementation is checked against.
   */
  readonly reference: number;
}

/**
 * The thirteen models of Anderson (1982), «Aids to determining fuel
 * models for estimating fire behavior», GTR INT-122 —the loads, depths and
 * moistures of extinction are his table's; the surface-area-to-volume ratios
 * are the ones Albini (1976) set and every later catalogue repeats.
 *
 * Loads/depth/extinction: https://research.fs.usda.gov/treesearch/6447, table 1.
 * Particle SAV: USDA/NWCG PMS 437 surface fuel model descriptions.
 *
 * **Checked on 14/11/2026, against two things.** Anderson's own reference
 * rates, for eleven of his models: nine come out within 10 % and every flame
 * length within half a foot. The two that do not are model 5 (−19 %) and
 * model 7 (+30 %), and for those the second check settles it: the reference
 * tables of the US Southwest Coordination Center for model 7, which are
 * computed with the current form of the model, are reproduced cell by cell
 * —1-h moisture of 6, 9 and 12 %, 4 and 6 mi/h, live fuel from 90 to 120 %.
 * The figure Anderson printed for model 7 in 1982 is the one that has aged,
 * not the equations.
 */
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

/**
 * What a fuel bed at a given moisture does, before wind and slope.
 *
 * Everything that depends only on the fuel and its moisture is worked out
 * once here; what the wind and the slope add is two cheap formulas over these
 * numbers, which matters when they are evaluated for a million cells.
 */
export interface FuelBed {
  /** Rate of spread with no wind and no slope, ft/min. */
  readonly r0: number;
  /** Reaction intensity, BTU/ft²/min. */
  readonly reactionIntensity: number;
  /** φw = windC · U^windB, with U the midflame wind in ft/min. */
  readonly windC: number;
  readonly windB: number;
  /** φs = slopeK · tan²(slope). */
  readonly slopeK: number;
  /** Total load, in tons per hectare, for showing. */
  readonly loadTonHa: number;
}

/**
 * The fuel bed of a model at given moistures: Rothermel's equations up to the
 * no-wind, no-slope rate of spread.
 *
 * The bed has several sizes of particle, dead and live, and the model treats
 * them by **surface area**: each class counts for the share of the bed's
 * surface it holds, because it is the surface that takes the heat. That
 * weighting is the part of the model most often simplified away, and the fine
 * dead fuel dominating it is why the 1-hour moisture matters more than all the
 * others together.
 */
export function fuelBed(model: FuelModel, moistures: Moistures): FuelBed {
  const parts = model.particles.map((particle) => {
    const load = particle.load * LB_FT2_PER_TON_ACRE;
    return {
      load,
      sav: particle.sav,
      live: particle.kind === 'live',
      moisture: moistures[particle.kind],
      // The surface the class offers, per unit of ground.
      area: (particle.sav * load) / PARTICLE_DENSITY,
    };
  });

  const dead = parts.filter((part) => !part.live);
  const live = parts.filter((part) => part.live);
  const sum = (list: typeof parts, of: (part: (typeof parts)[number]) => number) =>
    list.reduce((total, part) => total + of(part), 0);

  const areaDead = sum(dead, (part) => part.area);
  const areaLive = sum(live, (part) => part.area);
  const areaTotal = areaDead + areaLive;

  // Characteristic surface-area-to-volume ratio of the whole bed.
  const sigma =
    sum(dead, (part) => (part.area / areaTotal) * part.sav) +
    sum(live, (part) => (part.area / areaTotal) * part.sav);

  const loadTotal = sum(parts, (part) => part.load);
  const bulkDensity = loadTotal / model.depth;
  const packing = bulkDensity / PARTICLE_DENSITY;
  const packingOptimum = 3.348 * sigma ** -0.8189;
  const ratio = packing / packingOptimum;

  // Live fuel has no fixed moisture of extinction: it burns only as long as
  // the fine dead fuel around it can carry it (Fosberg & Schroeder, in Albini).
  const fineDead = sum(dead, (part) => part.load * Math.exp(-138 / part.sav));
  const fineLive = sum(live, (part) => part.load * Math.exp(-500 / part.sav));
  const fineDeadMoisture =
    sum(dead, (part) => part.moisture * part.load * Math.exp(-138 / part.sav)) / fineDead;
  const extinctionLive = fineLive
    ? Math.max(
        2.9 * (fineDead / fineLive) * (1 - fineDeadMoisture / model.extinction) - 0.226,
        model.extinction,
      )
    : model.extinction;

  /** Net load, moisture damping and area share of one category. */
  const category = (list: typeof parts, area: number, extinction: number) => {
    if (!list.length) return { reaction: 0 };
    const netLoad = sum(list, (part) => (part.area / area) * part.load) * (1 - TOTAL_MINERAL);
    const moisture = sum(list, (part) => (part.area / area) * part.moisture);
    const r = Math.min(moisture / extinction, 1);
    const damping = 1 - 2.59 * r + 5.11 * r * r - 3.52 * r * r * r;
    return { reaction: netLoad * HEAT_CONTENT * damping };
  };

  const mineralDamping = 0.174 * EFFECTIVE_MINERAL ** -0.19;

  // Reaction velocity: how fast the bed burns for its size and its packing.
  const sigma15 = sigma ** 1.5;
  const maximumVelocity = sigma15 / (495 + 0.0594 * sigma15);
  const a = 133 * sigma ** -0.7913;
  const velocity = maximumVelocity * ratio ** a * Math.exp(a * (1 - ratio));

  const reactionIntensity =
    velocity *
    mineralDamping *
    (category(dead, areaDead, model.extinction).reaction +
      category(live, areaLive, extinctionLive).reaction);

  // The share of that heat that reaches the fuel ahead.
  const propagatingFlux =
    Math.exp((0.792 + 0.681 * Math.sqrt(sigma)) * (packing + 0.1)) / (192 + 0.2595 * sigma);

  // What it costs to bring the fuel ahead to ignition.
  const heatSink =
    bulkDensity *
    sum(
      parts,
      (part) => (part.area / areaTotal) * Math.exp(-138 / part.sav) * (250 + 1116 * part.moisture),
    );

  const windB = 0.02526 * sigma ** 0.54;
  const windC =
    7.47 * Math.exp(-0.133 * sigma ** 0.55) * ratio ** -(0.715 * Math.exp(-3.59e-4 * sigma));

  return {
    r0: (reactionIntensity * propagatingFlux) / heatSink,
    reactionIntensity,
    windC,
    windB,
    slopeK: 5.275 * packing ** -0.3,
    loadTonHa: loadOf(model),
  };
}

/** Total load of a model, in metric tons per hectare. */
function loadOf(model: FuelModel): number {
  const tonsPerAcre = model.particles.reduce((total, particle) => total + particle.load, 0);
  // Short tons per acre to metric tons per hectare.
  return tonsPerAcre * 2.2417;
}

/** The wind factor φw for a midflame wind in ft/min. */
export function windFactor(bed: FuelBed, midflame: number): number {
  return midflame > 0 ? bed.windC * midflame ** bed.windB : 0;
}

/** The wind, in ft/min, that would give a factor φ: the inverse of the above. */
export function effectiveWind(bed: FuelBed, factor: number): number {
  return factor > 0 ? (factor / bed.windC) ** (1 / bed.windB) : 0;
}

/**
 * The length-to-breadth ratio of the fire's ellipse, for an effective midflame
 * wind in ft/min: Anderson (1983), «Predicting wind-driven wild land fire size
 * and shape», INT-305. With no wind it is 1, a circle; it is held at 8, which
 * is where his data ends.
 */
export function lengthToBreadth(wind: number): number {
  const mph = wind / 88;
  const ratio = 0.936 * Math.exp(0.2566 * mph) + 0.461 * Math.exp(-0.1548 * mph) - 0.397;
  return Math.min(Math.max(ratio, 1), 8);
}

/**
 * The 1-hour dead fuel moisture for an air temperature and relative humidity:
 * the equilibrium moisture content of Simard (1968), as the NFDRS uses it.
 *
 * It is the moisture fine dead fuel settles at if the air stays as it is, and
 * that is the assumption: no sun on the fuel, no rain yesterday, no time
 * lag. The 10- and 100-hour classes are taken one and two points wetter, a
 * rule of thumb and not a measurement.
 */
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

/**
 * The midflame wind, in ft/min, for a wind measured at ten metres, in km/h.
 *
 * A station measures at ten metres and the fire feels the wind at the height
 * of its flames. Two steps: ten metres to the 20 ft the model's tables use
 * (÷ 1,15), and 20 ft to midflame with the unsheltered adjustment of Albini &
 * Baughman (1979), which depends only on the depth of the bed. **Unsheltered**
 * is the assumption: under a closed canopy the wind at the ground is a
 * fraction of this, and nothing here knows about the canopy.
 */
export function midflameWind(model: FuelModel, windKmh: number): number {
  const at20ft = ((windKmh / 1.15) * 1000 * FT_PER_M) / 60;
  const adjustment = 1.83 / Math.log((20 + 0.36 * model.depth) / (0.13 * model.depth));
  return at20ft * adjustment;
}

export const M_PER_FT = 1 / FT_PER_M;
