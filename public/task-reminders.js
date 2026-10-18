// The "no typing" parts of the task form:
//   截止时间        -> a button that opens the date-time wheel
//   截止前提醒      -> toggle chips + "＋ 自定义" (duration wheel) + "设为默认"
//   指定提醒时间    -> "＋ 添加提醒时间" (date-time wheel), shown as removable chips
//   自定义间隔      -> duration wheel instead of a number box
//
// The data sent to the server is exactly the same as before:
//   due: timestamp or null, reminders.offsets: [minutes], reminders.exact: [timestamps], reminders.repeat: minutes

import { BUILT_IN_OFFSETS, MAX_EXACT, MAX_OFFSETS, MAX_PRESETS, chipOffsets, fromHkInputValue, normalizeExact, normalizeOffsets, normalizePresets, offsetLabel, toHkInputValue } from './reminder-logic.js';
import { formatHk, openDateTimePicker, openDurationPicker } from './wheel-picker.js';

const lang = () => document.documentElement.lang || 'zh-CN';
const L = (cn, tw, en) => (lang() === 'zh-TW' ? tw : lang() === 'en' ? en : cn);

export class TaskReminderPicker {
  /**
   * @param {HTMLFormElement} form   the #task-form element
   * @param {() => object} getDefaults            current reminder defaults of the user (from /api/profile)
   * @param {(patch: object) => Promise<object>} saveDefaults  saves part of the defaults, returns the new defaults
   * @param {(text: string) => void} notify       shows a short message (toast)
   */
  constructor({ form, getDefaults, saveDefaults, notify }) {
    this.form = form;
    this.getDefaults = getDefaults;
    this.saveDefaults = saveDefaults;
    this.notify = notify;
    this.selected = new Set(); // offsets (minutes) that are switched on
    this.exact = [];           // exact reminder timestamps
    this.$ = selector => form.querySelector(selector);
    this.bind();
  }

  // ---------- public API used by app.js ----------

  /** Fill the form for a new task (task = null) or for editing an existing task. */
  load(task) {
    const defaults = this.getDefaults();
    const reminders = task ? task.reminders : defaults;
    this.setDue(task?.due ?? null);
    this.selected = new Set(normalizeOffsets(reminders.offsets));
    this.exact = task ? normalizeExact(reminders.exact) : [];
    const repeat = Number(reminders.repeat);
    const known = [0, 30, 60, 120, 1440].includes(repeat);
    this.form.elements.repeat.value = known ? String(repeat) : 'custom';
    this.setCustomRepeat(known ? null : repeat);
    this.renderOffsets();
    this.renderExact();
  }

  /** Read the values for saving. Throws an Error with a friendly message if something is missing. */
  collect() {
    const select = this.form.elements.repeat;
    const custom = Number(this.form.elements.customRepeat.value);
    if (select.value === 'custom' && !custom) throw new Error(L('请选择自定义重复间隔', '請選擇自訂重複間隔', 'Choose a custom repeat interval'));
    return {
      due: fromHkInputValue(this.form.elements.due.value),
      offsets: [...this.selected],
      exact: [...this.exact],
      repeat: select.value === 'custom' ? custom : Number(select.value),
    };
  }

  // ---------- 截止时间 ----------

  setDue(ms) {
    this.form.elements.due.value = toHkInputValue(ms); // same 'YYYY-MM-DDTHH:mm' text as the old input
    this.$('#due-button').textContent = ms == null ? L('点此选择截止时间', '點此選擇截止時間', 'Choose a due time') : formatHk(ms);
    this.$('#due-button').classList.toggle('is-empty', ms == null);
    this.$('#due-clear').hidden = ms == null;
    this.$('#offset-hint').hidden = ms != null; // "before due" reminders need a due time
  }

  async pickDue() {
    const current = fromHkInputValue(this.form.elements.due.value);
    const picked = await openDateTimePicker({ title: L('截止时间（香港）', '截止時間（香港）', 'Due time (Hong Kong)'), value: current, allowClear: true });
    if (picked !== undefined) this.setDue(picked); // undefined = cancelled
  }

