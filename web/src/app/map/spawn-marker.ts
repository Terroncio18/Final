import { Marker, type Map as MapLibreMap } from 'maplibre-gl';

export interface SpawnMarker {
  remove(): void;
}

const NEEDLE = `
<svg viewBox="0 0 24 44" aria-hidden="true">
  <path class="spawn-stem" d="M12 43 9.4 21h5.2Z" />
  <circle class="spawn-head" cx="12" cy="12" r="9.5" />
  <circle class="spawn-eye" cx="12" cy="12" r="3.6" />
</svg>`;

export function addSpawnMarker(
  map: MapLibreMap,
  point: readonly [number, number],
  label: string,
  variant: 'ignition' | 'centre' = 'ignition',
): SpawnMarker {
  const ring = document.createElement('div');
  ring.className = variant === 'centre' ? 'spawn-ring spawn-centre' : 'spawn-ring';
  ring.innerHTML = '<span class="spawn-pulse"></span><span class="spawn-pulse late"></span>';

  const pin = document.createElement('div');
  pin.className = variant === 'centre' ? 'spawn-pin spawn-centre' : 'spawn-pin';
  const float = document.createElement('div');
  float.className = 'spawn-float';
  const text = document.createElement('span');
  text.className = 'spawn-label';
  text.textContent = label;
  float.append(text);
  float.insertAdjacentHTML('beforeend', NEEDLE);
  pin.append(float);

  const position: [number, number] = [point[0], point[1]];

  // The ground ring follows terrain pitch; the pin stays upright for its label.
  const ground = new Marker({
    element: ring,
    pitchAlignment: 'map',
    rotationAlignment: 'map',
  })
    .setLngLat(position)
    .addTo(map);

  const standing = new Marker({ element: pin, anchor: 'bottom' }).setLngLat(position).addTo(map);

  return {
    remove() {
      ground.remove();
      standing.remove();
    },
  };
}
