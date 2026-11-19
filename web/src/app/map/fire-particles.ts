import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl';

/**
 * Flames and smoke over the simulated fire, as particles standing in the air.
 *
 * The raster of the fire is draped on the ground (§13.1), and that is right for
 * what has burned and wrong for a flame: painted there it would lie flat on the
 * hillside. This is the second layer the fire needs, a MapLibre custom layer
 * that draws points in the same space as the terrain —Mercator coordinates
 * with the altitude as the third— so they share its camera and its depth, and
 * a ridge in front hides them.
 *
 * The look is the FireCast prototype's, which is the reference (§11.7): bright
 * points that rise and thin out, blended additively so that where they overlap
 * they glow, and a few large grey ones that drift downwind. The anchors come from the continuous isochrone of the computed arrival times.
 * The visual animation never feeds back into propagation.
 *
 * **Presentation, like the colours of the raster.** A particle's height, size
 * and life are chosen to be seen from thirty kilometres away and are not flame
 * lengths computed by Rothermel: a real flame at this scale is under a pixel.
 *
 * Everything is worked out on the CPU each frame and sent as one buffer. A
 * thousand-odd points is nothing to compute, and it keeps the shader to what a
 * shader has to do: place a point and shade a disc.
 */

/** A place a particle can be born: Mercator x and y, altitude in Mercator units. */
export interface Emitters {
  /** x, y, z per emitter. */
  readonly positions: Float32Array;
  readonly count: number;
  /** Mercator units per metre at the latitude of the domain. */
  readonly unitsPerMetre: number;
  /** How big the flame is drawn at each emitter, 0 to 1 (fire-emitters.ts). */
  readonly strength: Float32Array;
  /** Running total of each emitter's chance of being picked. */
  readonly weights: Float32Array;
}

/** The emitter whose share of `weights` holds `u`, a number in [0, 1). */
function pick(weights: Float32Array, count: number, u: number): number {
  const target = u * weights[count - 1];
  let low = 0,
    high = count - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (weights[middle] > target) high = middle;
    else low = middle + 1;
  }
  return low;
}

const FLAMES = 1000;
const SMOKE = 150;

/** x, y, z, size in Mercator units, alpha. */
const STRIDE = 5;

/** The same cheap, repeatable noise the prototype uses: a particle's character. */
function random(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

const VERTEX = `#version 300 es
uniform mat4 u_matrix;
uniform vec2 u_viewport;
in vec3 a_position;
in float a_size;
in float a_alpha;
out float v_alpha;

void main() {
  vec4 here = u_matrix * vec4(a_position, 1.0);
  // How many pixels the particle's size covers where it stands: the same
  // length laid sideways and upwards, whichever the camera sees longer. A
  // particle is a sprite and has no orientation, so this is its diameter.
  vec4 side = u_matrix * vec4(a_position + vec3(a_size, 0.0, 0.0), 1.0);
  vec4 up = u_matrix * vec4(a_position + vec3(0.0, 0.0, a_size), 1.0);
  vec2 origin = here.xy / here.w;
  float pixels = max(
    length((side.xy / side.w - origin) * u_viewport),
    length((up.xy / up.w - origin) * u_viewport)
  ) * 0.5;
  // Small depth offset only: emitters are anchored to the rendered terrain.
  here.z -= 0.00002 * here.w;
  gl_Position = here;
  // FireCast sprite limits, including distant subpixel flames.
  gl_PointSize = clamp(pixels, 1.0, 180.0);
  v_alpha = a_alpha;
}`;

const FLAME_FRAGMENT = `#version 300 es
precision mediump float;
in float v_alpha;
out vec4 colour;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  // Narrower than tall: a tongue and not a ball.
  uv.x *= 1.8;
  float d = length(uv);
  float a = pow(max(0.0, 1.0 - d * 2.0), 1.5) * v_alpha;
  vec3 hot = mix(vec3(1.0, 0.16, 0.005), vec3(1.0, 0.87, 0.3), pow(max(0.0, 1.0 - d * 3.0), 2.0));
  // Premultiplied, for the additive blend set outside.
  colour = vec4(hot * a, a);
}`;

const SMOKE_FRAGMENT = `#version 300 es
precision mediump float;
in float v_alpha;
out vec4 colour;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float n = noise(p * 8.0) * 0.6 + noise(p * 17.0) * 0.4;
  float a = pow(max(0.0, 1.0 - length(p) * 2.0), 1.2) * v_alpha * (0.5 + n * 0.7);
  colour = vec4((vec3(0.26, 0.28, 0.285) + n * 0.09) * a, a);
}`;

function compile(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('no shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      gl.deleteProgram(program);
      throw new Error(message ?? 'shader');
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message ?? 'program');
  }
  return program;
}

