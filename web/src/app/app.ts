import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Chrome } from './chrome';
import { TopBar } from './top-bar/top-bar';

@Component({
  imports: [RouterOutlet, TopBar],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  /** The top bar is on screen unless a full screen has asked for it to go. */
  protected readonly chrome = inject(Chrome);
}
