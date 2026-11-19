// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('./domain', () => ({
  GRID: 8,
  CELL_M: 30,
  SIDE_M: 240,
  domainAround: ([x, y]: number[]) => [x - 0.001, y - 0.001, x + 0.001, y + 0.001],
}));
vi.mock('three', async (original) => {
  const actual = await original<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: vi.fn(
      class {
        autoClear = true;
        resetState = vi.fn();
        render = vi.fn();
        dispose = vi.fn();
      },
    ),
  };
});
import * as THREE from 'three';
import { FireParticles, type Emitters } from '../map/fire-particles';
import { Agents3D } from '../map/agents-3d';
import { FireSurface } from './fire-surface';
import { FireField } from './fire-field';
import { slopeImage } from './slope-classes';
import { readTerrain, cellOf, groundAt, type Terrain } from './terrain';
import type { CustomRenderMethodInput, Map as LibreMap } from 'maplibre-gl';
import type { GroundAgent, Pass } from './agents';

function graphics() {
  const gl: Record<string, any> = {};
  for (const [index, key] of [
    'VERTEX_SHADER',
    'FRAGMENT_SHADER',
    'COMPILE_STATUS',
    'LINK_STATUS',
    'BLEND',
    'DEPTH_TEST',
    'LEQUAL',
    'VERTEX_ARRAY_BINDING',
    'ARRAY_BUFFER',
    'ONE',
    'ONE_MINUS_SRC_ALPHA',
    'DYNAMIC_DRAW',
    'FLOAT',
    'POINTS',
    'TEXTURE_2D',
    'TEXTURE_MIN_FILTER',
    'TEXTURE_MAG_FILTER',
    'NEAREST',
    'TEXTURE_WRAP_S',
    'TEXTURE_WRAP_T',
    'CLAMP_TO_EDGE',
    'RG32F',
    'RG',
    'TEXTURE0',
    'TRIANGLES',
  ].entries())
    gl[key] = index + 1;
  for (const key of [
    'shaderSource',
    'compileShader',
    'deleteShader',
    'deleteProgram',
    'attachShader',
    'linkProgram',
    'deleteBuffer',
    'deleteVertexArray',
    'enable',
    'depthFunc',
    'depthMask',
    'bindVertexArray',
    'bindBuffer',
    'blendFunc',
    'useProgram',
    'uniformMatrix4fv',
    'uniform2fv',
    'bufferData',
    'enableVertexAttribArray',
    'vertexAttribPointer',
    'drawArrays',
    'bindTexture',
    'texParameteri',
    'texImage2D',
    'viewport',
    'activeTexture',
    'uniform1i',
    'uniform1f',
    'uniform3f',
    'uniform4fv',
    'deleteTexture',
  ])
    gl[key] = vi.fn();
  for (const key of [
    'createProgram',
    'createShader',
    'createBuffer',
    'createVertexArray',
    'createTexture',
  ])
    gl[key] = vi.fn(() => ({}));
  gl['getShaderParameter'] = vi.fn(() => true);
  gl['getProgramParameter'] = vi.fn(() => true);
  gl['getShaderInfoLog'] = vi.fn(() => 'shader failed');
  gl['getProgramInfoLog'] = vi.fn(() => 'link failed');
  gl['getParameter'] = vi.fn(() => null);
  gl['getUniformLocation'] = vi.fn((_p: unknown, name: string) => name);
  gl['getAttribLocation'] = vi.fn(() => 1);
  gl['isContextLost'] = vi.fn(() => false);
  gl['getExtension'] = vi.fn(() => ({ loseContext: vi.fn() }));
  gl['drawingBufferWidth'] = 800;
  gl['drawingBufferHeight'] = 600;
  return gl;
}
const projection = {
  defaultProjectionData: { mainMatrix: new THREE.Matrix4().elements },
} as unknown as CustomRenderMethodInput;
const emitters: Emitters = {
  positions: new Float32Array([0.5, 0.5, 0.001, 0.51, 0.51, 0.002, 0.52, 0.52, 0.003]),
  count: 3,
  unitsPerMetre: 1e-7,
  strength: new Float32Array([0.1, 0.5, 1]),
  weights: new Float32Array([0.1, 0.6, 1.6]),
};