  // ---------- 截止前提醒 ----------

  renderOffsets() {
    const presets = normalizePresets(this.getDefaults().presets);
    const box = this.$('#offset-chips');
    box.replaceChildren(...chipOffsets(presets, [...this.selected]).map(minutes => {
      const wrap = document.createElement('span');
      wrap.className = 'chip-wrap';
      const chip = document.createElement('label');
      chip.className = 'chip';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'offset';
      input.value = String(minutes);
      input.checked = this.selected.has(minutes);
      input.onchange = () => this.toggleOffset(minutes, input);
      chip.append(input, offsetLabel(minutes, lang()));
      wrap.append(chip);
      // Custom (non built-in) chips get a "设为默认" switch so they show up for future tasks.
      if (!BUILT_IN_OFFSETS.includes(minutes)) {
        const saved = presets.includes(minutes);
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'chip-star';
        star.setAttribute('aria-pressed', String(saved));
        star.textContent = saved ? L('★ 默认', '★ 預設', '★ Default') : L('设为默认', '設為預設', 'Set default');
        star.title = saved ? L('点击取消默认', '點擊取消預設', 'Remove from defaults') : L('以后新建待办也显示这个选项', '以後新增待辦也顯示這個選項', 'Show this option for future tasks');
        star.setAttribute('aria-label', `${offsetLabel(minutes, lang())} ${star.title}`);
        star.onclick = () => this.togglePreset(minutes, !saved);
        wrap.append(star);
      }
      return wrap;
    }));
  }

  toggleOffset(minutes, checkbox) {
    if (checkbox.checked && this.selected.size >= MAX_OFFSETS) {
      checkbox.checked = false;
      this.notify(L(`最多选择 ${MAX_OFFSETS} 个截止前提醒`, `最多選擇 ${MAX_OFFSETS} 個截止前提醒`, `Choose up to ${MAX_OFFSETS} reminders`));
      return;
    }
    if (checkbox.checked) this.selected.add(minutes);
    else this.selected.delete(minutes);
  }

  async addCustomOffset() {
    const minutes = await openDurationPicker({
      title: L('自定义截止前提醒', '自訂截止前提醒', 'Custom reminder'),
      minutes: 60,
      label: L('截止前多久提醒', '截止前多久提醒', 'Remind me before the due time'),
    });
    if (minutes === undefined) return;
    if (!this.selected.has(minutes) && this.selected.size >= MAX_OFFSETS) {
      this.notify(L(`最多选择 ${MAX_OFFSETS} 个截止前提醒`, `最多選擇 ${MAX_OFFSETS} 個截止前提醒`, `Choose up to ${MAX_OFFSETS} reminders`));
      return;
    }
    this.selected.add(minutes);
    this.renderOffsets();
  }

  /** Add (on = true) or remove a custom offset from the user's saved presets. */
  async togglePreset(minutes, on) {
    const old = normalizePresets(this.getDefaults().presets);
    if (on && old.length >= MAX_PRESETS) {
      this.notify(L(`最多保存 ${MAX_PRESETS} 个自定义选项`, `最多儲存 ${MAX_PRESETS} 個自訂選項`, `You can save up to ${MAX_PRESETS} custom options`));
      return;
    }
    const presets = on ? [...old, minutes] : old.filter(n => n !== minutes);
    try {
      await this.saveDefaults({ presets: normalizePresets(presets) });
      this.notify(on ? L('已设为默认选项', '已設為預設選項', 'Saved as a default option') : L('已从默认选项移除', '已從預設選項移除', 'Removed from default options'));
      this.renderOffsets();
    } catch (error) {
      this.notify(error.message);
    }
  }

  /** Remember which chips are ticked, so the next new task starts with the same choice. */
  async saveSelectionAsDefault() {
    try {
      const offsets = [...this.selected];
      // Any custom value in the selection must also be a preset, otherwise its chip would vanish.
      const presets = normalizePresets([...(this.getDefaults().presets || []), ...offsets]);
      await this.saveDefaults({ offsets, presets });
      this.notify(L('新待办会默认使用这些提醒', '新待辦會預設使用這些提醒', 'New tasks will start with these reminders'));
      this.renderOffsets();
    } catch (error) {
      this.notify(error.message);
    }
  }

