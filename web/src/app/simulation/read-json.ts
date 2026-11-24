/**
 * Read JSON from a URL, complaining if it does not arrive. Nine call sites wrote this by hand.
 *
 * Relative URLs resolve against `document.baseURI`: a nested route would otherwise ask for
 * `/simulacio/data/...`. An absolute or root-relative URL passes through unchanged.
 *
 * **This validates nothing.** `T` is what the caller expects, not what arrived, so it carries the
 * same assertion the call sites already had — only now in one place instead of nine, which is
 * where a validator would go if one is ever added. Regla 7 of `docs/estil.md`: an assertion does
 * not prove a JSON meets its contract.
 */
export async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const resolved = new URL(url, document.baseURI).href;
  const response = await fetch(resolved, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}
