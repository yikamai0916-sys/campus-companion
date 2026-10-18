// Scroll-wheel pickers (like the iPhone date picker), written in plain JavaScript.
//
//  - WheelColumn: one spinning column. Supports touch / mouse drag (with inertia),
//    the mouse wheel / trackpad, clicking an item, and the keyboard.
//  - openDateTimePicker(): year / month / day / hour / minute columns in a dialog.
//  - openDurationPicker(): number + unit (分钟 / 小时 / 天) columns in a dialog.
//
// Physics in a nutshell (all distances in px, time in ms):
//   y = how far the column is scrolled. Item i is centred when y = -i * ITEM_HEIGHT.
//   While dragging, y follows the finger; past the ends it moves less ("rubber band").
//   After letting go, the speed slowly decays (inertia). When it is slow enough a
//   spring pulls y onto the nearest item (snap). If the column flies past an end,
//   a spring pulls it back (the bounce you see).

import { daysInMonth, hkParts, hkPartsToMs, nextWholeHour, toMinutes, splitMinutes, unitName } from './reminder-logic.js';

export const ITEM_HEIGHT = 40;   // px per row; keep in sync with .wheel-item in wheel-picker.css
const VISIBLE_ROWS = 5;          // odd number, so one row sits in the middle
const FRICTION = 0.004;          // how fast inertia fades (bigger = stops sooner)
const SNAP_SPEED = 0.06;         // px/ms: below this speed we start snapping
const SPRING = 0.0005;           // spring stiffness for snapping / bouncing back
const DAMPING = 0.045;           // spring damping (≈ critical, so no wobble when snapping)

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const lang = () => (typeof document !== 'undefined' && document.documentElement.lang) || 'zh-CN';
const L = (cn, tw, en) => (lang() === 'zh-TW' ? tw : lang() === 'en' ? en : cn);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Rubber band: how far the column visually moves when you pull it `distance` px
 * past an end. It grows slower and slower and never exceeds `size`.
 */
export function rubberBand(distance, size) {
  return (1 - 1 / ((distance * 0.55) / size + 1)) * size;
}

/** Nearest item index for a scroll position, kept inside [0, count-1]. */
export function indexForPosition(y, count, itemHeight = ITEM_HEIGHT) {
  return clamp(Math.round(-y / itemHeight), 0, Math.max(0, count - 1));
}

export class WheelColumn {
  /**
   * @param {object} options
   * @param {string} options.label    Accessible name, e.g. '月'
   * @param {{value:any,text:string}[]} options.items
   * @param {number} [options.index]  Item selected at the start
   * @param {(value:any, index:number)=>void} [options.onChange] Called when the column settles on a new item
   */
  constructor({ label, items, index = 0, onChange = () => {} }) {
    this.onChange = onChange;
    this.y = 0;          // current scroll position (px)
    this.velocity = 0;   // px per ms
    this.frame = 0;      // requestAnimationFrame id (0 = not animating)
    this.wheelSum = 0;   // collects small trackpad deltas

    // <div class="wheel-column" role="spinbutton"> <div class="wheel-track"> items… </div> </div>
    this.el = document.createElement('div');
    this.el.className = 'wheel-column';
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'spinbutton');
    this.el.setAttribute('aria-label', label);
    this.el.style.height = VISIBLE_ROWS * ITEM_HEIGHT + 'px';
    this.track = document.createElement('div');
    this.track.className = 'wheel-track';
    this.el.append(this.track);

