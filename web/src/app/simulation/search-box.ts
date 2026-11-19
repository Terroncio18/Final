import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SearchService, SHORTEST, type Match } from './search.service';

/**
 * The way into the form that does not start at the top.
 *
 * It sits in the head of the three steps and answers the same question at all
 * of them —which municipality— so it is one component and not three: a field
 * that meant «filter this list» on one step and «go anywhere» on the next
 * would be the same box doing two jobs.
 *
 * Where it goes is the ignition step, not the municipality list it came from:
 * the name typed *is* the answer those three steps ask for, so stopping one
 * level short to show it highlighted in a list would be asking it again.
 *
 * What it does not do is replace the steps. The hierarchy is still how the map
 * is read —a region's provinces, a province's municipalities— and that is for
 * somebody who is looking at the territory rather than for a name they already
 * have (§2.18).
 */
@Component({
  selector: 'app-search-box',
  templateUrl: './search-box.html',
  styleUrl: './search-box.css',
})
export class SearchBox {
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);

  protected readonly ready = this.search.ready;
  protected readonly failed = this.search.failed;

  protected readonly query = signal('');
  protected readonly open = signal(false);

  /**
   * Which row the keyboard is on. The first one, until something moves it.
   *
   * It is an index and not a code on purpose: the one thing Enter must always
   * do is take the row the user is looking at, and after a new letter that is
   * whatever is now at the top.
   */
  protected readonly highlighted = signal(0);

  /**
   * What the field offers.
   *
   * The service reads its index inside this call, so this re-runs by itself
   * when the file lands: a query typed while it was still on its way fills in
   * without anything here watching for it.
   */
  protected readonly results = computed(() => this.search.matches(this.query()));

  /** The row aria-activedescendant points at, or nothing when there is none. */
  protected readonly current = computed(() =>
    this.open() && this.results().length ? 'search-result-' + this.highlighted() : null,
  );

  protected type(event: Event): void {
    // Focus normally asked for the index already; this is for the ways text
    // arrives without one —a restored value, a paste into a field the browser
    // had focused itself— where «carregant» would otherwise be said about
    // nothing. The service ignores the second call.
    this.search.load();
    this.query.set((event.target as HTMLInputElement).value);
    this.highlighted.set(0);
    // Two letters and not one: under that there is nothing to show, and a list
    // that opens empty on the first keystroke is a flash of panel with
    // «carregant» in it on every single visit.
    this.open.set(this.query().trim().length >= SHORTEST);
  }

  /** Focus is the first evidence that the field is what the user came for. */
  protected enter(): void {
    this.search.load();
    if (this.query().trim().length >= SHORTEST) this.open.set(true);
  }

  protected key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // The query and not the list: closing a list that the next keystroke
      // reopens is a flicker, and an empty field is the state the user means.
      this.query.set('');
      this.open.set(false);
      return;
    }

    const results = this.results();

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Otherwise the caret jumps to one end of the text, which is what the
      // arrows do in a text field and not what they mean over a list.
      event.preventDefault();
      if (!results.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.highlighted.set((this.highlighted() + step + results.length) % results.length);
      return;
    }

    if (event.key === 'Enter') {
      const match = results[this.highlighted()];
      if (!match) return;
      // A search field in a form would otherwise submit something.
      event.preventDefault();
      this.go(match);
    }
  }

  /**
   * Straight to the ignition step of that municipality.
   *
   * Three segments and no point: the step draws the municipality and waits for
   * a click, exactly as if the three lists had been walked down. Pushed and
   * not replaced, so the back button returns to the step the search was typed
   * on rather than out of the form.
   */
  protected go(match: Match): void {
    this.query.set('');
    this.open.set(false);
    void this.router.navigate(['/simulacio', match.region, match.province, match.id]);
  }
}
