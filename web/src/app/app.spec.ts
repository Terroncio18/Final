import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

/**
 * A smoke test for the shell, and deliberately nothing more.
 *
 * App holds a top bar over an outlet and has no behaviour of its own, so what
 * there is to check is that the shell builds at all: a renamed selector, a
 * binding that no longer resolves or an import dropped from the standalone
 * component all show up here and nowhere else.
 *
 * The router is provided by hand because the top bar is made of routerLink,
 * and without one the shell cannot be created. That is what the scaffolded
 * version of this file tripped over —along with asserting a heading that the
 * portada has never had.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('builds the shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('puts the top bar over the outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-top-bar')).not.toBeNull();
    expect(root.querySelector('main.workspace router-outlet')).not.toBeNull();
  });
});