  // ---------- 指定提醒时间 ----------

  renderExact() {
    const box = this.$('#exact-chips');
    const now = Date.now();
    box.replaceChildren(...this.exact.map((ms, index) => {
      const chip = document.createElement('span');
      chip.className = 'chip is-on' + (ms < now ? ' is-past' : '');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'chip-text';
      edit.textContent = formatHk(ms);
      edit.title = ms < now ? L('这个时间已过去，不会再提醒', '這個時間已過去，不會再提醒', 'This time has passed') : L('点击修改', '點擊修改', 'Tap to change');
      edit.onclick = () => this.pickExact(index);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', L('删除提醒 ', '刪除提醒 ', 'Remove reminder ') + formatHk(ms));
      remove.onclick = () => { this.exact.splice(index, 1); this.renderExact(); this.$('#add-exact').focus(); };
      chip.append(edit, remove);
      return chip;
    }));
    this.$('#add-exact').disabled = this.exact.length >= MAX_EXACT;
  }

  /** index = which chip to change, or undefined to add a new time. */
  async pickExact(index) {
    const due = fromHkInputValue(this.form.elements.due.value);
    // Start new times one day before the due time (if that is still in the future).
    const suggestion = due && due - 86400000 > Date.now() ? due - 86400000 : null;
    const value = index === undefined ? suggestion : this.exact[index];
    const picked = await openDateTimePicker({ title: L('指定提醒时间（香港）', '指定提醒時間（香港）', 'Reminder time (Hong Kong)'), value });
    if (picked === undefined || picked === null) return;
    if (index === undefined) this.exact.push(picked);
    else this.exact[index] = picked;
    this.exact = normalizeExact(this.exact);
    this.renderExact();
  }

  // ---------- 自定义重复间隔 ----------

  setCustomRepeat(minutes) {
    this.form.elements.customRepeat.value = minutes ? String(minutes) : '';
    const button = this.$('#repeat-button');
    button.textContent = minutes ? L('每 ', '每 ', 'Every ') + offsetLabel(minutes, lang()) : L('选择间隔', '選擇間隔', 'Choose interval');
    this.$('#repeat-field').hidden = this.form.elements.repeat.value !== 'custom';
  }

  async pickRepeat(previous) {
    const current = Number(this.form.elements.customRepeat.value) || 180;
    const minutes = await openDurationPicker({
      title: L('自定义重复间隔', '自訂重複間隔', 'Custom repeat interval'),
      minutes: current,
      minMinutes: 30,
      label: L('每隔多久提醒一次', '每隔多久提醒一次', 'Repeat every'),
    });
    if (minutes !== undefined) this.setCustomRepeat(minutes);
    else if (!this.form.elements.customRepeat.value && previous) {
      this.form.elements.repeat.value = previous; // cancelled without a value: go back
      this.setCustomRepeat(null);
    }
  }

  // ---------- wiring ----------

  bind() {
    const select = this.form.elements.repeat;
    let previousRepeat = select.value;
    select.addEventListener('focus', () => { previousRepeat = select.value; });
    select.addEventListener('change', () => {
      this.setCustomRepeat(Number(this.form.elements.customRepeat.value) || null);
      if (select.value === 'custom') this.pickRepeat(previousRepeat);
      else previousRepeat = select.value;
    });
    this.$('#repeat-button').onclick = () => this.pickRepeat();
    this.$('#due-button').onclick = () => this.pickDue();
    this.$('#due-clear').onclick = () => { this.setDue(null); this.$('#due-button').focus(); };
    this.$('#add-offset').onclick = () => this.addCustomOffset();
    this.$('#save-offset-defaults').onclick = () => this.saveSelectionAsDefault();
    this.$('#add-exact').onclick = () => this.pickExact();
  }
}