export class FireParticles implements CustomLayerInterface {
  public readonly id: string;
  public readonly type = 'custom' as const;
  /** `3d`, so the layer is drawn against the terrain's depth. */
  public readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private flames: WebGLProgram | null = null;
  private smoke: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;

  private readonly flameData = new Float32Array(FLAMES * STRIDE);
  private readonly smokeData = new Float32Array(SMOKE * STRIDE);

  /** Flame anchors follow the interpolated front; smoke keeps its birthplace. */
  private readonly flameBirth = new Float32Array(FLAMES * 3);
  private readonly flamePhase = new Float32Array(FLAMES).fill(2);
  /** The strength of the emitter each flame was born at. */
  private readonly flameStrength = new Float32Array(FLAMES);
  private readonly smokeBirth = new Float32Array(SMOKE * 3);
  private readonly smokePhase = new Float32Array(SMOKE).fill(2);

  private emitters: Emitters | null = null;
  private sampledEmitters: Emitters | null = null;
  /** Where the wind blows towards, as a unit vector east and north. */
  private windEast = 0;
  private windNorth = 0;
  private windKmh = 0;

  private seconds = 0;
  private lastFrame = performance.now();
  private vao: WebGLVertexArrayObject | null = null;
  /** False under `prefers-reduced-motion`: nothing rises, so nothing is drawn. */
  private motion = true;

  public constructor(id: string) {
    this.id = id;
  }

  /** The cells the fire is in now. With none, the layer draws nothing. */
  public setEmitters(emitters: Emitters | null): void {
    // After a spell with no fire every particle is born afresh, rather than
    // carrying on from wherever the last fire left it.
    if (!this.emitters || !this.motion) {
      this.flamePhase.fill(2);
      this.smokePhase.fill(2);
    }
    this.emitters = emitters && emitters.count ? emitters : null;
    this.map?.triggerRepaint();
  }

  /** `towardsDeg` is where the wind goes; it is not turned again here. */
  public setWind(towardsDeg: number, kmh: number): void {
    const towards = (towardsDeg * Math.PI) / 180;
    this.windEast = Math.sin(towards);
    this.windNorth = Math.cos(towards);
    this.windKmh = kmh;
  }

  public setMotion(on: boolean): void {
    if (this.motion === on) return;
    this.motion = on;
    this.lastFrame = performance.now();
    this.map?.triggerRepaint();
  }

  public reset(): void {
    this.flamePhase.fill(2);
    this.smokePhase.fill(2);
    this.sampledEmitters = null;
  }