    this.setItems(items, index);
    this.listen();
  }

  get index() { return indexForPosition(this.y, this.items.length); }
  get value() { return this.items[this.index]?.value; }
  get minY() { return -(this.items.length - 1) * ITEM_HEIGHT; }

  /** Replace the items (e.g. 28/29/30/31 days) and select `index`. */
  setItems(items, index = 0) {
    this.items = items;
    this.track.replaceChildren(...items.map(item => {
      const row = document.createElement('div');
      row.className = 'wheel-item';
      row.textContent = item.text;
      return row;
    }));
    this.stop();
    this.y = -clamp(index, 0, items.length - 1) * ITEM_HEIGHT;
    this.lastIndex = this.index;
    this.render();
  }

  /** Move to an item. `animate` = smooth spring; otherwise jump straight there. */
  setIndex(index, animate = true) {
    const target = clamp(index, 0, this.items.length - 1);
    if (!animate || reducedMotion()) {
      this.stop();
      this.y = -target * ITEM_HEIGHT;
      this.render();
      this.settled();
      return;
    }
    this.target = -target * ITEM_HEIGHT; // the spring will pull y here
    this.start();
  }

  setValue(value, animate = false) {
    const i = this.items.findIndex(item => item.value === value);
    if (i >= 0) this.setIndex(i, animate);
  }

  // ---------- drawing ----------
  render() {
    const centre = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;
    this.track.style.transform = `translateY(${this.y + centre}px)`;
    // Rows further from the middle tilt away and fade, like a real wheel.
    [...this.track.children].forEach((row, i) => {
      const distance = (i * ITEM_HEIGHT + this.y) / ITEM_HEIGHT; // 0 = centred row
      const far = Math.abs(distance);
      row.style.visibility = far > 3 ? 'hidden' : '';
      if (far > 3) return;
      row.style.transform = `rotateX(${-distance * 18}deg)`;
      row.style.opacity = String(1 - Math.min(far, 2.6) * 0.33);
      row.classList.toggle('is-selected', far < 0.5);
    });
    const item = this.items[this.index];
    this.el.setAttribute('aria-valuenow', String(this.index));
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', String(this.items.length - 1));
    this.el.setAttribute('aria-valuetext', item ? item.text : '');
  }

  // ---------- animation loop ----------
  start() {
    if (!this.frame) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(time => this.step(time));
    }
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.velocity = 0;
    this.target = undefined;
  }

  step(time) {
    let dt = Math.min(64, time - this.lastTime); // cap, in case the tab was in the background
    this.lastTime = time;
    // Small sub-steps keep the spring maths stable.
    while (dt > 0) {
      const h = Math.min(4, dt);
      dt -= h;
      const outside = this.y > 0 ? 0 : this.y < this.minY ? this.minY : null;
      if (outside !== null) {
        // Past an end: a spring pulls us back (rubber-band bounce).
        this.target = outside;
      } else if (this.target === undefined && Math.abs(this.velocity) < SNAP_SPEED) {
        // Inertia has nearly run out: pick the nearest row and snap to it.
        this.target = -this.index * ITEM_HEIGHT;
      }
      if (this.target === undefined) {
        this.velocity *= Math.exp(-FRICTION * h); // coasting with inertia
      } else {
        const force = -SPRING * (this.y - this.target) - DAMPING * this.velocity;
        this.velocity += force * h;
      }
      this.y += this.velocity * h;
    }
    this.render();
    const done = this.target !== undefined && Math.abs(this.y - this.target) < 0.3 && Math.abs(this.velocity) < 0.01;
    if (done) {
      this.y = this.target;
      this.render();
      this.stop();
      this.settled();
      return;
    }
    this.frame = requestAnimationFrame(t => this.step(t));
  }

  /** Tell the owner when the selected item really changed. */
  settled() {
    if (this.index !== this.lastIndex) {
      this.lastIndex = this.index;
      this.onChange(this.value, this.index);
    }
  }

  // ---------- input ----------
  listen() {
    const el = this.el;
    let drag = null; // info about the current finger / mouse drag

    el.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      this.stop();
      el.setPointerCapture(event.pointerId);
      drag = { startY: event.clientY, startPos: this.y, moved: 0, samples: [{ t: event.timeStamp, y: event.clientY }] };
    });

    el.addEventListener('pointermove', event => {
      if (!drag) return;
      const delta = event.clientY - drag.startY;
      drag.moved = Math.max(drag.moved, Math.abs(delta));
      let y = drag.startPos + delta;
      // Rubber band: past an end, the column moves less than the finger.
      const size = VISIBLE_ROWS * ITEM_HEIGHT;
      if (y > 0) y = rubberBand(y, size);
      if (y < this.minY) y = this.minY - rubberBand(this.minY - y, size);
      this.y = y;
      drag.samples.push({ t: event.timeStamp, y: event.clientY });
      if (drag.samples.length > 6) drag.samples.shift();
      this.render();
    });

    const release = event => {
      if (!drag) return;
      const info = drag;
      drag = null;
      if (info.moved < 5) {
        // A tap, not a drag: go to the row that was tapped.
        const box = el.getBoundingClientRect();
        const offsetRows = Math.round((event.clientY - box.top - box.height / 2) / ITEM_HEIGHT);
        this.setIndex(this.index + offsetRows);
        return;
      }
      // Speed of the last ~100 ms of movement becomes the inertia.
      const recent = info.samples.filter(s => event.timeStamp - s.t < 100);
      const first = recent[0] || info.samples[0];
      const last = info.samples[info.samples.length - 1];
      const time = Math.max(1, last.t - first.t);
      this.velocity = clamp((last.y - first.y) / time, -3, 3);
      if (reducedMotion()) {
        // No animation: jump to where the throw would have stopped.
        this.setIndex(indexForPosition(this.y + this.velocity / FRICTION, this.items.length), false);
        return;
      }
      this.target = undefined;
      this.start();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    // Mouse wheel / trackpad: roughly one row per wheel "notch".
    el.addEventListener('wheel', event => {
      event.preventDefault();
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      let rows;
      if (Math.abs(pixels) >= 50) {
        rows = Math.sign(pixels); // a mouse wheel "notch" (usually ±100 px) = exactly one row
        this.wheelSum = 0;
      } else {
        // trackpads send many small deltas: add them up, one row per ~32 px
        this.wheelSum += pixels;
        rows = Math.trunc(this.wheelSum / (ITEM_HEIGHT * 0.8));
        if (!rows) return;
        this.wheelSum -= rows * ITEM_HEIGHT * 0.8;
      }
      // Count from the row we are already heading to, so quick notches add up.
      const from = this.target === undefined ? this.index : indexForPosition(this.target, this.items.length);
      const next = from + rows;
      if ((next < 0 || next > this.items.length - 1) && !reducedMotion()) {
        // Already at the end: a small nudge outward, then the spring bounces it back.
        this.velocity = -Math.sign(rows) * 0.6;
        this.target = undefined;
        this.start();
        return;
      }
      this.setIndex(next);
    }, { passive: false });

    // Keyboard: ↑ ↓ one row, Page Up / Page Down five rows, Home / End to the ends.
    el.addEventListener('keydown', event => {
      const moves = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
      let next;
      if (event.key in moves) next = this.index + moves[event.key];
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = this.items.length - 1;
      else return;
      event.preventDefault();
      this.setIndex(next, false);
    });
  }
}

