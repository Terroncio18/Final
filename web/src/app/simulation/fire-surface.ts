import { GRID, CELL_M } from './domain';
import { arrivalTexture, fireExtent, UNREACHED } from './fire-display';

const VERTEX = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = vec2(p.x, 1.0-p.y);
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

/** FireCast's char, noise, hot line and three future bands over an arrival field. */
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D field;
uniform float minute, seconds, horizon, size, cellMetres;
uniform bool forecast;
uniform vec4 crop;
in vec2 uv;
out vec4 colour;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
vec2 read(ivec2 p){return texelFetch(field,clamp(p,ivec2(0),ivec2(int(size)-1)),0).rg;}
void over(vec3 rgb,float a){colour.rgb=rgb*a+colour.rgb*(1.0-a);colour.a=a+colour.a*(1.0-a);}
void main(){
  colour=vec4(0);
  vec2 grid=mix(crop.xy,crop.zw,uv)*size;
  // Never interpolate fire across a cell the propagation cannot reach.
  if(read(ivec2(floor(grid))).r>${UNREACHED / 2}.0) return;
  vec2 p=grid-.5, f=fract(p); ivec2 cell=ivec2(floor(p));
  vec2 a=read(cell),b=read(cell+ivec2(1,0)),c=read(cell+ivec2(0,1)),d=read(cell+ivec2(1,1));
  vec4 w=vec4((1.0-f.x)*(1.0-f.y),f.x*(1.0-f.y),(1.0-f.x)*f.y,f.x*f.y);
  w*=vec4(lessThan(vec4(a.r,b.r,c.r,d.r),vec4(${UNREACHED / 2}.0)));
  w/=max(dot(w,vec4(1)),.00001);
  float t=dot(w,vec4(a.r,b.r,c.r,d.r));
  float pace=max(.04,dot(w,vec4(a.g,b.g,c.g,d.g)));
  float distance=(minute-t)/pace;
  vec2 world=grid*cellMetres;
  float n=noise(world*.012), fine=noise(world*.09);
  if(forecast && t>minute){
    float dash=step(.25,fract((world.x+world.y)/95.0));
    if(minute+90.0<=horizon && t<=minute+90.0) over(vec3(.83,.63,.08),.13);
    if(minute+60.0<=horizon && t<=minute+60.0) over(vec3(1,.28,.02),.16);
    if(minute+30.0<=horizon && t<=minute+30.0) over(vec3(.75,.045,.018),.2);
    float width=.16;
    if(minute+90.0<=horizon) over(vec3(1,.78,.12),.9*(1.0-smoothstep(width,width+.18,abs(t-minute-90.0)/pace)));
    if(minute+60.0<=horizon) over(vec3(1,.47,.04),dash*(1.0-smoothstep(width,width+.12,abs(t-minute-60.0)/pace)));
    if(minute+30.0<=horizon) over(vec3(1,.25,.1),dash*(1.0-smoothstep(width,width+.12,abs(t-minute-30.0)/pace)));
  }
  if(t<=minute){
    vec3 char=vec3(.15,.095,.065)+n*.04;
    float ember=pow(fine,12.0)*exp(-(minute-t)/30.0);
    over(char+vec3(.38,.055,.003)*ember,.87);
  }
  float flicker=.68+.32*noise(vec2(world.x*.09+seconds*4.0,world.y*.09));
  float irregular=distance+(n-.5)*.22;
  float fire=exp(-abs(irregular)*3.8);
  float glow=exp(-abs(distance)*1.3);
  over(vec3(1,.14,.002),glow*.28);
  over(vec3(1,.25+.43*fine,.015),fire*flicker);
  over(vec3(1,.55,.09),fire*.65);
}`;

/** GPU interpolation before colour, at twice the grid resolution. */
export class FireSurface {
  readonly canvas = document.createElement('canvas');
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly extent: [number, number, number, number];

  constructor(
    arrival: Float32Array,
    private readonly horizon: number,
  ) {
    this.extent = fireExtent(arrival, GRID);
    this.canvas.width = this.canvas.height = 2048;
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('No es pot crear la superfície animada del foc.');
    this.gl = gl;
    const program = gl.createProgram();
    if (!program) throw new Error('No es pot crear el programa del foc.');
    this.program = program;
    for (const [kind, code] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(kind)!;
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        this.dispose();
        throw new Error(message ?? 'Fire shader');
      }
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      this.dispose();
      throw new Error(message ?? 'Fire program');
    }
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      GRID,
      GRID,
      0,
      gl.RG,
      gl.FLOAT,
      arrivalTexture(arrival, GRID),
    );
    for (const name of [
      'field',
      'minute',
      'seconds',
      'horizon',
      'size',
      'cellMetres',
      'forecast',
      'crop',
    ])
      this.uniforms[name] = gl.getUniformLocation(program, name);
  }

  paint(minute: number, seconds: number, forecast: boolean): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms['field'], 0);
    gl.uniform1f(this.uniforms['minute'], minute);
    gl.uniform1f(this.uniforms['seconds'], seconds);
    gl.uniform1f(this.uniforms['horizon'], this.horizon);
    gl.uniform1f(this.uniforms['size'], GRID);
    gl.uniform1f(this.uniforms['cellMetres'], CELL_M);
    gl.uniform1i(this.uniforms['forecast'], +forecast);
    gl.uniform4fv(this.uniforms['crop'], this.extent);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  bounds(domain: readonly [number, number, number, number]): [number, number, number, number] {
    const [w, s, e, n] = domain,
      [left, top, right, bottom] = this.extent;
    return [w + left * (e - w), n - bottom * (n - s), w + right * (e - w), n - top * (n - s)];
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteProgram(this.program);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
