import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { VIEWS, type ViewId } from '../map/map.config';
import { RangePicker } from './range-picker';

@Component({
  selector: 'app-top-bar',
  imports: [RangePicker, RouterLink, RouterLinkActive],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.css',
})
export class TopBar {
  /** The three scopes, in the order map.config declares them. */

  protected readonly scopes = (Object.keys(VIEWS) as ViewId[]).map((id) => ({
    id,
    label: VIEWS[id].label,
  }));
}