describe('fire rendering at the graphics boundary', () => {
  let gl: ReturnType<typeof graphics>,
    map: {
      triggerRepaint: ReturnType<typeof vi.fn>;
      getTerrain: ReturnType<typeof vi.fn>;
      queryTerrainElevation: ReturnType<typeof vi.fn>;
    };
  beforeEach(() => {
    gl = graphics();
    map = {
      triggerRepaint: vi.fn(),
      getTerrain: vi.fn(() => ({})),
      queryTerrainElevation: vi.fn(() => 100),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const gpu = () => gl as unknown as WebGL2RenderingContext;
  const libre = () => map as unknown as LibreMap;

  it('uploads finite flame and smoke geometry, restores GL state and pauses hidden frames', () => {
    const layer = new FireParticles('fire'),
      time = vi.spyOn(performance, 'now').mockReturnValue(100);
    layer.render(gpu(), projection);
    layer.setMotion(true);
    layer.setMotion(false);
    layer.setEmitters(emitters);
    layer.render(gpu(), projection);
    layer.onAdd(libre(), gpu());
    layer.setWind(90, 30);
    layer.setMotion(true);
    layer.setEmitters(emitters);
    time.mockReturnValue(200);
    layer.render(gpu(), projection);
    expect(gl['drawArrays'].mock.calls.map((c: any[]) => c[2])).toEqual([1000, 150]);
    for (const call of gl['bufferData'].mock.calls)
      expect(Array.from(call[1] as Float32Array).every(Number.isFinite)).toBe(true);
    expect(gl['depthMask']).toHaveBeenLastCalledWith(true);
    expect(gl['bindBuffer']).toHaveBeenLastCalledWith(gl['ARRAY_BUFFER'], null);
    expect(map.queryTerrainElevation).toHaveBeenCalled();
    time.mockReturnValue(300);
    layer.render(gpu(), projection);
    layer.setEmitters({ ...emitters });
    time.mockReturnValue(400);
    layer.render(gpu(), projection);
    map.queryTerrainElevation.mockReturnValue(null);
    layer.reset();
    layer.render(gpu(), projection);
    map.queryTerrainElevation.mockReturnValue(undefined);
    layer.reset();
    layer.render(gpu(), projection);
    map.getTerrain.mockReturnValue(null);
    layer.reset();
    layer.render(gpu(), projection);
    const seconds = layer['seconds'];
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    time.mockReturnValue(10000);
    layer.render(gpu(), projection);
    expect(layer['seconds']).toBe(seconds);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    layer.setMotion(false);
    layer.setEmitters(emitters);
    gl['getAttribLocation'].mockReturnValue(-1);
    layer.render(gpu(), projection);
    expect(layer['seconds']).toBe(seconds);
    layer.setEmitters({ ...emitters, count: 0 });
    const draws = gl['drawArrays'].mock.calls.length;
    layer.render(gpu(), projection);
    expect(gl['drawArrays']).toHaveBeenCalledTimes(draws);
    layer.setEmitters(null);
    layer.onRemove(libre(), gpu());
    expect(gl['deleteProgram']).toHaveBeenCalledTimes(2);
    expect(gl['deleteBuffer']).toHaveBeenCalledTimes(1);
  });

  for (const failure of [
    'allocation',
    'shader',
    'shader-no-message',
    'program',
    'program-no-message',
    'second-program',
  ]) {
    it(`keeps the map alive after ${failure} failure`, () => {
      if (failure === 'allocation') gl['createShader'].mockReturnValue(null);
      if (failure.startsWith('shader')) gl['getShaderParameter'].mockReturnValue(false);
      if (failure.startsWith('program')) gl['getProgramParameter'].mockReturnValue(false);
      if (failure.endsWith('no-message')) {
        gl['getShaderInfoLog'].mockReturnValue(null);
        gl['getProgramInfoLog'].mockReturnValue(null);
      }
      if (failure === 'second-program')
        gl['getProgramParameter'].mockReturnValueOnce(true).mockReturnValueOnce(false);
      const layer = new FireParticles('fire');
      layer.setEmitters(emitters);
      layer.onAdd(libre(), gpu());
      layer.render(gpu(), projection);
      expect(console.error).toHaveBeenCalled();
      expect(gl['drawArrays']).not.toHaveBeenCalled();
      layer.onRemove(libre(), gpu());
    });
  }

  it('uploads the arrival texture, sets forecast uniforms and crops to the fire extent', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gpu());
    const arrival = new Float32Array(64).fill(Infinity);
    arrival[27] = 0;
    arrival[28] = 2;
    const surface = new FireSurface(arrival, 720);
    expect(surface.canvas.width).toBe(2048);
    expect(gl['texImage2D']).toHaveBeenCalledTimes(1);
    surface.paint(10, 2, true);
    expect(gl['uniform1i']).toHaveBeenCalledWith('forecast', 1);
    expect(gl['uniform1f']).toHaveBeenCalledWith('minute', 10);
    surface.paint(20, 3, false, 60);
    expect(gl['uniform1f']).toHaveBeenCalledWith('lineCells', 1.8);
    const bounds = surface.bounds([0, 0, 8, 8]);
    expect(bounds[0]).toBeLessThan(bounds[2]);
    expect(bounds[1]).toBeLessThan(bounds[3]);
    gl['isContextLost'].mockReturnValue(true);
    surface.paint(30, 4, true);
    expect(gl['drawArrays']).toHaveBeenCalledTimes(2);
    surface.dispose();
    expect(gl['deleteTexture']).toHaveBeenCalled();
    gl['getExtension'].mockReturnValue(null);
    expect(() => surface.dispose()).not.toThrow();
  });

  for (const failure of [
    'context',
    'program-allocation',
    'shader',
    'shader-no-message',
    'link',
    'link-no-message',
  ]) {
    it(`reports surface ${failure} failure and frees allocated resources`, () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        failure === 'context' ? null : gpu(),
      );
      if (failure === 'program-allocation') gl['createProgram'].mockReturnValue(null);
      if (failure.startsWith('shader')) gl['getShaderParameter'].mockReturnValue(false);
      if (failure.startsWith('link')) gl['getProgramParameter'].mockReturnValue(false);
      if (failure.endsWith('no-message')) {
        gl['getShaderInfoLog'].mockReturnValue(null);
        gl['getProgramInfoLog'].mockReturnValue(null);
      }
      expect(() => new FireSurface(new Float32Array(64), 720)).toThrow();
      if (failure.startsWith('shader') || failure.startsWith('link'))
        expect(gl['deleteProgram']).toHaveBeenCalled();
    });
  }

  it('paints a continuous front, deterministic still frames and cold char when seeking', () => {
    const arrival = new Float32Array(64).fill(Infinity);
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) if (col !== 4) arrival[row * 8 + col] = col * 5;
    arrival[7] = Infinity;
    arrival[15] = Infinity;
    arrival[0] = Infinity;
    const field = new FireField(arrival);
    expect(field.paint(-100).every((v) => v === 0)).toBe(true);
    expect(field.moving).toBe(false);
    const first = field.paint(10, 0).slice();
    expect(field.moving).toBe(true);
    expect(first[4 * 4 + 3]).toBe(0);
    expect(field.paint(10, 1)).not.toEqual(first);
    expect(field.paint(10, 10, false)).toEqual(first);
    field.paint(20, 2);
    field.paint(50, 3);
    const char = field.paint(200).slice();
    expect(field.moving).toBe(false);
    expect(field.paint(200, 50)).toEqual(char);
    expect(field.paint(10, 0)).toEqual(first);
    const isolated = new Float32Array(64).fill(Infinity);
    isolated[27] = 0;
    expect(new FireField(isolated).paint(0)[27 * 4 + 3]).toBe(255);
  });

  it('maps slope bands to pixels and copies interior slopes to the border', () => {
    const image = { data: new Uint8ClampedArray(64 * 4) },
      putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: () => image,
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;test');
    const slope = new Float32Array(64);
    for (let i = 0; i < 8; i++) slope.fill(i * 10, i * 8, (i + 1) * 8);
    expect(slopeImage({ slope } as Terrain)).toBe('data:image/png;test');
    expect(putImageData).toHaveBeenCalled();
    expect(Array.from(image.data.slice(0, 4))).toEqual([205, 180, 240, 255]);
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    expect(() => slopeImage({ slope } as Terrain)).toThrow('sense context');
  });
});

