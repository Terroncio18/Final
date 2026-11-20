import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBar } from '../top-bar/top-bar';
import { MapService } from './map.service';

@Component({
  selector: 'app-map-shell',
  imports: [RouterOutlet, TopBar],
  templateUrl: './map-shell.html',
  styleUrl: './map-shell.css',
})
export class MapShell implements OnDestroy {
  private readonly maps = inject(MapService);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly ready = this.maps.ready;

  public constructor() {
    afterNextRender(() => this.maps.create(this.container().nativeElement));
  }

  public ngOnDestroy(): void {
    this.maps.destroy();
  }
}
