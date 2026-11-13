import { computed, Injectable, signal } from '@angular/core';

import { MUNICIPALITY_INDEX_URL } from '../map/map.config';

/**
 * How many rows the panel offers.
 *
 * The panel is 320 px wide and the list floats over what the step was
 * showing, so the number is not «as many as fit»: eight is about a third of
 * the panel's height, which is the most that can appear over a list of
 * municipalities without hiding the step the user is still on. Anything that
 * needs more than eight needs another letter typed.
 */
const LIMIT = 8;

/**
 * One letter matches a tenth of the index, which is not an answer.
 *
 * Exported because the field has to know it too: it is what tells «still
 * typing» apart from «no such municipality», and those are not the same thing
 * to say.
 */
export const SHORTEST = 2;

/** One row of the list: a municipality, and where it sits in the hierarchy. */
export interface Match {
  /** The LAU code, which is the last segment of the URL. */
  readonly id: string;
  readonly name: string;
  /** NUTS 3 code and name: the second segment, and the disambiguator. */
  readonly province: string;
  readonly provinceName: string;
  /** NUTS 2, the first segment. Derived, not carried by the file. */
  readonly region: string;
}

/** A match, plus the forms of its name that the query is tested against. */
interface Entry extends Match {
  readonly keys: readonly string[];
}

/** `data/municipality-index.json`, written by `scripts/build-index.mjs`. */
interface Index {
  readonly municipalities: readonly (readonly [string, string, string, string])[];
}

/**
 * Accents and case off, so that `soller` finds `Sóller`.
 *
 * Decomposed and stripped of its combining marks rather than mapped pair by
 * pair: the index is Spanish, Catalan, Galician, Basque and Portuguese at
 * once, which is more accents than a hand-written table survives. `ç` and `ñ`
 * come apart the same way, and so does anything the data turns out to carry.
 */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * The forms a name answers to, which are not only the name.
 *
 * Two shapes in the register would otherwise be unfindable, and both are
 * common enough to matter:
 *
 *   `Coruña, A`             786 units carry the article at the end, the way a
 *                           register sorts them. Nobody types it that way.
 *   `Agurain / Salvatierra` 126 are bilingual, and either half is the half
 *                           somebody happens to know.
 *
 * The name stays exactly as the data has it —it is the official one, and the
 * URL and the map both use it— and it is only what the query is compared
 * against that grows. Four characters is the longest of the articles (`Les`,
 * `Els`, `Os`, `L'`) and short enough that a second name after a comma, which
 * is how the Portuguese parishes write a merger, is not mistaken for one.
 *
 * An apostrophe takes no space after it: `Ametlla del Vallès, L'` is read as
 * `L'Ametlla`, which is how it is written and how it is typed, and the space
 * the first version put there was enough to make it unfindable.
 */
function keysOf(name: string): readonly string[] {
  const keys = new Set<string>([fold(name)]);

  const trailing = /^(.+), (\S{1,4})$/.exec(name);
  if (trailing) {
    const [, rest, article] = trailing;
    keys.add(fold(/['’]$/.test(article) ? article + rest : article + ' ' + rest));
  }

  if (name.includes('/')) for (const half of name.split('/')) keys.add(fold(half.trim()));

  return [...keys];
}

/**
 * How well an entry answers a query: lower is better, Infinity is not at all.
 *
 * Three degrees and not a relevance figure, because the three are what the
 * order has to get right: the name begins with what was typed, a word of it
 * does, or it merely contains it somewhere. `sant` typed over eleven thousand
 * names has to put `Sant Boi` above `Son Servera`, and `vila` has to put
 * `Vilanova` above `Sant Pere de Vilamajor` without burying either.
 */
function score(entry: Entry, query: string): number {
  let best = Infinity;

  for (const key of entry.keys) {
    const at = key.indexOf(query);
    if (at < 0) continue;
    if (at === 0) return 0;
    best = Math.min(best, /[\s'’\-(]/.test(key[at - 1]) ? 1 : 2);
  }

  return best;
}

/**
 * The names of every municipality, for the one question the hierarchy cannot
 * answer: where is this place.
 *
 * The form walks down three levels because that is what the data is organised
 * by (§2.25), and it is the right shape for somebody who knows the territory.
 * It is the wrong shape for somebody who knows only the name of a town: the
 * region of a municipality is exactly what they would have to look up first,
 * and a list of seventeen regions does not tell them. The field skips to the
 * answer, and the three steps stay where they are for everybody else.
 *
 * One file and all of it at once, which is the opposite of every other service
 * here. It is the same bargain seen from the other side: the per-province
 * files are cheap because the screen always knows its province, and this is
 * the one screen that does not.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  /** Empty until the file is in, so the field can say it is waiting. */
  private readonly entries = signal<readonly Entry[]>([]);

  readonly ready = computed(() => this.entries().length > 0);
  readonly failed = signal(false);

  private asked = false;

  /**
   * Reads the index, once, the first time somebody means to search.
   *
   * On focus and not on a step's arrival: 111 kB for a field most visits never
   * touch, on the screen whose whole point is a map that has to open. Focus is
   * early enough —the file is usually in before the second letter— and it is
   * also the honest moment, because it is the first evidence that the field is
   * what the user came for.
   */
  load(): void {
    if (this.asked) return;
    this.asked = true;

    // Resolved against the document and not against the current URL, which has
    // up to three segments of its own by the time this runs.
    const url = new URL(MUNICIPALITY_INDEX_URL, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<Index>;
      })
      .then((index) => {
        this.entries.set(
          index.municipalities.map(([name, id, province, provinceName]) => ({
            id,
            name,
            province,
            provinceName,
            // NUTS is hierarchical by construction, so the region is the first
            // four characters of the province's code. Not in the file for that
            // reason, and checked there against the provinces (build-index).
            region: province.slice(0, 4),
            keys: keysOf(name),
          })),
        );
      })
      .catch((error: unknown) => {
        console.error('[search]', error);
        this.failed.set(true);
      });
  }

  /**
   * The best matches for what was typed, and nothing under two letters.
   *
   * It reads the index signal, so a `computed` that calls it re-runs when the
   * file lands: a query typed while the index was still on its way fills in by
   * itself, and nothing has to watch for that.
   *
   * Eleven thousand entries scanned per keystroke, with no index of prefixes
   * and no debounce. It is two or three string searches each and it measures
   * well under a frame; a trie would be a structure to maintain and a second
   * description of the same ranking.
   */
  matches(query: string): readonly Match[] {
    const wanted = fold(query.trim());
    if (wanted.length < SHORTEST) return [];

    const found: { readonly entry: Entry; readonly rank: number }[] = [];
    for (const entry of this.entries()) {
      const rank = score(entry, wanted);
      if (rank !== Infinity) found.push({ entry, rank });
    }

    // The file arrives sorted by name, so equal ranks keep that order and the
    // comparison is only ever about the rank.
    found.sort((a, b) => a.rank - b.rank);

    return found.slice(0, LIMIT).map(({ entry }) => entry);
  }
}
