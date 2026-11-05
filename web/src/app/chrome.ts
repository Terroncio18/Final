import { Injectable, signal } from '@angular/core';

/**
 * Whether the application's own furniture is on screen.
 *
 * There is one piece of it, the top bar, and one screen that cannot have it:
 * the simulator. Its scope toggles would fly the camera off the domain and
 * «Crear simulació» would start a second one over the first. A full screen is
 * not a panel over the map, and the bar is the only thing that assumes it is.
 *
 * Written the same way the form turns the detections off (§2.21): the screen
 * that needs it asks on the way in and the state comes back when it is
 * destroyed, which covers the back button, the close and the tab being shut
 * without each of them having to remember.
 */
@Injectable({ providedIn: 'root' })
export class Chrome {
  readonly visible = signal(true);
}
