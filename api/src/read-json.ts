export async function fetchChecked(
  url: string,
  errorMessage: (status: number) => string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(errorMessage(response.status));
  return response;
}

// This generic assertion does not validate the JSON; callers must check external data.
export async function readJson<T>(url: string, source: string, init?: RequestInit): Promise<T> {
  const response = await fetchChecked(url, (status) => `${source}: ${status}`, init);
  return (await response.json()) as T;
}