// ---------------------------------------------------------------------------
// Dialog shell shared by both pickers
// ---------------------------------------------------------------------------

/**
 * Opens a small dialog that contains wheel columns.
 * Resolves with 'ok', 'clear' or 'cancel' when the user closes it.
 */
function showWheelDialog({ title, columns, preview, shortcuts = [], allowClear = false }) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'wheel-dialog';
    dialog.innerHTML = `
      <div class="dialog-heading"><h2></h2><button type="button" class="icon-button" data-act="cancel" aria-label="${L('关闭', '關閉', 'Close')}">×</button></div>
      <p class="wheel-preview" aria-live="polite"></p>
      <div class="wheel-shortcuts"></div>
      <div class="wheel-columns"><div class="wheel-highlight" aria-hidden="true"></div></div>
      <div class="form-actions">
        ${allowClear ? `<button type="button" class="link-button" data-act="clear">${L('清除', '清除', 'Clear')}</button>` : ''}
        <button type="button" data-act="cancel">${L('取消', '取消', 'Cancel')}</button>
        <button type="button" class="primary" data-act="ok">${L('确定', '確定', 'Done')}</button>
      </div>`;
    dialog.querySelector('h2').textContent = title;
    const box = dialog.querySelector('.wheel-columns');
    for (const column of columns) {
      const wrap = document.createElement('div');
      wrap.className = 'wheel-column-wrap';
      const caption = document.createElement('span');
      caption.className = 'wheel-caption';
      caption.textContent = column.caption || '';
      wrap.append(caption, column.wheel.el);
      box.append(wrap);
    }
    const shortcutBox = dialog.querySelector('.wheel-shortcuts');
    for (const shortcut of shortcuts) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-button';
      button.textContent = shortcut.text;
      button.onclick = shortcut.apply;
      shortcutBox.append(button);
    }
    if (!shortcuts.length) shortcutBox.remove();

    const updatePreview = () => { dialog.querySelector('.wheel-preview').textContent = preview(); };
    dialog.updatePreview = updatePreview;
    updatePreview();

    let result = 'cancel';
    dialog.addEventListener('click', event => {
      const act = event.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      result = act;
      dialog.close();
    });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
    document.body.append(dialog);
    dialog.showModal();
    columns[0].wheel.el.focus();
  });
}

