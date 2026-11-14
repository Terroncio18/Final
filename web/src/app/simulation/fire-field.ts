import { GRID } from './domain';

/**
 * The fire on the ground, painted as a continuous field and not cell by cell.
 *
 * The model answers with one number per cell, the minute the fire arrives,
 * and the obvious picture of that is a threshold: a cell is burned or it is
 * not. It is exact and it looks like a spreadsheet catching fire —squares
 * switching on one after another. A front is a line that *moves*, and what
 * makes it move smoothly here is that every quantity painted is continuous:
 *
 * - **In space.** How far a cell is from the front is measured in cells, as
 *   its time to the front divided by how long the front takes to cross it
 *   there. So a cell does not switch on: it warms as the front approaches,
 *   peaks as it passes and cools behind, and with the layer's linear filter
 *   the bright line sits *between* cells and slides.
 * - **In time.** The colours are functions of the age since arrival with no
 *   steps in them, so nothing snaps from one tone to the next.
 * - **In the flicker.** It is a noise that varies smoothly across the ground
 *   and drifts, wider than a cell, so the fire shimmers in patches the way a
 *   front does and not as a checkerboard of independent pixels.
 *
 * The look is the FireCast prototype's shader —a glow, a thin irregular hot
 * line, char with embers— rebuilt over the model's arrival times instead of
 * its ellipse.
 *
 * **What this trades away, on purpose:** the picture is no longer the exact
 * footprint. There is a glow a few cells *ahead* of the front, where nothing
 * has burned yet. The figures of the analysis column do not come from this
 * picture and are unchanged; this is how the fire looks, not what it measures.
 * The exact, cell-by-cell painter is still in `fire-appearance.ts`.
 */

/** How many cells ahead of the front the glow reaches. */
const GLOW_REACH = 6;
/** How long behind the front a cell still needs repainting each frame, minutes. */
const WARM = 60;

const LATTICE = 64;

export class FireField {
  /** Reused RGBA buffer: wrap it in one ImageData and keep it. */
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;

  /** Minutes the front takes to cross each cell: the local scale of time. */
  private readonly pace: Float32Array;
  private readonly grain: Uint8Array;
  private readonly active: Uint32Array;
  private readonly lattice = new Float32Array(LATTICE * LATTICE);
  private count = 0;
  private minute = NaN;

  constructor(private readonly arrival: Float32Array) {
    const cells = arrival.length;
    this.pixels = new Uint8ClampedArray(cells * 4);
    this.pace = new Float32Array(cells);
    this.grain = new Uint8Array(cells);
    this.active = new Uint32Array(cells);

    for (let i = 0; i < cells; i += 1) {
      // Stable grain: the same ground comes back when the timeline goes back.
      let hash = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
      hash = Math.imul(hash ^ (hash >>> 16), 0xc2b2ae35);
      this.grain[i] = (hash ^ (hash >>> 13)) & 255;
    }
    for (let i = 0; i < this.lattice.length; i += 1) {
      let hash = Math.imul((i + 1) ^ 0x51ed270b, 0x9e3779b1);
      hash ^= hash >>> 15;
      this.lattice[i] = ((Math.imul(hash, 0x85ebca6b) >>> 8) & 0xffff) / 0xffff;
    }

    // The pace is the size of the gradient of the arrival time: minutes per
    // cell. Differences are taken only against neighbours the fire reaches.
    for (let row = 0; row < GRID; row += 1) {
      for (let column = 0; column < GRID; column += 1) {
        const i = row * GRID + column;
        const here = arrival[i];
        if (!Number.isFinite(here)) continue;
        const along = (a: number, b: number) => {
          const fa = Number.isFinite(a);
          const fb = Number.isFinite(b);
          if (fa && fb) return (b - a) / 2;
          if (fb) return b - here;
          if (fa) return here - a;
          return 0;
        };
        const dx = along(
          column > 0 ? arrival[i - 1] : Infinity,
          column < GRID - 1 ? arrival[i + 1] : Infinity,
        );
        const dy = along(
          row > 0 ? arrival[i - GRID] : Infinity,
          row < GRID - 1 ? arrival[i + GRID] : Infinity,
        );
        // Held between two bounds: a head fire crosses a cell in seconds and
        // a backing one in most of an hour, and neither may be zero.
        this.pace[i] = Math.min(Math.max(Math.hypot(dx, dy), 0.04), 25);
      }
    }
  }