describe('3D crew and aircraft lifecycle', () => {
  const crew: GroundAgent = { id: 'crew', kind: 'crew', point: [2, 39], heading: 90 };
  const pass: Pass = {
    id: 'drop',
    kind: 'helicopter',
    drop: [2, 39],
    heading: 45,
    liquid: 'water',
  };
  afterEach(() => vi.restoreAllMocks());
  it('reuses figures, animates a complete pass and frees figures and renderer', () => {
    const map = {
      getCanvas: () => document.createElement('canvas'),
      getCenter: () => ({ lng: 2, lat: 39 }),
      getZoom: () => 12,
      getTerrain: vi.fn((): object | null => ({})),
      queryTerrainElevation: vi.fn((): number | null => 100),
      triggerRepaint: vi.fn(),
    };
    const layer = new Agents3D('agents'),
      gl = {} as WebGL2RenderingContext,
      time = vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    layer.render(gl, projection);
    layer.setGround([crew]);
    layer.setGround([crew]);
    layer.setGround([{ ...crew, kind: 'bulldozer' }]);
    layer.setGround([]);
    layer.onAdd(map as unknown as LibreMap, gl);
    layer.render(gl, projection);
    layer.setGround([crew]);
    layer.fly(pass);
    layer.fly({ ...pass, id: 'plane', kind: 'tanker', liquid: 'retardant' });
    for (const ms of [0, 400, 1000, 3200, 4000, 5000]) {
      time.mockReturnValue(ms);
      layer.render(gl, projection);
    }
    const renderer = vi.mocked(THREE.WebGLRenderer).mock.results.at(-1)!
      .value as THREE.WebGLRenderer;
    expect(renderer.autoClear).toBe(false);
    expect(renderer.render).toHaveBeenCalledTimes(6);
    expect(layer['ground'].get('crew')!.model.matrix.elements.every(Number.isFinite)).toBe(true);
    map.queryTerrainElevation.mockReturnValue(null);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    layer.render(gl, projection);
    map.getTerrain.mockReturnValue(null);
    layer.render(gl, projection);
    time.mockReturnValue(7100);
    layer.render(gl, projection);
    expect(layer['flights']).toHaveLength(0);
    layer.fly(pass);
    layer.setMotion(false);
    expect(layer['flights']).toHaveLength(0);
    layer.fly(pass);
    expect(layer['flights']).toHaveLength(0);
    layer.setMotion(true);
    layer.fly(pass);
    layer.onRemove();
    expect(renderer.dispose).toHaveBeenCalled();
    expect(layer['ground'].size).toBe(0);
    expect(layer['flights']).toHaveLength(0);
    layer.onRemove();
  });
  it('survives an unavailable renderer', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(THREE.WebGLRenderer).mockImplementationOnce(function () {
      throw new Error('no GPU');
    });
    const layer = new Agents3D('agents');
    layer.setGround([crew]);
    layer.onAdd(
      { getCanvas: () => document.createElement('canvas') } as LibreMap,
      {} as WebGL2RenderingContext,
    );
    expect(console.error).toHaveBeenCalled();
    expect(() => layer.render({} as WebGL2RenderingContext, projection)).not.toThrow();
    layer.onRemove();
  });
});