  public onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    // A shader that will not build on some card must cost the flames and not
    // the map: the layer then draws nothing, and the raster underneath still
    // shows where the fire is.
    try {
      this.flames = compile(gl, VERTEX, FLAME_FRAGMENT);
      this.smoke = compile(gl, VERTEX, SMOKE_FRAGMENT);
      this.buffer = gl.createBuffer();
      this.vao = gl.createVertexArray();
    } catch (error) {
      console.error('[fire-particles]', error);
      this.flames = null;
      this.smoke = null;
    }
  }

  public onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext): void {
    gl.deleteProgram(this.flames);
    gl.deleteProgram(this.smoke);
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
    this.map = null;
  }

  public render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const emitters = this.emitters;
    if (!emitters || !this.flames || !this.smoke) return;

    const now = performance.now();
    if (this.motion && !document.hidden)
      this.seconds += Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.place(emitters, this.seconds);

    const matrix = options.defaultProjectionData.mainMatrix as unknown as Float32List;
    const viewport = [gl.drawingBufferWidth, gl.drawingBufferHeight];

    gl.enable(gl.BLEND);
    // Tested against the terrain and never written: a ridge hides a flame, and
    // one particle does not cut a hole in the one behind it.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    const oldVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    // Same ordering and blending as FireCast: flames, then smoke over them.
    gl.blendFunc(gl.ONE, gl.ONE);
    this.draw(gl, this.flames, this.flameData, FLAMES, matrix, viewport);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.draw(gl, this.smoke, this.smokeData, SMOKE, matrix, viewport);

    gl.depthMask(true);
    gl.bindVertexArray(oldVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // The particles move by themselves, so the map has to keep drawing while
    // there is a fire on it —and only then.
    if (this.motion && !document.hidden) this.map?.triggerRepaint();
  }

  private draw(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    data: Float32Array,
    count: number,
    matrix: Float32List,
    viewport: number[],
  ): void {
    gl.useProgram(program);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, matrix);
    gl.uniform2fv(gl.getUniformLocation(program, 'u_viewport'), viewport);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    const bytes = STRIDE * 4;
    const attribute = (name: string, size: number, offset: number) => {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) return;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, bytes, offset * 4);
    };
    attribute('a_position', 3, 0);
    attribute('a_size', 1, 3);
    attribute('a_alpha', 1, 4);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  /** FireCast particle lifecycles, sampled along the computed front.
   * Flames track its current position; smoke drifts from where it was emitted.
   * Coordinates are Mercator; all visual lengths are metres, not model outputs.
   */
  private place(emitters: Emitters, seconds: number): void {
    const { positions, count, unitsPerMetre: unit, strength, weights } = emitters;

    /** Gives particle `i` a new birthplace if its phase has started over. */
    const born = (
      birth: Float32Array,
      phases: Float32Array,
      i: number,
      phase: number,
      follow = false,
      strengths?: Float32Array,
    ) => {
      if (phase < phases[i] || (follow && this.sampledEmitters !== emitters)) {
        const seed = follow ? i + 15 : i + Math.floor(seconds * 3) * 157 + 15;
        const chosen = pick(weights, count, random(seed));
        if (strengths) strengths[i] = strength[chosen];
        const emitter = chosen * 3;
        birth[i * 3] = positions[emitter];
        birth[i * 3 + 1] = positions[emitter + 1];
        birth[i * 3 + 2] = positions[emitter + 2];
        // Anchor to the terrain actually rendered, including flat mode and LOD.
        const lon = positions[emitter] * 360 - 180;
        const lat =
          (Math.atan(Math.sinh(Math.PI * (1 - 2 * positions[emitter + 1]))) * 180) / Math.PI;
        const height = this.map?.getTerrain()
          ? this.map.queryTerrainElevation({ lng: lon, lat })
          : 0;
        if (height !== null && height !== undefined) birth[i * 3 + 2] = height * unit;
      }
      phases[i] = phase;
    };

    for (let i = 0; i < FLAMES; i += 1) {
      const phase = fract(random(i + 57) + seconds * (0.3 + random(i + 112) * 0.45));
      born(this.flameBirth, this.flamePhase, i, phase, true, this.flameStrength);
      // A weak front's flames are lower and narrower, a strong one's taller.
      const s = this.flameStrength[i];
      const lean = phase * 12 * s;
      const rise = (5 + phase * (24 + random(i + 40) * 65)) * (0.3 + 0.9 * s);
      const out = i * STRIDE;
      this.flameData[out] = this.flameBirth[i * 3] + this.windEast * lean * unit;
      this.flameData[out + 1] = this.flameBirth[i * 3 + 1] - this.windNorth * lean * unit;
      this.flameData[out + 2] = this.flameBirth[i * 3 + 2] + rise * unit;
      this.flameData[out + 3] =
        (24 + random(i + 76) * 51) * (1 - phase * 0.5) * (0.45 + 0.65 * s) * unit;
      this.flameData[out + 4] =
        Math.min(phase * 7, 1) * Math.pow(1 - phase, 0.65) * (0.65 + random(i + 345) * 0.35);
    }

    for (let i = 0; i < SMOKE; i += 1) {
      const phase = fract(random(i + 510) + seconds * 0.025);
      born(this.smokeBirth, this.smokePhase, i, phase);
      const drift = phase * (200 + this.windKmh * 13);
      const sway = Math.sin(i) * phase * 50;
      const out = i * STRIDE;
      this.smokeData[out] =
        this.smokeBirth[i * 3] + (this.windEast * drift + this.windNorth * sway) * unit;
      this.smokeData[out + 1] =
        this.smokeBirth[i * 3 + 1] - (this.windNorth * drift - this.windEast * sway) * unit;
      this.smokeData[out + 2] = this.smokeBirth[i * 3 + 2] + (25 + phase * 450) * unit;
      this.smokeData[out + 3] = (95 + phase * 300) * (1 + random(i + 615) * 0.6) * unit;
      // The sine is zero at both ends, so smoke already fades in and out.
      this.smokeData[out + 4] = Math.sin(phase * Math.PI) * 0.2;
    }
    this.sampledEmitters = emitters;
  }
}