  /** Smooth noise over the ground, from 0 to 1. */
  private noise(x: number, y: number): number {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    let tx = x - fx;
    let ty = y - fy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const x0 = fx & (LATTICE - 1);
    const x1 = (fx + 1) & (LATTICE - 1);
    const y0 = (fy & (LATTICE - 1)) * LATTICE;
    const y1 = ((fy + 1) & (LATTICE - 1)) * LATTICE;
    const top = this.lattice[y0 + x0] + (this.lattice[y0 + x1] - this.lattice[y0 + x0]) * tx;
    const bottom = this.lattice[y1 + x0] + (this.lattice[y1 + x1] - this.lattice[y1 + x0]) * tx;
    return top + (bottom - top) * ty;
  }

  /**
   * Paints the fire at `minute` of the simulation and `seconds` of the visual
   * clock. With `motion` off the shimmer is frozen; the timeline still works.
   *
   * When the minute has not changed only the cells near the front and the
   * warm ones behind it are repainted: the cold char does not move.
   */
  paint(minute: number, seconds = 0, motion = true): Uint8ClampedArray<ArrayBuffer> {
    const arrival = this.arrival;
    if (minute !== this.minute) {
      this.minute = minute;
      this.count = 0;
      for (let i = 0; i < arrival.length; i += 1) {
        const reached = arrival[i];
        if (!Number.isFinite(reached)) {
          this.pixels[i * 4 + 3] = 0;
          continue;
        }
        const age = minute - reached;
        if (age < -GLOW_REACH * this.pace[i]) {
          this.pixels[i * 4 + 3] = 0;
        } else if (age < WARM) {
          this.active[this.count++] = i;
        } else {
          this.char(i);
        }
      }
    }

    const time = motion ? seconds : 0;
    for (let n = 0; n < this.count; n += 1) {
      const i = this.active[n];
      const column = i % GRID;
      const row = (i - column) / GRID;
      const age = minute - arrival[i];
      const pace = this.pace[i];
      const p = i * 4;

      // Two octaves that drift apart, so the shimmer never repeats in step.
      const flicker =
        0.62 * this.noise(column * 0.21 + time * 2.4, row * 0.21 - time * 1.3) +
        0.38 * this.noise(column * 0.47 - time * 3.1, row * 0.47 + time * 2.2);

      if (age < 0) {
        // Ahead of the front: nothing has burned, and the ground is lit by
        // what is coming. Orange far out, the front's own colour up close, so
        // the line the front draws has no seam on this side.
        const ahead = -age / pace;
        const glow = Math.exp(-ahead * 0.7);
        const near = Math.exp(-ahead * 1.6);
        this.pixels[p] = 255;
        this.pixels[p + 1] = 70 + (150 + 80 * flicker - 70) * near;
        this.pixels[p + 2] = 6 + (40 + 60 * flicker - 6) * near;
        this.pixels[p + 3] = 255 * glow * (0.7 + 0.3 * flicker);
        continue;
      }

      const grain = this.grain[i] / 255;
      // The hot line, a cell or two wide wherever the front is, fast or slow.
      const core = Math.exp((-age / pace) * 0.55);
      // And the heat it leaves, which is a matter of minutes and not of cells.
      const heat = Math.exp(-age / 11);

      let r = 12 + grain * 12;
      let g = 7 + grain * 7;
      let b = 5 + grain * 5;
      let alpha = 200 + grain * 22;

      r += (255 - r) * heat * (0.82 + 0.18 * flicker);
      g += (118 - g) * heat * heat * (0.6 + 0.4 * flicker);
      b += (22 - b) * heat * heat * heat;

      const line = core * (0.72 + 0.28 * flicker);
      r += (255 - r) * line;
      g += (150 + 80 * flicker - g) * line;
      b += (40 + 60 * flicker - b) * line;
      alpha += (255 - alpha) * Math.max(core, heat);

      // Embers: a few cells in a hundred keep glowing in the char, and twinkle.
      if (grain > 0.955 && age > 4) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * (3 + grain * 9) + grain * 40);
        // Gone by the time the cell is handed to the still char, so none pops out.
        const ember = Math.exp(-age / 14) * twinkle;
        r += 170 * ember;
        g += 45 * ember;
      }

      this.pixels[p] = r;
      this.pixels[p + 1] = g;
      this.pixels[p + 2] = b;
      this.pixels[p + 3] = alpha;
    }
    return this.pixels;
  }

  /** True while there is a front or warm ground to animate. */
  get moving(): boolean {
    return this.count > 0;
  }

  private char(i: number): void {
    const grain = this.grain[i] / 255;
    const p = i * 4;
    this.pixels[p] = 12 + grain * 12;
    this.pixels[p + 1] = 7 + grain * 7;
    this.pixels[p + 2] = 5 + grain * 5;
    this.pixels[p + 3] = 200 + grain * 22;
  }
}
