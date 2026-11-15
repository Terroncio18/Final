import {describe,expect,it,vi} from 'vitest';
vi.mock('./domain',()=>({GRID:16,CELL_M:30,domainAround:()=>[0,0,16,16]}));
import {emberFlight,emberIgnitionProbability,emberRandom} from './spotting';
import {spread,type SpreadInput} from './fire-spread';
import {fuelBed,FUEL_MODELS,firelineIntensity,M_PER_FT} from './rothermel';
import {spreadWinds} from './wind';
const moistures={dead1:0.01,dead10:0.02,dead100:0.03,live:1};
const base=fuelBed(FUEL_MODELS[1],moistures);
// A high heat release isolates ember transport from the much slower surface front.
const bed={...base,heatPerArea:100000};
const source=8*16+2;
const wind={speedKmh:10,towardsDeg:90,until:Infinity};
const intensity=firelineIntensity(bed,bed.r0*M_PER_FT);
const seed=Array.from({length:20000},(_,i)=>i).find(i=>{
  const flight=emberFlight(source,0,intensity,false,i,()=>wind);
  return flight && flight.cell%16>7 && emberRandom(i,source,3)<0.5;
})!;
const flight=emberFlight(source,0,intensity,false,seed,()=>wind)!;
const input:SpreadInput={elevation:new Float32Array(256).fill(100),bed,midflame:0,towardsDeg:90,ignitions:[source],horizon:30,
  fuelMoistures:moistures,wind10mKmh:10,temperatureC:40,spotting:{enabled:true,seed},
  countermeasures:{centre:[8,8],measures:[{id:'break',kind:'firebreak',points:[[6.5,0],[6.5,16]],widthM:30,strength:0,durationMin:0}]}};
describe('experimental ember spotting',()=>{
  it('conditions ignition on fine fuel, moisture and temperature',()=>{
    expect(emberIgnitionProbability(0.2,0.12,0.2,40)).toBe(0);
    expect(emberIgnitionProbability(0.03,0.12,0,40)).toBe(0);
    expect(emberIgnitionProbability(0.03,0.12,0.2,40)).toBeGreaterThan(emberIgnitionProbability(0.1,0.12,0.2,40));
    expect(emberIgnitionProbability(0.03,0.12,0.2,40)).toBeGreaterThan(emberIgnitionProbability(0.03,0.12,0.2,10));
  });
  it('creates a reproducible secondary ignition across a firebreak only when enabled',async()=>{
    expect(seed).toBeDefined();
    const off=await spread({...input,spotting:{enabled:false,seed}}),on=await spread(input),again=await spread(input);
    expect(off.arrival[flight.cell]).toBe(Infinity);
    expect(on.arrival[flight.cell]).toBeLessThan(Infinity);
    expect(on.spotIgnitions?.some(s=>s.source===source && s.cell===flight.cell)).toBe(true);
    expect(on.arrival).toEqual(again.arrival);
    expect(on.spotIgnitions).toEqual(again.spotIgnitions);
    expect(on.series.area[0]).toBe(off.series.area[0]);
  });
  it('does not ignite water or a cell wetted beyond moisture of extinction',async()=>{
    const sea=input.elevation.slice();sea[flight.cell]=0;
    const noLand=await spread({...input,elevation:sea});
    expect(noLand.arrival[flight.cell]).toBe(Infinity);
    const x=flight.cell%16,y=Math.floor(flight.cell/16);
    const wet=await spread({...input,countermeasures:{centre:[8,8],measures:[...input.countermeasures!.measures,
      {id:'wet',kind:'helicopter',points:[[x+0.5,16-y-0.5]],widthM:30,strength:0,durationMin:0,litresPerPass:1350,passes:1,passIntervalMin:10}]}});
    expect(wet.arrival[flight.cell]).toBe(Infinity);
  });
  it('keeps ember history intact before a future wind change',async()=>{
    const before=await spread(input);
    const after=await spread({...input,windChanges:spreadWinds([{startMin:20,speedKmh:30,fromDeg:0}])});
    for(let i=0;i<256;i++)if(before.arrival[i]<20)expect(after.arrival[i]).toBe(before.arrival[i]);
    expect(after.series.area.slice(0,20)).toEqual(before.series.area.slice(0,20));
    expect(after.spotIgnitions?.filter(s=>s.minute<20)).toEqual(before.spotIgnitions?.filter(s=>s.minute<20));
  });
  it('integrates wind changes in flight and produces no distant spotting in calm air',()=>{
    expect(emberFlight(source,0,intensity,false,seed,()=>({...wind,speedKmh:0}))).toBeNull();
    const turned=emberFlight(source,0,intensity,false,seed,t=>t<0.5?{...wind,until:0.5}:{...wind,towardsDeg:0});
    expect(turned?.cell).not.toBe(flight.cell);
  });
});
