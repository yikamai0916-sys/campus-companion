import test from 'node:test';
import assert from 'node:assert/strict';
import { toMinutes, splitMinutes, offsetLabel, normalizeOffsets, normalizePresets, chipOffsets, daysInMonth, hkParts, hkPartsToMs, toHkInputValue, fromHkInputValue, normalizeExact, nextWholeHour, BUILT_IN_OFFSETS } from '../public/reminder-logic.js';
import { rubberBand, indexForPosition, ITEM_HEIGHT } from '../public/wheel-picker.js';

test('number + unit converts to minutes and back', () => {
  assert.equal(toMinutes(30, 'minute'), 30);
  assert.equal(toMinutes(2, 'hour'), 120);
  assert.equal(toMinutes(3, 'day'), 4320);
  assert.throws(() => toMinutes(0, 'hour'));
  assert.throws(() => toMinutes(1.5, 'hour'));
  assert.throws(() => toMinutes(2, 'week'));
  assert.throws(() => toMinutes(366, 'day'));
  assert.deepEqual(splitMinutes(2880), { amount: 2, unit: 'day' });
  assert.deepEqual(splitMinutes(120), { amount: 2, unit: 'hour' });
  assert.deepEqual(splitMinutes(90), { amount: 90, unit: 'minute' });
  for (const m of [5, 45, 60, 90, 360, 1440, 2880, 10080]) {
    const { amount, unit } = splitMinutes(m);
    assert.equal(toMinutes(amount, unit), m);
  }
});

test('offset labels in three languages', () => {
  assert.equal(offsetLabel(4320), '3 天');
  assert.equal(offsetLabel(120), '2 小时');
  assert.equal(offsetLabel(30, 'zh-TW'), '30 分鐘');
  assert.equal(offsetLabel(1440, 'en'), '1 day');
  assert.equal(offsetLabel(2880, 'en'), '2 days');
});

test('offsets and presets are cleaned, de-duplicated and sorted', () => {
  assert.deepEqual(normalizeOffsets([30, '120', 30, -5, 1.5, 'x', 600000]), [120, 30]);
  assert.deepEqual(normalizeOffsets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 12).length, 12);
  // built-in chips are never stored twice as custom presets
  assert.deepEqual(normalizePresets([1440, 90, 90, 360]), [360, 90]);
  assert.equal(normalizePresets(Array.from({ length: 30 }, (_, i) => i + 1)).length, 10);
  assert.deepEqual(normalizePresets(undefined), []);
  // chips = built-ins + presets + whatever the task already uses
  assert.deepEqual(chipOffsets([90], [45, 1440]), [4320, 2880, 1440, 120, 90, 45, 30]);
  assert.deepEqual(chipOffsets(), BUILT_IN_OFFSETS);
});

test('Hong Kong date helpers round trip and handle month lengths', () => {
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2026, 4), 30);
  const ms = Date.parse('2026-10-01T18:30:00+08:00');
  assert.deepEqual(hkParts(ms), { year: 2026, month: 10, day: 1, hour: 18, minute: 30 });
  assert.equal(hkPartsToMs(hkParts(ms)), ms);
  // 31 February is clamped to the last day of February
  assert.equal(hkPartsToMs({ year: 2026, month: 2, day: 31, hour: 9, minute: 0 }), Date.parse('2026-02-28T09:00:00+08:00'));
  // same text format the old <input type="datetime-local"> produced
  assert.equal(toHkInputValue(ms), '2026-10-01T18:30');
  assert.equal(fromHkInputValue('2026-10-01T18:30'), ms);
  assert.equal(toHkInputValue(null), '');
  assert.equal(fromHkInputValue(''), null);
  assert.throws(() => fromHkInputValue('2026-10-01 18:30'));
  // just after midnight HK is still the previous day in UTC
  assert.deepEqual(hkParts(Date.parse('2026-10-01T00:05:00+08:00')).day, 1);
});

test('exact times are de-duplicated, sorted and capped at 20', () => {
  assert.deepEqual(normalizeExact([3, 1, 2, 1, 'x']), [1, 2, 3]);
  assert.equal(normalizeExact(Array.from({ length: 30 }, (_, i) => i)).length, 20);
  assert.equal(nextWholeHour(Date.parse('2026-10-01T10:15:00Z')), Date.parse('2026-10-01T11:00:00Z'));
  assert.equal(nextWholeHour(Date.parse('2026-10-01T10:00:00Z')), Date.parse('2026-10-01T11:00:00Z'));
});

test('wheel physics: rubber band resists and snapping stays in range', () => {
  assert.equal(rubberBand(0, 200), 0);
  assert.ok(rubberBand(50, 200) < 50);            // moves less than the finger
  assert.ok(rubberBand(10000, 200) < 200);        // never further than the column height
  assert.ok(rubberBand(100, 200) > rubberBand(50, 200));
  assert.equal(indexForPosition(0, 10), 0);
  assert.equal(indexForPosition(-ITEM_HEIGHT * 2.4, 10), 2);
  assert.equal(indexForPosition(-ITEM_HEIGHT * 2.6, 10), 3);
  assert.equal(indexForPosition(80, 10), 0);      // pulled past the top
  assert.equal(indexForPosition(-ITEM_HEIGHT * 50, 10), 9); // flung past the bottom
});
