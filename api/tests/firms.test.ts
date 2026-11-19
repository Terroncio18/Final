import { test } from 'vitest';
import assert from 'node:assert/strict';
import { addDays, daysBetween, isDay, sourcesFor, today, windowsFor } from '../src/firms.js';
import { FIRMS_PLATFORMS, WINDOW_DAYS } from '../src/config.js';

const [SNPP, NOAA20, NOAA21] = FIRMS_PLATFORMS;

function table(entries: Record<string, [string, string]>) {
  return new Map(Object.entries(entries).map(([id, [min, max]]) => [id, { min, max }]));
}

test('a day plus days crosses months, years and the leap one', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2023-02-28', 1), '2023-03-01');
  assert.equal(addDays('2024-12-31', 1), '2025-01-01');
  assert.equal(addDays('2024-08-01', 0), '2024-08-01');
  assert.equal(addDays('2024-01-01', -1), '2023-12-31');
  assert.equal(addDays('2024-08-01', 31), '2024-09-01');
});

test('the distance between two days has a sign and no hours in it', () => {
  assert.equal(daysBetween('2024-08-01', '2024-08-01'), 0);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2, '2024 is a leap year');
  assert.equal(daysBetween('2023-02-28', '2023-03-01'), 1);
  assert.equal(daysBetween('2024-08-10', '2024-08-01'), -9);
  // The summer time change would make this 30 days and a bit if these were
  // local dates; they are not, and that is the reason they are strings.
  assert.equal(daysBetween('2024-03-01', '2024-03-31'), 30);
  assert.equal(daysBetween('2024-10-01', '2024-10-31'), 30);
});

test('a day is ten characters of a real date, and nothing else', () => {
  for (const good of ['2024-08-01', '2012-01-20', '2026-11-19']) assert.ok(isDay(good));
  for (const bad of [
    '2024-8-1',
    '2024-08-01T00:00:00Z',
    '2024-13-01',
    'today',
    '',
    ' 2024-08-01',
    20240801,
    null,
    undefined,
    { day: '2024-08-01' },
  ]) {
    assert.equal(isDay(bad), false, `${String(bad)} is not a day`);
  }

  // A day that does not exist does get through, and it is written down here
  // because the test is what found it: the month is in range, so the shape
  // holds, and `Date` rolls the 30th of February over to the 1st of March
  // instead of refusing it. FIRMS answers such a day with no rows, so it reads
  // as a day with no fires and not as an error. Tightening it would mean
  // comparing the parsed date back against the string.
  assert.equal(isDay('2024-02-30'), true);
  assert.equal(isDay('2024-13-01'), false, 'a month out of range is refused, though');
});

test('today is a day, and it is the one the system clock says', () => {
  assert.ok(isDay(today()));
  assert.equal(today(), new Date().toISOString().slice(0, 10));
});

test('a range is cut into windows of at most five days that cover it exactly', () => {
  assert.deepEqual(windowsFor('2024-08-01', '2024-08-01'), [{ start: '2024-08-01', days: 1 }]);
  assert.deepEqual(windowsFor('2024-08-01', '2024-08-05'), [{ start: '2024-08-01', days: 5 }]);
  assert.deepEqual(windowsFor('2024-08-01', '2024-08-06'), [
    { start: '2024-08-01', days: 5 },
    { start: '2024-08-06', days: 1 },
  ]);

  const month = windowsFor('2024-08-01', '2024-08-31');
  assert.equal(month.length, 7, 'a month is seven windows per platform');
  assert.equal(
    month.reduce((sum, window) => sum + window.days, 0),
    31,
    'the windows cover the range and nothing more',
  );
  for (const window of month) assert.ok(window.days >= 1 && window.days <= WINDOW_DAYS);
  const last = month[month.length - 1]!;
  assert.equal(addDays(last.start, last.days - 1), '2024-08-31', 'the last window ends at the end');
  // No gaps and no overlaps: each window starts where the previous one ended.
  for (let i = 1; i < month.length; i++) {
    assert.equal(addDays(month[i - 1]!.start, month[i - 1]!.days), month[i]!.start);
  }
});

test('a range that ends before it starts asks for nothing', () => {
  assert.deepEqual(windowsFor('2024-08-10', '2024-08-01'), []);
});

test('reprocessed data is preferred where it reaches, and near real time where it does not', () => {
  const held = table({
    [SNPP!.sp]: ['2012-01-20', '2026-09-30'],
    [SNPP!.nrt]: ['2026-08-01', '2026-11-19'],
    [NOAA20!.sp]: ['2018-01-05', '2026-09-30'],
    [NOAA20!.nrt]: ['2026-08-01', '2026-11-19'],
    [NOAA21!.nrt]: ['2026-08-01', '2026-11-19'],
  });

  // A day deep in the record: the two platforms that flew then, reprocessed.
  assert.deepEqual(sourcesFor('2024-08-01', held), [SNPP!.sp, NOAA20!.sp]);
  // Today: nothing is reprocessed yet, so all three answer in near real time.
  assert.deepEqual(sourcesFor('2026-11-19', held), [SNPP!.nrt, NOAA20!.nrt, NOAA21!.nrt]);
  // The overlap: both processings cover it, and the reprocessed one wins.
  assert.deepEqual(sourcesFor('2026-09-01', held), [SNPP!.sp, NOAA20!.sp, NOAA21!.nrt]);
  // Before VIIRS was in orbit: no source at all, and no exception either.
  assert.deepEqual(sourcesFor('2005-06-01', held), []);
});

test('with no table at all, every platform answers in near real time', () => {
  // This is what happens when FIRMS cannot be asked: the fallback has to be
  // the one that is right for today, which is the day that matters then.
  assert.deepEqual(sourcesFor('2026-11-19', new Map()), [SNPP!.nrt, NOAA20!.nrt, NOAA21!.nrt]);
  assert.deepEqual(sourcesFor('2005-06-01', new Map()), [SNPP!.nrt, NOAA20!.nrt, NOAA21!.nrt]);
});

test('a platform the table knows only in part is not invented for the days it misses', () => {
  const held = table({ [NOAA21!.sp]: ['2023-01-01', '2026-09-30'] });
  // NOAA-21 is known and does not cover it; the other two are unknown, so
  // they fall back to near real time.
  assert.deepEqual(sourcesFor('2026-11-19', held), [SNPP!.nrt, NOAA20!.nrt]);
});
