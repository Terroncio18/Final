import { Marker, type Map as MapLibreMap } from 'maplibre-gl';

/**
 * Where a fire starts, as a mark that stands on the relief.
 *
 * Three parts, and two MapLibre markers to carry them, because they do not
 * face the same way:
 *
 * - **A ring on the ground**, pulsing. It is its own marker with
 *   `pitchAlignment: 'map'`, which is what lays it down on the terrain instead
 *   of standing it up towards the camera: it says *where*, exactly, and a ring
 *   seen in perspective is what reads as «on the ground».
 * - **A needle floating over it**, bouncing gently, and **a label** over the
 *   needle. These face the viewer, as a `symbol` does (§13.1), so the name can
 *   be read from any angle of the orbit.
 *
 * DOM markers and not layers of the style. The movement is the point of this
 * mark, and animating a layer means repainting the whole map —terrain and
 * all— sixty times a second; a CSS animation on an element moves that element
 * and nothing else. MapLibre places a marker at the height of the terrain and
 * dims it when a ridge is in front, so nothing is lost by it.
 *
 * It pulses on purpose. §2.22 kept the blinking out of navigation because on a
 * fire map what blinks means fire —and this is the one thing here that does.
 * The stylesheet stops every animation under `prefers-reduced-motion`.
 *
 * MapLibre writes the `transform` of each marker's root element to position
 * it, so nothing here animates a root: every animation is on a child.
 */
export interface SpawnMarker {
  remove(): void;
}

/** The needle: a head with a hole, and a stem that tapers to the point. */
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
): SpawnMarker {
  const ring = document.createElement('div');
  ring.className = 'spawn-ring';
  ring.innerHTML = '<span class="spawn-pulse"></span><span class="spawn-pulse late"></span>';

  const pin = document.createElement('div');
  pin.className = 'spawn-pin';
  const float = document.createElement('div');
  float.className = 'spawn-float';
  const text = document.createElement('span');
  text.className = 'spawn-label';
  // textContent and not innerHTML: the label is data.
  text.textContent = label;
  float.append(text);
  float.insertAdjacentHTML('beforeend', NEEDLE);
  pin.append(float);

  const position: [number, number] = [point[0], point[1]];

  // The ring first, so the needle is drawn over it.
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
