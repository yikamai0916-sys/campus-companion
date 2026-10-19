import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDates, daysUntil, hkDayStart, tierOf, nextDate, gistOf, headlineOf, cleanTitle, digestOverview } from '../public/digest-insights.js';

const hk = (y, m, d, h = 0) => Date.UTC(y, m - 1, d, h) - 8 * 3600000; // HK wall-clock -> timestamp
const NOW = hk(2026, 10, 18, 12); // Sun 18 Oct 2026, noon HK

test('extractDates reads English, Chinese and ISO dates as Hong Kong days', () => {
  const text = 'Seminar on 23 October 2026, Friday. Also Oct 24, 2026 and 2026-10-25 and 2026年10月26日 and 10月27日';
  const days = extractDates(text, NOW);
  assert.deepEqual(days, [23, 24, 25, 26, 27].map(d => hk(2026, 10, d)));
});

test('extractDates handles ordinals, abbreviations and ignores impossible or non-date numbers', () => {
  assert.deepEqual(extractDates('Due 3rd Nov', NOW), [hk(2026, 11, 3)]);
  assert.deepEqual(extractDates('Pitch Perfect Programme 2026/27, 30th Anniversary, 31 February', NOW), []);
  assert.deepEqual(extractDates('', NOW), []);
  assert.deepEqual(extractDates(null, NOW), []);
});

test('a date without a year uses the mail year and rolls over only when far in the past', () => {
  assert.deepEqual(extractDates('on 5 January', hk(2026, 12, 20)), [hk(2027, 1, 5)]);
  assert.deepEqual(extractDates('on 5 January', hk(2026, 1, 20)), [hk(2026, 1, 5)]);
});

test('daysUntil counts Hong Kong calendar days, not 24-hour blocks', () => {
  assert.equal(daysUntil(hk(2026, 10, 18), hk(2026, 10, 18, 23)), 0);
  assert.equal(daysUntil(hk(2026, 10, 19), hk(2026, 10, 18, 23)), 1);
  assert.equal(daysUntil(hk(2026, 10, 17), NOW), -1);
  assert.equal(hkDayStart(hk(2026, 10, 18, 23)), hk(2026, 10, 18));
});

test('tiers: AI request or near deadline => act; future date => upcoming; otherwise info', () => {
  const withRequest = { subject: 'Form', brief: { actions: [{ text: 'Submit form' }], points: [] } };
  assert.equal(tierOf(withRequest, NOW), 'act');
  const deadline = { subject: 'Scholarship application deadline 22 October 2026', category: 1 };
  assert.equal(tierOf(deadline, NOW), 'act');
  const seminar = { subject: 'Seminar on 30 October 2026', category: 3 };
  assert.equal(tierOf(seminar, NOW), 'upcoming');
  assert.equal(tierOf({ subject: 'Newsletter', category: 4 }, NOW), 'info');
  const past = { subject: 'Seminar on 1 October 2026', category: 3 };
  assert.equal(tierOf(past, NOW), 'info');
  assert.equal(nextDate(past, NOW), null);
});

test('a far-away deadline in a course mail is upcoming, not urgent', () => {
  assert.equal(tierOf({ subject: 'Final report due 30 December 2026', category: 2 }, NOW), 'upcoming');
});

test('headline strips forwarding prefixes and prefers the AI title', () => {
  assert.equal(cleanTitle('FW: Re:  Hello   world'), 'Hello world');
  assert.equal(headlineOf({ subject: 'FW: Raw subject', brief: { title: 'Clear title' } }), 'Clear title');
  assert.equal(headlineOf({ subject: '' }), '—');
});

test('gist never just repeats the headline and is marked provisional without an AI brief', () => {
  assert.deepEqual(gistOf({ subject: 'Hello', summary: 'Hello' }), { text: '', provisional: true });
  assert.deepEqual(gistOf({ subject: 'Hello', summary: 'Bring your ID card.' }), { text: 'Bring your ID card.', provisional: true });
  const ai = gistOf({ subject: 'Hello', summary: 'x', brief: { title: 'Hello', points: [{ text: 'Registration closes Friday.' }], actions: [] } });
  assert.deepEqual(ai, { text: 'Registration closes Friday.', provisional: false });
  assert.equal(gistOf({ subject: 'A', summary: '', action: '请核对作业要求与截止时间' }).text, '');
});

test('digestOverview orders by urgency, counts tiers and builds a short timeline', () => {
  const items = [
    { id: 'a', subject: 'Newsletter', received: NOW - 1000 },
    { id: 'b', subject: 'Seminar on 30 October 2026', category: 3, received: NOW - 2000 },
    { id: 'c', subject: 'Application deadline 20 October 2026', category: 1, received: NOW - 3000 },
    { id: 'd', subject: 'Workshop on 25 October 2026', category: 3, received: NOW - 4000 },
  ];
  const overview = digestOverview(items, NOW);
  assert.deepEqual(overview.rows.map(r => r.item.id), ['c', 'd', 'b', 'a']);
  assert.deepEqual(overview.counts, { total: 4, act: 1, upcoming: 2, info: 1 });
  assert.deepEqual(overview.timeline.map(r => r.item.id), ['c', 'd', 'b']);
  assert.equal(overview.nextAct.item.id, 'c');
  assert.deepEqual(digestOverview(null, NOW).counts, { total: 0, act: 0, upcoming: 0, info: 0 });
});
