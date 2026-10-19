// Turns a list of digest mail items into a *briefing*: what needs action, what is coming up
// and what is just for information. Pure functions (no DOM) so they can be unit-tested and
// reused. All dates are Hong Kong calendar days (UTC+8, no daylight saving).
//
// An item is { id, subject, summary, action, category, received, brief? } where brief is the
// optional AI brief { title, topic, points:[{text}], actions:[{text}] }.

const HK_MS = 8 * 3600000;
const DAY = 86400000;

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_RE = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';

/** Start (00:00 HK time) of the Hong Kong calendar day that contains `ts`. */
export const hkDayStart = ts => Math.floor((Number(ts) + HK_MS) / DAY) * DAY - HK_MS;
const hkYear = ts => new Date(Number(ts) + HK_MS).getUTCFullYear();

function makeDay(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null; // e.g. 31 Feb
  return date.getTime() - HK_MS;
}

/**
 * Calendar dates mentioned in a text, as HK day-start timestamps (sorted, unique).
 * A date without a year takes the year of `refTs` (the mail's received time), rolling to the
 * next year only when that would put it more than ~6 months in the past.
 */
export function extractDates(text, refTs = Date.now()) {
  const source = String(text || '');
  const found = new Set();
  const refYear = hkYear(refTs);
  const add = (y, m, d) => {
    let year = y;
    if (!year) {
      year = refYear;
      let ts = makeDay(year, m, d);
      if (ts !== null && ts < hkDayStart(refTs) - 180 * DAY) ts = makeDay(year + 1, m, d);
      if (ts !== null) found.add(ts);
      return;
    }
    const ts = makeDay(year, m, d);
    if (ts !== null) found.add(ts);
  };
  let m;
  const iso = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  while ((m = iso.exec(source))) add(+m[1], +m[2], +m[3]);
  const zhFull = /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日號号]/g;
  while ((m = zhFull.exec(source))) add(+m[1], +m[2], +m[3]);
  const zhShort = /(?<![\d年])(\d{1,2})\s*月\s*(\d{1,2})\s*[日號号]/g;
  while ((m = zhShort.exec(source))) add(0, +m[1], +m[2]);
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b\\.?(?:,?\\s+(20\\d{2}))?`, 'gi');
  while ((m = dayMonth.exec(source))) add(m[3] ? +m[3] : 0, MONTHS[m[2].toLowerCase()], +m[1]);
  const monthDay = new RegExp(`\\b${MONTH_RE}\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(20\\d{2}))?`, 'gi');
  while ((m = monthDay.exec(source))) add(m[3] ? +m[3] : 0, MONTHS[m[1].toLowerCase()], +m[2]);
  return [...found].sort((a, b) => a - b);
}

/** Whole Hong Kong days from `now` until `ts` (0 = today, 1 = tomorrow, negative = past). */
export const daysUntil = (ts, now = Date.now()) => Math.round((hkDayStart(ts) - hkDayStart(now)) / DAY);

/** Strip forwarding prefixes ("FW:", "回复:") and collapse whitespace. */
export function cleanTitle(subject = '') {
  return String(subject).replace(/^(?:(?:\s*(?:fw|fwd|re|转发|轉寄|回复|回覆)\s*[:：])\s*)+/i, '').replace(/\s+/g, ' ').trim();
}

const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const DEADLINE = /(deadline|due\b|apply by|register by|registration|rsvp|submit|submission|截止|逾期|報名|报名|申請|申请|提交|繳交|缴交|填寫|填写)/i;
const GENERIC_ACTION = /^(请核对作业要求与截止时间|請核對作業要求與截止時間|请查看原邮件确认是否需要处理|請查看原郵件確認是否需要處理|无需操作|無需操作)$/;

/** Text used for date detection: subject, brief title and point texts, stored summary. */
function sourceText(item) {
  const b = item.brief;
  return [item.subject, b?.title, ...(b?.points || []).map(p => p.text), item.summary].filter(Boolean).join('\n');
}

/** The first date that is today or later, mentioned anywhere in the item, or null. */
export function nextDate(item, now = Date.now()) {
  const today = hkDayStart(now);
  return extractDates(sourceText(item), item.received || now).find(ts => ts >= today) ?? null;
}

/**
 * 'act'      – the email asks for something (AI-found request, or a deadline-type mail with a
 *              date in the next 14 days);
 * 'upcoming' – mentions a date that has not passed yet (events, seminars);
 * 'info'     – nothing time-bound.
 */
export function tierOf(item, now = Date.now()) {
  const when = nextDate(item, now);
  const hasRequest = !!item.brief?.actions?.length;
  const text = sourceText(item);
  const near = when !== null && daysUntil(when, now) <= 14;
  if (hasRequest) return 'act';
  if (near && (DEADLINE.test(text) || item.category === 1 || item.category === 2)) return 'act';
  if (when !== null) return 'upcoming';
  return 'info';
}

/** One-line headline: the AI title when there is one, otherwise the cleaned subject. */
export const headlineOf = item => cleanTitle(item.brief?.title || item.subject || '') || '—';

/**
 * A short "what is this about" line that is not just the title repeated. Uses the first AI
 * point, else the stored extractive summary. `provisional` is true when it is not AI-checked.
 */
export function gistOf(item) {
  const title = norm(headlineOf(item));
  const clean = s => String(s || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  const ai = clean(item.brief?.points?.[0]?.text);
  if (ai && norm(ai) !== title) return { text: ai, provisional: false };
  const stored = clean(item.summary);
  if (stored && norm(stored) !== title && !norm(stored).startsWith(title)) return { text: stored, provisional: true };
  const action = clean(item.action);
  if (action && !GENERIC_ACTION.test(action) && norm(action) !== title) return { text: action, provisional: true };
  return { text: '', provisional: !item.brief };
}

const TIER_ORDER = { act: 0, upcoming: 1, info: 2 };

/**
 * The briefing for one digest.
 * -> { rows, counts:{total,act,upcoming,info}, timeline, nextAct }
 * rows are sorted by urgency (tier, then date, then newest first).
 */
export function digestOverview(items, now = Date.now()) {
  const rows = (Array.isArray(items) ? items : []).map(item => ({
    item,
    tier: tierOf(item, now),
    when: nextDate(item, now),
    headline: headlineOf(item),
    gist: gistOf(item),
  }));
  rows.sort((a, b) =>
    TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
    || (a.when ?? Infinity) - (b.when ?? Infinity)
    || (Number(b.item.received) || 0) - (Number(a.item.received) || 0));
  const counts = { total: rows.length, act: 0, upcoming: 0, info: 0 };
  for (const row of rows) counts[row.tier]++;
  const timeline = rows.filter(r => r.when !== null).sort((a, b) => a.when - b.when).slice(0, 4);
  return { rows, counts, timeline, nextAct: rows.find(r => r.tier === 'act' && r.when !== null) || null };
}