describe('terrain pixels and sampling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('decodes Terrarium heights, interpolates and derives a slope from a known ramp', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ close })),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('pixels')),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return {
            drawImage: vi.fn(),
            getImageData: () => {
              const data = new Uint8ClampedArray(this.width * this.height * 4);
              for (let i = 0; i < this.width * this.height; i++) {
                const value = 32768 + (i % this.width);
                data[i * 4] = value >> 8;
                data[i * 4 + 1] = value & 255;
              }
              return { data };
            },
          };
        }
      },
    );
    const terrain = await readTerrain([0, 0]);
    expect(terrain.elevation).toHaveLength(64);
    expect(terrain.maxElevation).toBeGreaterThan(terrain.minElevation);
    expect(terrain.maxSlope).toBeGreaterThan(0);
    expect(terrain.meanSlope).toBeCloseTo(terrain.maxSlope, 3);
    expect(close).toHaveBeenCalledTimes(terrain.tiles);
    expect(cellOf([0, 0], [0, 0])).toBe(36);
    for (const p of [
      [-1, 0],
      [1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      expect(cellOf([0, 0], p)).toBeNull();
      expect(groundAt(terrain, [0, 0], p)).toBeNull();
    }
    expect(groundAt(terrain, [0, 0], [-0.00099, 0.00099])?.slope).toBe(terrain.slope[9]);
  });
  it('rejects absent 2D contexts and failed tile requests', async () => {
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return null;
        }
      },
    );
    await expect(readTerrain([0, 0])).rejects.toThrow('sense context');
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return {};
        }
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    await expect(readTerrain([0, 0])).rejects.toThrow('503');
  });
});
