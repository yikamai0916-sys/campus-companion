// Pure helper functions for reminders and Hong Kong times.
// "Pure" means: no DOM, no network — the same input always gives the same
// output. That is why they can be unit-tested in Node (see test/reminder-logic.test.js).

export const HK_OFFSET_MS = 8 * 3600000; // Hong Kong is always UTC+8 (no daylight saving)
export const MAX_OFFSET_MINUTES = 525600; // 365 days, same limit as src/domain.js
export const MAX_OFFSETS = 12;            // backend accepts at most 12 "before due" reminders
export const MAX_EXACT = 20;              // backend accepts at most 20 exact reminder times
export const MAX_PRESETS = 10;            // how many custom presets one user can save
export const BUILT_IN_OFFSETS = [4320, 2880, 1440, 120, 30]; // 3 days, 2 days, 1 day, 2 hours, 30 minutes

// Minutes in one unit.
export const UNIT_MINUTES = { minute: 1, hour: 60, day: 1440 };

/** Convert "number + unit" (for example 2 + 'hour') to minutes (120). */
export function toMinutes(amount, unit) {
  const size = UNIT_MINUTES[unit];
  const n = Number(amount);
  if (!size || !Number.isInteger(n) || n <= 0) throw new Error('提醒时间无效');
  const minutes = n * size;
  if (minutes > MAX_OFFSET_MINUTES) throw new Error('提醒时间不能超过 365 天');
  return minutes;
}

/** Split minutes into the biggest whole unit: 2880 -> {amount:2, unit:'day'}, 90 -> {amount:90, unit:'minute'}. */
export function splitMinutes(minutes) {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'day' };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hour' };
  return { amount: minutes, unit: 'minute' };
}

const UNIT_NAMES = {
  'zh-CN': { minute: '分钟', hour: '小时', day: '天' },
  'zh-TW': { minute: '分鐘', hour: '小時', day: '天' },
  en: { minute: ['minute', 'minutes'], hour: ['hour', 'hours'], day: ['day', 'days'] },
};

/** Name of a unit in the chosen language, e.g. unitName('hour','zh-CN') -> '小时'. */
export function unitName(unit, locale = 'zh-CN', amount = 2) {
  const names = UNIT_NAMES[locale] || UNIT_NAMES['zh-CN'];
  const name = names[unit];
  return Array.isArray(name) ? name[amount === 1 ? 0 : 1] : name;
}

/** Human label for an offset: 1440 -> '1 天', 30 -> '30 分钟', in English '1 day'. */
export function offsetLabel(minutes, locale = 'zh-CN') {
  const { amount, unit } = splitMinutes(minutes);
  return `${amount} ${unitName(unit, locale, amount)}`;
}

/** Clean a list of offsets: whole numbers only, in range, no duplicates, biggest first. */
export function normalizeOffsets(list, limit = Infinity) {
  const clean = (Array.isArray(list) ? list : [])
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0 && n <= MAX_OFFSET_MINUTES);
  return [...new Set(clean)].sort((a, b) => b - a).slice(0, limit);
}

/** Saved custom presets never repeat a built-in chip. */
export function normalizePresets(list) {
  return normalizeOffsets(list).filter(n => !BUILT_IN_OFFSETS.includes(n)).slice(0, MAX_PRESETS);
}

/**
 * Which chips to show in the "截止前提醒" section:
 * built-in chips + the user's saved presets + any extra offsets the task already uses.
 */
export function chipOffsets(presets = [], selected = []) {
  return normalizeOffsets([...BUILT_IN_OFFSETS, ...normalizePresets(presets), ...normalizeOffsets(selected)]);
}

/** Days in a month (month is 1–12). February in a leap year -> 29. */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Timestamp (ms) -> Hong Kong calendar parts {year, month, day, hour, minute}. */
export function hkParts(ms) {
  const d = new Date(Number(ms) + HK_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/** Hong Kong calendar parts -> timestamp (ms). The day is clamped, so 31 Feb becomes 28/29 Feb. */
export function hkPartsToMs({ year, month, day, hour, minute }) {
  const safeDay = Math.min(day, daysInMonth(year, month));
  return Date.UTC(year, month - 1, safeDay, hour, minute) - HK_OFFSET_MS;
}

const pad = n => String(n).padStart(2, '0');

/** Timestamp -> 'YYYY-MM-DDTHH:mm' in Hong Kong time (the format the old datetime-local input used). */
export function toHkInputValue(ms) {
  if (ms === null || ms === undefined || ms === '') return '';
  const p = hkParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** 'YYYY-MM-DDTHH:mm' (Hong Kong) -> timestamp, or null for an empty string. */
export function fromHkInputValue(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('时间格式无效');
  return Date.parse(value + ':00+08:00');
}

/** Clean a list of exact reminder times: numbers only, no duplicates, earliest first. */
export function normalizeExact(list) {
  const clean = (Array.isArray(list) ? list : []).map(Number).filter(Number.isFinite);
  return [...new Set(clean)].sort((a, b) => a - b).slice(0, MAX_EXACT);
}

/** Round a timestamp up to the next whole hour (used as the picker's starting value). */
export function nextWholeHour(ms) {
  return Math.ceil((Number(ms) + 1) / 3600000) * 3600000;
}
