import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SearchService, SHORTEST, type Match } from './search.service';

// A municipality match skips directly to its coordinate-selection step; it does not filter the
// current hierarchy level.
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

  // Keep keyboard focus by result index so typing a new query selects its first row.
  protected readonly highlighted = signal(0);

  // The service reads an index signal, so results refresh when an in-flight index load completes.
  protected readonly results = computed(() => this.search.matches(this.query()));

  protected readonly current = computed(() =>
    this.open() && this.results().length ? 'search-result-' + this.highlighted() : null,
  );

  protected type(event: Event): void {
    // Text can arrive without a focus event (restored values or browser focus); request the index
    // here too.
    this.search.load();
    this.query.set((event.target as HTMLInputElement).value);
    this.highlighted.set(0);

    this.open.set(this.query().trim().length >= SHORTEST);
  }

  protected enter(): void {
    this.search.load();
    if (this.query().trim().length >= SHORTEST) this.open.set(true);
  }

  protected key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.query.set('');
      this.open.set(false);
      return;
    }

    const results = this.results();

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Prevent arrow keys moving the text caret while they select results.
      event.preventDefault();
      if (!results.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.highlighted.set((this.highlighted() + step + results.length) % results.length);
      return;
    }

    if (event.key === 'Enter') {
      const match = results[this.highlighted()];
      if (!match) return;
      // Prevent Enter submitting a surrounding form.
      event.preventDefault();
      this.go(match);
    }
  }

  // Push navigation so Back returns to the step where the search began.
  protected go(match: Match): void {
    this.query.set('');
    this.open.set(false);
    void this.router.navigate(['/simulacio', match.region, match.province, match.id]);
  }
}