/** Re-draw the preview line of the picker that is open right now. */
const refreshPreview = () => document.querySelector('.wheel-dialog')?.updatePreview();

// ---------------------------------------------------------------------------
// Date + time picker
// ---------------------------------------------------------------------------

const pad = n => String(n).padStart(2, '0');
const range = (from, to, text) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, text: text(from + i) }));
const weekday = (y, m, d) => [L('周日', '週日', 'Sun'), L('周一', '週一', 'Mon'), L('周二', '週二', 'Tue'), L('周三', '週三', 'Wed'), L('周四', '週四', 'Thu'), L('周五', '週五', 'Fri'), L('周六', '週六', 'Sat')][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

/** '2026年10月18日 周日 22:30' (or the English equivalent) for a Hong Kong time. */
export function formatHk(ms) {
  const p = hkParts(ms);
  return lang() === 'en'
    ? `${weekday(p.year, p.month, p.day)} ${p.day}/${p.month}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`
    : `${p.year}年${p.month}月${p.day}日 ${weekday(p.year, p.month, p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Ask the user for a Hong Kong date and time.
 * Resolves: a timestamp (ms) after 确定, null after 清除, undefined after 取消.
 */
export async function openDateTimePicker({ title, value = null, allowClear = false } = {}) {
  const start = hkParts(value ?? nextWholeHour(Date.now()));
  const thisYear = hkParts(Date.now()).year;
  const firstYear = Math.min(thisYear - 1, start.year);
  const lastYear = Math.min(2099, Math.max(thisYear + 5, start.year));
  const en = lang() === 'en';

  const days = (y, m) => range(1, daysInMonth(y, m), d => (en ? String(d) : d + '日'));
  const year = new WheelColumn({ label: L('年', '年', 'Year'), items: range(firstYear, lastYear, y => String(y)), index: start.year - firstYear, onChange: () => refreshDays() });
  const month = new WheelColumn({ label: L('月', '月', 'Month'), items: range(1, 12, m => (en ? String(m) : m + '月')), index: start.month - 1, onChange: () => refreshDays() });
  const day = new WheelColumn({ label: L('日', '日', 'Day'), items: days(start.year, start.month), index: start.day - 1, onChange: refreshPreview });
  const hour = new WheelColumn({ label: L('时', '時', 'Hour'), items: range(0, 23, pad), index: start.hour, onChange: refreshPreview });
  const minute = new WheelColumn({ label: L('分', '分', 'Minute'), items: range(0, 59, pad), index: start.minute, onChange: refreshPreview });

  const current = () => hkPartsToMs({ year: year.value, month: month.value, day: day.value, hour: hour.value, minute: minute.value });
  // Changing year/month changes how many days the month has (28–31).
  function refreshDays() {
    const count = daysInMonth(year.value, month.value);
    if (day.items.length !== count) day.setItems(days(year.value, month.value), Math.min(day.index, count - 1));
    refreshPreview();
  }
  const jumpTo = ms => {
    const p = hkParts(ms);
    year.setValue(p.year, true); month.setValue(p.month, true);
    day.setItems(days(p.year, p.month), day.index); day.setValue(p.day, true);
    hour.setValue(p.hour, true); minute.setValue(p.minute, true);
  };
  // Handy one-tap choices so most people never need to spin at all.
  const today = hkParts(Date.now());
  const at = (addDays, h, m) => hkPartsToMs({ ...today, hour: h, minute: m }) + addDays * 86400000;
  const shortcuts = [
    { text: L('今晚 23:59', '今晚 23:59', 'Tonight 23:59'), apply: () => jumpTo(at(0, 23, 59)) },
    { text: L('明天 09:00', '明天 09:00', 'Tomorrow 09:00'), apply: () => jumpTo(at(1, 9, 0)) },
    { text: L('明天 23:59', '明天 23:59', 'Tomorrow 23:59'), apply: () => jumpTo(at(1, 23, 59)) },
    { text: L('一周后', '一週後', 'In a week'), apply: () => jumpTo(current() + 7 * 86400000) },
  ];

  const columns = [
    { wheel: year, caption: L('年', '年', 'Year') }, { wheel: month, caption: L('月', '月', 'Month') }, { wheel: day, caption: L('日', '日', 'Day') },
    { wheel: hour, caption: L('时', '時', 'Hour') }, { wheel: minute, caption: L('分', '分', 'Min') },
  ];
  const result = await showWheelDialog({ title, columns, allowClear, shortcuts, preview: () => formatHk(current()) + L('（香港）', '（香港）', ' (HKT)') });
  if (result === 'ok') return current();
  if (result === 'clear') return null;
  return undefined;
}

// ---------------------------------------------------------------------------
// Duration picker (number + unit)
// ---------------------------------------------------------------------------

/**
 * Ask for a duration such as "2 小时".
 * Resolves with minutes after 确定, or undefined after 取消.
 * `describe(minutes)` builds the preview text, e.g. m => '截止前 ' + label.
 */
export async function openDurationPicker({ title, minutes = 60, minMinutes = 1, describe = text => text } = {}) {
  const units = ['minute', 'hour', 'day'];
  const startSplit = splitMinutes(minutes);
  const amount = new WheelColumn({ label: L('数量', '數量', 'Amount'), items: range(1, 99, String), index: clamp(startSplit.amount, 1, 99) - 1, onChange: () => refresh() });
  const unit = new WheelColumn({ label: L('单位', '單位', 'Unit'), items: units.map(u => ({ value: u, text: unitName(u, lang()) })), index: units.indexOf(startSplit.unit), onChange: () => refresh() });
  const current = () => toMinutes(amount.value, unit.value);
  const tooShort = () => current() < minMinutes;
  const refresh = () => {
    refreshPreview();
    const ok = document.querySelector('.wheel-dialog [data-act=ok]');
    if (ok) ok.disabled = tooShort();
  };
  const preview = () => {
    const label = `${amount.value} ${unitName(unit.value, lang(), amount.value)}`;
    return tooShort() ? L(`至少 ${minMinutes} 分钟`, `至少 ${minMinutes} 分鐘`, `At least ${minMinutes} minutes`) : describe(label);
  };
  const resultPromise = showWheelDialog({ title, preview, columns: [{ wheel: amount, caption: L('数量', '數量', 'Amount') }, { wheel: unit, caption: L('单位', '單位', 'Unit') }] });
  refresh();
  const result = await resultPromise;
  return result === 'ok' && !tooShort() ? current() : undefined;
}
