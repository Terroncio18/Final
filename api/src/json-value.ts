export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
