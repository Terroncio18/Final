/**
 * Optional presentation for the existing arrival-time model.
 *
 * `minute` is simulation time; `seconds` is an independent animation clock.
 * Flicker never changes which cells have burned. The warm colours indicate
 * age since arrival, not a calculated flame temperature or residence time.
 * Keep the arrival array immutable and create a new painter for a new result.
 */
export class FireAppearance {
  /** Reused RGBA buffer, suitable for one ImageData kept by the caller. */
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;

  private readonly active: Uint32Array;
  private readonly variation: Uint8Array;
  private count = 0;
  private minute = NaN;

  constructor(private readonly arrival: Float32Array) {
    this.pixels = new Uint8ClampedArray(arrival.length * 4);
    this.active = new Uint32Array(arrival.length);
    this.variation = new Uint8Array(arrival.length);
    for (let i = 0; i < arrival.length; i += 1) {
      // Stable grain: scrubbing backwards reproduces the same ground.
      let hash = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
      hash = Math.imul(hash ^ (hash >>> 16), 0xc2b2ae35);
      this.variation[i] = (hash ^ (hash >>> 13)) & 255;
    }
  }

  get activeCellCount(): number {
    return this.count;
  }

  /**
   * Call at up to 20 fps, then upload the reused buffer to the map canvas.
   * An unchanged simulation minute only repaints the warm cells. Setting
   * motion=false freezes the shimmer but still allows timeline scrubbing.
   */
  paint(minute: number, seconds = 0, motion = true): Uint8ClampedArray<ArrayBuffer> {
    if (!Number.isFinite(minute) || !Number.isFinite(seconds)) {
      throw new RangeError('Fire presentation needs finite clock values.');
    }

    if (minute !== this.minute) {
      this.minute = minute;
      this.count = 0;
      for (let i = 0; i < this.arrival.length; i += 1) {
        const reached = this.arrival[i];
        const age = minute - reached;
        const p = i * 4;
        // Infinity is unreached, NaN is missing, negative times are invalid.
        if (!Number.isFinite(reached) || reached < 0 || age < 0) {
          this.pixels.fill(0, p, p + 4);
        } else if (age < 40) {
          this.active[this.count++] = i;
        } else {
          this.char(i);
        }
      }
    }

    const time = motion ? seconds : 0;
    for (let n = 0; n < this.count; n += 1) {
      const i = this.active[n];
      const age = minute - this.arrival[i];
      const grain = this.variation[i] / 255;
      const phase = grain * Math.PI * 2;
      // Two smooth frequencies keep neighbouring cells from blinking in step.
      const pulse =
        0.5 + 0.32 * Math.sin(time * 7 + phase) + 0.18 * Math.sin(time * 13 + phase * 3);
      let r: number;
      let g: number;
      let b: number;
      let alpha: number;
      if (age < 6) {
        const t = smooth(age / 6);
        r = 255;
        g = 222 + (125 - 222) * t;
        b = 100 + (28 - 100) * t;
        alpha = 245;
      } else if (age < 30) {
        const t = smooth((age - 6) / 24);
        r = 255 + (155 - 255) * t;
        g = 125 + (38 - 125) * t;
        b = 28 + (16 - 28) * t;
        alpha = 245 - 20 * t;
      } else {
        const t = smooth((age - 30) / 10);
        r = 155 + (24 + grain * 12 - 155) * t;
        g = 38 + (20 + grain * 8 - 38) * t;
        b = 16 + (18 + grain * 6 - 16) * t;
        alpha = 225 + (185 + grain * 12 - 225) * t;
      }
      const warmth = 1 - smooth(age / 40);
      const p = i * 4;
      this.pixels[p] = r;
      this.pixels[p + 1] = g + (pulse - 0.5) * 42 * warmth;
      this.pixels[p + 2] = b + (pulse - 0.5) * 16 * warmth;
      this.pixels[p + 3] = alpha;
    }
    return this.pixels;
  }

  private char(i: number): void {
    const grain = this.variation[i] / 255;
    const p = i * 4;
    this.pixels[p] = 24 + grain * 12;
    this.pixels[p + 1] = 20 + grain * 8;
    this.pixels[p + 2] = 18 + grain * 6;
    this.pixels[p + 3] = 185 + grain * 12;
  }
}

function smooth(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}
