import { isJsonObject, type JsonObject, type JsonValue } from './json-value.js';

export interface WeatherStation {
  readonly id: string;
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
}

export interface Observation {
  readonly source: 'AEMET' | 'IPMA';
  readonly station: WeatherStation;
  // Observation time, UTC, ISO 8601.
  readonly observedAt: string;
  readonly windKmh: number;
  // Wind comes from this bearing, clockwise from north.
  readonly windFromDeg: number;
  // Relative humidity, percent.
  readonly humidity: number;
  // Air temperature, °C.
  readonly temperature: number;
}

// IPMA uses two north codes; calm has no bearing and is excluded.
const IPMA_BEARINGS: Readonly<Partial<Record<number, number>>> = {
  1: 0,
  2: 45,
  3: 90,
  4: 135,
  5: 180,
  6: 225,
  7: 270,
  8: 315,
  9: 0,
};
const IPMA_MISSING = -99;

function isNumber(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readStation(
  id: JsonValue | undefined,
  name: JsonValue | undefined,
  lon: JsonValue | undefined,
  lat: JsonValue | undefined,
): WeatherStation | null {
  if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()) return null;
  if (!isNumber(lon) || !isNumber(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return { id, name, lon, lat };
}

function readInstant(value: JsonValue | undefined): string | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)
  )
    return null;
  const day = value.slice(0, 10);
  const calendar = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day)
    return null;
  // Providers omit the UTC zone; never interpret their times in the server's local zone.
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const instant = new Date(zoned);
  return Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
}

export function readAemetPointer(value: JsonValue): string {
  if (!isJsonObject(value)) throw new Error('AEMET: resposta invàlida.');
  const status = value['estado'];
  const url = value['datos'];
  if (status !== 200 || typeof url !== 'string' || !url.trim()) {
    const description = typeof value['descripcion'] === 'string' ? value['descripcion'] : '';
    throw new Error(
      `AEMET: ${typeof status === 'number' ? status : 'resposta invàlida'} ${description}`,
    );
  }
  return url;
}

function readAemetObservation(value: JsonValue): Observation | null {
  if (!isJsonObject(value)) return null;
  const station = readStation(value['idema'], value['ubi'], value['lon'], value['lat']);
  const observedAt = readInstant(value['fint']);
  const wind = value['vv'],
    direction = value['dv'],
    temperature = value['ta'],
    humidity = value['hr'];
  if (!station || !observedAt) return null;
  if (!isNumber(wind) || !isNumber(direction) || !isNumber(temperature) || !isNumber(humidity))
    return null;
  if (wind < 0 || direction < 0 || direction > 360 || humidity < 0 || humidity > 100) return null;
  return {
    source: 'AEMET',
    station,
    observedAt,
    windKmh: Math.round(wind * 36) / 10,
    windFromDeg: direction,
    humidity,
    temperature,
  };
}

export function readAemetObservations(value: JsonValue): Observation[] {
  if (!Array.isArray(value)) throw new Error('AEMET data: resposta invàlida.');
  const latest = new Map<string, Observation>();
  for (const raw of value) {
    const row = readAemetObservation(raw);
    if (!row) continue;
    const held = latest.get(row.station.id);
    if (!held || row.observedAt > held.observedAt) latest.set(row.station.id, row);
  }
  return [...latest.values()];
}

function readIpmaStation(value: JsonValue): WeatherStation | null {
  if (!isJsonObject(value)) return null;
  const geometry = value['geometry'],
    properties = value['properties'];
  if (!isJsonObject(geometry) || !isJsonObject(properties)) return null;
  const coordinates = geometry['coordinates'],
    id = properties['idEstacao'];
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !isNumber(id)) return null;
  return readStation(String(id), properties['localEstacao'], coordinates[0], coordinates[1]);
}

export function readIpmaStations(value: JsonValue): Map<string, WeatherStation> {
  if (!Array.isArray(value)) throw new Error('IPMA stations: resposta invàlida.');
  const stations = new Map<string, WeatherStation>();
  for (const raw of value) {
    const station = readIpmaStation(raw);
    if (station) stations.set(station.id, station);
  }
  return stations;
}

function readIpmaObservation(
  value: JsonValue,
  station: WeatherStation,
  observedAt: string,
): Observation | null {
  if (!isJsonObject(value)) return null;
  const wind = value['intensidadeVentoKM'],
    direction = value['idDireccVento'];
  const temperature = value['temperatura'],
    humidity = value['humidade'];
  if (!isNumber(direction)) return null;
  const bearing = IPMA_BEARINGS[direction];
  if (bearing === undefined || !isNumber(wind) || !isNumber(temperature) || !isNumber(humidity))
    return null;
  if (wind < 0 || temperature === IPMA_MISSING || humidity < 0 || humidity > 100) return null;
  return {
    source: 'IPMA',
    station,
    observedAt,
    windKmh: wind,
    windFromDeg: bearing,
    humidity,
    temperature,
  };
}

function addIpmaHour(
  found: Map<string, Observation>,
  stations: ReadonlyMap<string, WeatherStation>,
  rows: JsonObject,
  observedAt: string,
): void {
  for (const [id, raw] of Object.entries(rows)) {
    const station = stations.get(id);
    if (found.has(id) || !station) continue;
    const observation = readIpmaObservation(raw, station, observedAt);
    if (observation) found.set(id, observation);
  }
}

export function readIpmaObservations(
  value: JsonValue,
  stations: ReadonlyMap<string, WeatherStation>,
): Observation[] {
  if (!isJsonObject(value)) throw new Error('IPMA: resposta invàlida.');
  const found = new Map<string, Observation>();
  for (const hour of Object.keys(value).sort((a, b) => b.localeCompare(a))) {
    const observedAt = readInstant(hour),
      rows = value[hour];
    if (observedAt && isJsonObject(rows)) addIpmaHour(found, stations, rows, observedAt);
  }
  return [...found.values()];
}
