import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LayerMenu } from './layer-menu';

const LAYERS = ['relief', 'contours', 'labels', 'slopes', 'forecasts'] as const;

describe('LayerMenu', () => {
  let fixture: ComponentFixture<LayerMenu>;
  let m: LayerMenu;
  const boxes = () => [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input'),
  ];

  beforeEach(async () => {
    fixture = TestBed.createComponent(LayerMenu);
    m = fixture.componentInstance;
    LAYERS.forEach((layer, i) => fixture.componentRef.setInput(layer, i % 2 === 0));
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  it('shows each layer as it stands and switches it from its box', async () => {
    expect(boxes().map((box) => box.checked)).toEqual([true, false, true, false, true]);
    for (const box of boxes()) box.click();
    await fixture.whenStable();
    expect(LAYERS.map((layer) => m[layer]())).toEqual([false, true, false, true, false]);
    expect(boxes().map((box) => box.checked)).toEqual([false, true, false, true, false]);
  });
});
